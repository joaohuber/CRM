"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone, phoneKey } from "@/lib/phone";
import { ATTRIBUTION_FIELDS, type StageKind } from "@/lib/types";

export type FormState = { error: string | null };

type StageLite = { id: string; name: string; kind: StageKind };

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseMoney(raw: string): number | null {
  let s = raw.replace(/R\$|\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Já existe um lead com este telefone.";
  return error.message;
}

async function loadStages(supabase: SupabaseClient): Promise<StageLite[]> {
  const { data } = await supabase.from("stages").select("id, name, kind").order("position");
  return (data ?? []) as StageLite[];
}

/** Ao entrar numa etapa "ganho" grava won_at (usado no export do Google Ads); ao sair, limpa. */
function stagePatch(stages: StageLite[], currentWonAt: string | null, stageId: string) {
  const target = stages.find((stage) => stage.id === stageId);
  if (!target) throw new Error("Etapa inválida");
  return {
    stage_id: stageId,
    won_at: target.kind === "won" ? (currentWonAt ?? new Date().toISOString()) : null,
  };
}

async function logStageChange(
  supabase: SupabaseClient,
  leadId: string,
  stages: StageLite[],
  from: string | null,
  to: string,
) {
  const name = (id: string | null) => stages.find((stage) => stage.id === id)?.name ?? "Sem etapa";
  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    kind: "stage_change",
    content: `${name(from)} → ${name(to)}`,
    metadata: { from, to },
  });
}

export async function moveLead(leadId: string, stageId: string) {
  const supabase = await createClient();
  const [{ data: lead }, stages] = await Promise.all([
    supabase.from("leads").select("id, stage_id, won_at").eq("id", leadId).single(),
    loadStages(supabase),
  ]);
  if (!lead) throw new Error("Lead não encontrado");
  if (lead.stage_id === stageId) return;

  const { error } = await supabase
    .from("leads")
    .update(stagePatch(stages, lead.won_at, stageId))
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await logStageChange(supabase, leadId, stages, lead.stage_id, stageId);
  revalidatePath("/kanban");
  revalidatePath(`/leads/${leadId}`);
}

export async function saveLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const id = str(formData, "id");
  const name = str(formData, "name");
  const rawPhone = str(formData, "phone");
  const phone = normalizePhone(rawPhone);
  const email = str(formData, "email")?.toLowerCase() ?? null;

  if (rawPhone && !phone) return { error: "Telefone inválido. Use DDD + número." };
  if (!name && !phone && !email) return { error: "Informe ao menos nome, telefone ou e-mail." };

  const rawValue = str(formData, "value");
  const value = rawValue ? parseMoney(rawValue) : null;
  if (rawValue && value === null) return { error: "Valor inválido." };

  const record: Record<string, unknown> = {
    name,
    phone,
    phone_key: phoneKey(phone),
    email,
    value,
    notes: str(formData, "notes"),
  };
  for (const field of ATTRIBUTION_FIELDS) record[field] = str(formData, field);

  const stages = await loadStages(supabase);
  const stageId = str(formData, "stage_id") ?? stages[0]?.id ?? null;
  let leadId = id;

  if (id) {
    const { data: current } = await supabase
      .from("leads")
      .select("stage_id, won_at")
      .eq("id", id)
      .single();
    if (!current) return { error: "Lead não encontrado." };

    const stageChanged = stageId && stageId !== current.stage_id;
    if (stageChanged) Object.assign(record, stagePatch(stages, current.won_at, stageId));

    const { error } = await supabase.from("leads").update(record).eq("id", id);
    if (error) return { error: friendly(error) };
    if (stageChanged) await logStageChange(supabase, id, stages, current.stage_id, stageId);
  } else {
    if (stageId) Object.assign(record, stagePatch(stages, null, stageId));
    const { data, error } = await supabase
      .from("leads")
      .insert({ ...record, channel: "manual" })
      .select("id")
      .single();
    if (error) return { error: friendly(error) };
    leadId = data.id as string;
    await supabase
      .from("lead_activities")
      .insert({ lead_id: leadId, kind: "created", content: "Lead criado manualmente" });
  }

  revalidatePath("/kanban");
  revalidatePath("/leads");
  redirect(`/leads/${leadId}?salvo=1`);
}

export async function addNote(formData: FormData) {
  const leadId = str(formData, "lead_id");
  const content = str(formData, "content");
  if (!leadId || !content) return;
  const supabase = await createClient();
  await supabase.from("lead_activities").insert({ lead_id: leadId, kind: "note", content });
  revalidatePath(`/leads/${leadId}`);
}

export async function deleteLead(formData: FormData) {
  const id = str(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/kanban");
  revalidatePath("/leads");
  redirect("/leads");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(formData, "email") ?? "",
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: "E-mail ou senha incorretos." };
  redirect("/kanban");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

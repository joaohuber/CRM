import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone, phoneKey } from "./phone";
import {
  ATTRIBUTION_FIELDS,
  type ActivityKind,
  type Attribution,
  type Lead,
  type LeadChannel,
} from "./types";

export class LeadInputError extends Error {}

export interface IncomingLead {
  channel: Exclude<LeadChannel, "manual">;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  /** Para WhatsApp: "in" = cliente escreveu, "out" = equipe respondeu. */
  direction?: "in" | "out";
  attribution?: Attribution;
  metadata?: Record<string, unknown>;
  /** Id da mensagem (WhatsApp) para não duplicar a atividade em retries. */
  externalId?: string | null;
  /** Momento da mensagem (ISO). */
  at?: string;
}

const CHANNEL_LABEL: Record<IncomingLead["channel"], string> = {
  form: "formulário",
  whatsapp: "WhatsApp",
};

function cleanAttribution(attribution?: Attribution): Attribution {
  const out: Attribution = {};
  if (!attribution) return out;
  for (const field of ATTRIBUTION_FIELDS) {
    const value = attribution[field];
    if (typeof value === "string" && value.trim()) out[field] = value.trim().slice(0, 1000);
  }
  return out;
}

export async function findLeadByContact(
  db: SupabaseClient,
  key: string | null,
  email: string | null,
): Promise<Lead | null> {
  if (key) {
    const { data } = await db.from("leads").select("*").eq("phone_key", key).maybeSingle();
    if (data) return data as Lead;
  }
  if (email) {
    const { data } = await db
      .from("leads")
      .select("*")
      .eq("email", email)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (data) return data as Lead;
  }
  return null;
}

export async function findLeadByPhone(db: SupabaseClient, rawPhone: string) {
  return findLeadByContact(db, phoneKey(normalizePhone(rawPhone)), null);
}

/** Registra na linha do tempo. Retorna false se a atividade já existia (mesmo external_id). */
export async function logActivity(
  db: SupabaseClient,
  leadId: string,
  kind: ActivityKind,
  content: string | null,
  metadata: Record<string, unknown> = {},
  externalId?: string | null,
): Promise<boolean> {
  const { error } = await db.from("lead_activities").insert({
    lead_id: leadId,
    kind,
    content,
    metadata,
    external_id: externalId ?? null,
  });
  if (error && error.code !== "23505") throw error;
  return !error;
}

async function firstStageId(db: SupabaseClient): Promise<string | null> {
  const { data } = await db
    .from("stages")
    .select("id")
    .order("position")
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Cria ou atualiza um lead vindo de webhook, deduplicando por telefone (ou e-mail).
 * A origem do tráfego é first-touch: só é gravada se o lead ainda não tiver nenhuma.
 */
export async function upsertLead(
  db: SupabaseClient,
  input: IncomingLead,
): Promise<{ lead: Lead; created: boolean }> {
  const phone = normalizePhone(input.phone);
  const key = phoneKey(phone);
  const email = input.email?.trim().toLowerCase() || null;
  if (!key && !email) throw new LeadInputError("Telefone ou e-mail é obrigatório");

  const name = input.name?.trim().slice(0, 200) || null;
  const message = input.message?.trim().slice(0, 5000) || null;
  const at = input.at ?? new Date().toISOString();
  const attribution = cleanAttribution(input.attribution);
  const isWhatsapp = input.channel === "whatsapp";
  const inbound = input.direction !== "out";
  const messageKind: ActivityKind = !isWhatsapp ? "form" : inbound ? "message_in" : "message_out";

  let existing = await findLeadByContact(db, key, email);

  if (!existing) {
    const { data, error } = await db
      .from("leads")
      .insert({
        name,
        phone,
        phone_key: key,
        email,
        channel: input.channel,
        stage_id: await firstStageId(db),
        first_message: inbound ? message : null,
        last_message_at: isWhatsapp && message ? at : null,
        ...attribution,
      })
      .select("*")
      .single();

    if (!error && data) {
      const lead = data as Lead;
      await logActivity(db, lead.id, "created", `Lead criado via ${CHANNEL_LABEL[input.channel]}`, {
        attribution,
      });
      if (message) {
        await logActivity(db, lead.id, messageKind, message, input.metadata, input.externalId);
      }
      return { lead, created: true };
    }

    // Outro webhook criou o mesmo lead ao mesmo tempo: segue como atualização.
    if (!error || error.code !== "23505") throw error ?? new Error("Falha ao criar lead");
    existing = await findLeadByContact(db, key, email);
    if (!existing) throw error;
  }

  const current = existing;
  const patch: Record<string, unknown> = {};
  if (name && (!current.name || current.name === current.phone)) patch.name = name;
  if (email && !current.email) patch.email = email;
  if (phone && !current.phone) {
    patch.phone = phone;
    patch.phone_key = key;
  }

  const hadAttribution = ATTRIBUTION_FIELDS.some((field) => current[field]);
  const gainedAttribution = !hadAttribution && Object.keys(attribution).length > 0;
  if (gainedAttribution) Object.assign(patch, attribution);

  if (message) {
    if (isWhatsapp) patch.last_message_at = at;
    if (inbound && !current.first_message) patch.first_message = message;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("leads").update(patch).eq("id", current.id);
    if (error) throw error;
  }

  if (gainedAttribution) {
    await logActivity(db, current.id, "attribution", "Origem do tráfego registrada", { attribution });
  }
  if (message) {
    await logActivity(db, current.id, messageKind, message, input.metadata, input.externalId);
  } else if (!isWhatsapp) {
    await logActivity(db, current.id, "form", "Novo envio de formulário", { attribution });
  }

  return { lead: { ...current, ...patch } as Lead, created: false };
}

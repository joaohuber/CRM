import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";
import { LeadForm } from "@/components/LeadForm";
import { addNote } from "@/lib/actions";
import { ORIGIN_CLASSES, formatDateTime, formatPhone, originOf, whatsappUrl } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ActivityKind, Lead, LeadActivity, Stage } from "@/lib/types";

const ACTIVITY: Record<ActivityKind, { label: string; dot: string }> = {
  created: { label: "Lead criado", dot: "bg-faint" },
  form: { label: "Formulário", dot: "bg-sky-400" },
  message_in: { label: "Mensagem do cliente", dot: "bg-brand-cyan" },
  message_out: { label: "Mensagem da equipe", dot: "bg-brand-blue" },
  stage_change: { label: "Mudou de etapa", dot: "bg-violet-400" },
  note: { label: "Anotação", dot: "bg-amber-400" },
  attribution: { label: "Origem registrada", dot: "bg-emerald-400" },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string }>;
};

export default async function LeadPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { salvo } = await searchParams;
  const supabase = await createClient();

  const [{ data: leadData }, { data: stagesData }, { data: activityData }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase.from("stages").select("id, name, position, color, kind").order("position"),
    supabase
      .from("lead_activities")
      .select("id, lead_id, kind, content, metadata, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (!leadData) notFound();
  const lead = leadData as Lead;
  const stages = (stagesData ?? []) as Stage[];
  const activities = (activityData ?? []) as LeadActivity[];
  const origin = originOf(lead);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/kanban" className="text-sm text-muted hover:text-fg">
              ← Funil
            </Link>
            <h1 className="mt-1 text-xl font-semibold">{lead.name || formatPhone(lead.phone) || "Sem nome"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className={`badge ${ORIGIN_CLASSES[origin.tone]}`}>{origin.label}</span>
              <span>Criado em {formatDateTime(lead.created_at)}</span>
            </div>
          </div>
          {lead.phone && (
            <a href={whatsappUrl(lead.phone)} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Abrir no WhatsApp
            </a>
          )}
        </div>

        {salvo && (
          <p className="rounded-lg bg-brand-blue/15 px-3 py-2 text-sm text-brand-cyan">Alterações salvas.</p>
        )}

        <LeadForm key={lead.updated_at} lead={lead} stages={stages} />

        <div className="flex justify-end">
          <DeleteLeadButton id={lead.id} />
        </div>
      </div>

      <aside className="space-y-4">
        <form action={addNote} className="card space-y-2 p-4">
          <input type="hidden" name="lead_id" value={lead.id} />
          <label className="label" htmlFor="content">Nova anotação</label>
          <textarea
            id="content"
            name="content"
            rows={3}
            required
            placeholder="Ex.: pediu orçamento de lentes multifocais, retornar sexta"
            className="input"
          />
          <div className="flex justify-end">
            <button type="submit" className="btn">Adicionar</button>
          </div>
        </form>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-fg">Histórico</h2>
          <ol className="space-y-4">
            {activities.map((activity) => {
              const meta = ACTIVITY[activity.kind] ?? ACTIVITY.note;
              return (
                <li key={activity.id} className="flex gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-fg">{meta.label}</span>
                      <span className="shrink-0 text-[11px] text-faint">{formatDateTime(activity.created_at)}</span>
                    </div>
                    {activity.content && (
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted">{activity.content}</p>
                    )}
                  </div>
                </li>
              );
            })}
            {activities.length === 0 && <li className="text-sm text-faint">Sem atividades.</li>}
          </ol>
        </section>
      </aside>
    </div>
  );
}

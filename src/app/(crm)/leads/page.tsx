import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ORIGIN_CLASSES, formatCurrency, formatDateTime, formatPhone, originOf } from "@/lib/format";
import { stageColor } from "@/lib/stage-colors";
import type { Lead, Stage } from "@/lib/types";

type SearchParams = Promise<{ q?: string; etapa?: string; origem?: string }>;

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, etapa, origem } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select(
      "id, name, phone, email, stage_id, value, channel, utm_source, utm_medium, utm_campaign, utm_term, gclid, gbraid, wbraid, fbclid, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  // Remove caracteres que quebram a sintaxe do filtro .or() do PostgREST
  const term = q?.replace(/[,()%*\\]/g, " ").trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    query = query.or(
      `name.ilike.%${term}%,email.ilike.%${term}%,utm_campaign.ilike.%${term}%,phone.ilike.%${digits || term}%`,
    );
  }
  if (etapa) query = query.eq("stage_id", etapa);
  if (origem === "google") query = query.eq("has_google_click", true);
  else if (origem === "whatsapp" || origem === "form" || origem === "manual") query = query.eq("channel", origem);

  const [{ data: leads, error }, { data: stagesData }] = await Promise.all([
    query,
    supabase.from("stages").select("id, name, position, color, kind").order("position"),
  ]);
  const stages = (stagesData ?? []) as Stage[];
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const rows = (leads ?? []) as Lead[];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="q">Buscar</label>
            <input id="q" name="q" defaultValue={q} placeholder="Nome, telefone, e-mail, campanha" className="input w-64" />
          </div>
          <div>
            <label className="label" htmlFor="etapa">Etapa</label>
            <select id="etapa" name="etapa" defaultValue={etapa ?? ""} className="input">
              <option value="">Todas</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="origem">Origem</label>
            <select id="origem" name="origem" defaultValue={origem ?? ""} className="input">
              <option value="">Todas</option>
              <option value="google">Google Ads (GCLID)</option>
              <option value="whatsapp">Chegou pelo WhatsApp</option>
              <option value="form">Chegou por formulário</option>
              <option value="manual">Cadastro manual</option>
            </select>
          </div>
          <button type="submit" className="btn">Filtrar</button>
          {(q || etapa || origem) && (
            <Link href="/leads" className="text-sm text-muted hover:text-fg">
              Limpar
            </Link>
          )}
        </form>
        <a href="/api/export/google-ads" className="btn">
          Exportar conversões (Google Ads)
        </a>
      </div>

      {error && <p className="text-sm text-rose-400">{error.message}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-raised text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Etapa</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium">Campanha / termo</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Criado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((lead) => {
              const stage = lead.stage_id ? stageById.get(lead.stage_id) : undefined;
              const origin = originOf(lead);
              return (
                <tr key={lead.id} className="hover:bg-raised/60">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-fg hover:text-brand-cyan">
                      {lead.name || formatPhone(lead.phone) || lead.email || "Sem nome"}
                    </Link>
                    <div className="text-xs text-muted">
                      {[formatPhone(lead.phone), lead.email].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {stage && (
                      <span className="inline-flex items-center gap-1.5 text-fg">
                        <span className={`h-2 w-2 rounded-full ${stageColor(stage.color).dot}`} />
                        {stage.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${ORIGIN_CLASSES[origin.tone]}`}>{origin.label}</span>
                    {lead.utm_medium && <div className="mt-1 text-xs text-faint">{lead.utm_medium}</div>}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-muted">
                    <div className="truncate">{lead.utm_campaign}</div>
                    {lead.utm_term && <div className="truncate text-faint">{lead.utm_term}</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-fg">{formatCurrency(lead.value)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{formatDateTime(lead.created_at)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-faint">
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length === 500 && <p className="text-xs text-faint">Mostrando os 500 mais recentes. Use os filtros.</p>}
    </div>
  );
}

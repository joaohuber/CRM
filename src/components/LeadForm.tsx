"use client";

import { useActionState } from "react";
import { saveLead, type FormState } from "@/lib/actions";
import { formatPhone } from "@/lib/format";
import { ATTRIBUTION_FIELDS, type AttributionField, type Lead, type Stage } from "@/lib/types";

const ATTRIBUTION_LABELS: Record<AttributionField, string> = {
  utm_source: "utm_source",
  utm_medium: "utm_medium",
  utm_campaign: "utm_campaign",
  utm_term: "utm_term (palavra-chave)",
  utm_content: "utm_content",
  gclid: "GCLID (Google Ads)",
  gbraid: "GBRAID (Google Ads iOS)",
  wbraid: "WBRAID (Google Ads iOS)",
  fbclid: "FBCLID (Meta)",
  landing_page: "Página de entrada",
  referrer: "Referência (referrer)",
};

export function LeadForm({ lead, stages }: { lead?: Lead; stages: Stage[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLead, { error: null });
  const hasAttribution = lead ? ATTRIBUTION_FIELDS.some((field) => lead[field]) : false;

  return (
    <form action={action} className="space-y-6">
      {lead && <input type="hidden" name="id" value={lead.id} />}

      <fieldset className="card space-y-4 p-4">
        <legend className="px-1 text-sm font-semibold text-fg">Contato</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">Nome</label>
            <input id="name" name="name" defaultValue={lead?.name ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="phone">WhatsApp</label>
            <input
              id="phone"
              name="phone"
              inputMode="tel"
              placeholder="(11) 99999-8888"
              defaultValue={lead?.phone ? formatPhone(lead.phone) : ""}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" defaultValue={lead?.email ?? ""} className="input" />
          </div>
        </div>
      </fieldset>

      <fieldset className="card space-y-4 p-4">
        <legend className="px-1 text-sm font-semibold text-fg">Negócio</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="stage_id">Etapa</label>
            <select id="stage_id" name="stage_id" defaultValue={lead?.stage_id ?? stages[0]?.id} className="input">
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="value">Valor (R$)</label>
            <input
              id="value"
              name="value"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={lead?.value != null ? String(lead.value).replace(".", ",") : ""}
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">Observações</label>
            <textarea id="notes" name="notes" rows={3} defaultValue={lead?.notes ?? ""} className="input" />
          </div>
        </div>
      </fieldset>

      <details className="card p-4" open={!lead || hasAttribution}>
        <summary className="cursor-pointer text-sm font-semibold text-fg">Origem do tráfego</summary>
        <p className="mt-1 text-xs text-muted">
          Preenchido automaticamente pelos webhooks. Edite só se souber a origem do contato.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {ATTRIBUTION_FIELDS.map((field) => (
            <div key={field} className={field === "landing_page" || field === "referrer" ? "sm:col-span-2" : ""}>
              <label className="label" htmlFor={field}>{ATTRIBUTION_LABELS[field]}</label>
              <input id={field} name={field} defaultValue={lead?.[field] ?? ""} className="input font-mono text-xs" />
            </div>
          ))}
        </div>
      </details>

      {state.error && <p className="text-sm text-rose-400">{state.error}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Salvando..." : lead ? "Salvar alterações" : "Criar lead"}
        </button>
      </div>
    </form>
  );
}

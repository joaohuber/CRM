"use client";

import Link from "next/link";
import { ORIGIN_CLASSES, formatCurrency, formatPhone, originOf, timeAgo, whatsappUrl } from "@/lib/format";
import type { LeadSummary, Stage } from "@/lib/types";

export function LeadCard({
  lead,
  stages,
  onMove,
}: {
  lead: LeadSummary;
  stages: Stage[];
  onMove: (leadId: string, stageId: string) => void;
}) {
  const origin = originOf(lead);
  const lastTouch = lead.last_message_at ?? lead.created_at;

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", lead.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      className="card cursor-grab bg-raised p-3 transition active:cursor-grabbing hover:border-brand-sky/60"
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1" draggable={false}>
          <p className="truncate text-sm font-semibold text-fg hover:text-brand-cyan">
            {lead.name || formatPhone(lead.phone) || "Sem nome"}
          </p>
          {lead.name && lead.phone && <p className="text-xs tabular-nums text-muted">{formatPhone(lead.phone)}</p>}
        </Link>
        {lead.phone && (
          <a
            href={whatsappUrl(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            title="Abrir conversa no WhatsApp"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue/15 text-brand-cyan hover:bg-brand-blue/30"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z" />
            </svg>
          </a>
        )}
      </div>

      {lead.first_message && (
        <p className="mt-2 line-clamp-2 text-xs text-muted">&ldquo;{lead.first_message}&rdquo;</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`badge ${ORIGIN_CLASSES[origin.tone]}`}>{origin.label}</span>
        {lead.utm_campaign && (
          <span className="badge max-w-[10rem] truncate bg-transparent text-muted ring-line-strong" title={lead.utm_campaign}>
            {lead.utm_campaign}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-faint">
        <span suppressHydrationWarning>{timeAgo(lastTouch)}</span>
        {lead.value != null && <span className="font-semibold text-fg">{formatCurrency(lead.value)}</span>}
      </div>

      {/* No celular não há drag-and-drop: troca de etapa pelo seletor */}
      <select
        aria-label="Mover para etapa"
        value={lead.stage_id ?? ""}
        onChange={(event) => onMove(lead.id, event.target.value)}
        className="mt-2 w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-muted md:hidden"
      >
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>
    </article>
  );
}

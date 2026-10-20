"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveLead } from "@/lib/actions";
import { formatCurrency } from "@/lib/format";
import { stageColor } from "@/lib/stage-colors";
import { createClient } from "@/lib/supabase/client";
import type { LeadSummary, Stage } from "@/lib/types";
import { LeadCard } from "./LeadCard";

export function KanbanBoard({ stages, leads: initialLeads }: { stages: Stage[]; leads: LeadSummary[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setLeads(initialLeads), [initialLeads]);

  // Lead novo pelo webhook aparece sem recarregar a página
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("kanban-leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 400);
      })
      .subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const fallbackStage = stages[0]?.id ?? null;

  const columns = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    const visible = term
      ? leads.filter(
          (lead) =>
            lead.name?.toLowerCase().includes(term) ||
            (digits && lead.phone?.includes(digits)) ||
            lead.utm_campaign?.toLowerCase().includes(term),
        )
      : leads;

    const byStage = new Map<string, LeadSummary[]>(stages.map((stage) => [stage.id, []]));
    for (const lead of visible) {
      const key = lead.stage_id && byStage.has(lead.stage_id) ? lead.stage_id : fallbackStage;
      if (key) byStage.get(key)!.push(lead);
    }
    return byStage;
  }, [leads, stages, search, fallbackStage]);

  function handleMove(leadId: string, stageId: string) {
    const previous = leads;
    const lead = previous.find((item) => item.id === leadId);
    if (!lead || lead.stage_id === stageId) return;

    setError(null);
    setLeads(previous.map((item) => (item.id === leadId ? { ...item, stage_id: stageId } : item)));
    startTransition(async () => {
      try {
        await moveLead(leadId, stageId);
      } catch (err) {
        setLeads(previous);
        setError(err instanceof Error ? err.message : "Não foi possível mover o lead");
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-58px)] flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, telefone ou campanha"
          className="input max-w-xs"
        />
        <span className="text-sm tabular-nums text-muted">{leads.length} leads</span>
        {error && <span className="text-sm text-rose-400">{error}</span>}
      </div>

      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {stages.map((stage) => {
          const items = columns.get(stage.id) ?? [];
          const total = items.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);
          const color = stageColor(stage.color);

          return (
            <section
              key={stage.id}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (overStage !== stage.id) setOverStage(stage.id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverStage(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setOverStage(null);
                const leadId = event.dataTransfer.getData("text/plain");
                if (leadId) handleMove(leadId, stage.id);
              }}
              className={`flex w-72 shrink-0 flex-col rounded-xl border border-t-2 border-line ${color.bar} transition ${
                overStage === stage.id ? "bg-brand-blue/10 ring-2 ring-brand-cyan/50" : "bg-panel/70"
              }`}
            >
              <header className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${color.dot}`} />
                  <h2 className="text-sm font-semibold text-fg">{stage.name}</h2>
                  <span className="rounded-full bg-raised px-1.5 text-xs tabular-nums text-muted">{items.length}</span>
                </div>
                {total > 0 && (
                  <span className="text-xs font-medium tabular-nums text-muted">{formatCurrency(total)}</span>
                )}
              </header>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {items.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} stages={stages} onMove={handleMove} />
                ))}
                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed border-line-strong p-4 text-center text-xs text-faint">
                    Arraste leads para cá
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

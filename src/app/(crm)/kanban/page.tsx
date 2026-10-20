import { KanbanBoard } from "@/components/KanbanBoard";
import { createClient } from "@/lib/supabase/server";
import type { LeadSummary, Stage } from "@/lib/types";

const LEAD_COLUMNS =
  "id, name, phone, stage_id, value, channel, utm_source, utm_medium, utm_campaign, gclid, gbraid, wbraid, fbclid, first_message, last_message_at, created_at";

export default async function KanbanPage() {
  const supabase = await createClient();
  const [stagesRes, leadsRes] = await Promise.all([
    supabase.from("stages").select("id, name, position, color, kind").order("position"),
    supabase.from("leads").select(LEAD_COLUMNS).order("updated_at", { ascending: false }).limit(1000),
  ]);

  if (stagesRes.error || leadsRes.error) {
    return (
      <div className="p-6 text-sm text-rose-400">
        Erro ao carregar o funil: {stagesRes.error?.message ?? leadsRes.error?.message}
      </div>
    );
  }

  return (
    <KanbanBoard
      stages={(stagesRes.data ?? []) as Stage[]}
      leads={(leadsRes.data ?? []) as LeadSummary[]}
    />
  );
}

import Link from "next/link";
import { LeadForm } from "@/components/LeadForm";
import { createClient } from "@/lib/supabase/server";
import type { Stage } from "@/lib/types";

export default async function NewLeadPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("stages").select("id, name, position, color, kind").order("position");

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <Link href="/leads" className="text-sm text-muted hover:text-fg">
          ← Leads
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Novo lead</h1>
      </div>
      <LeadForm stages={(data ?? []) as Stage[]} />
    </div>
  );
}

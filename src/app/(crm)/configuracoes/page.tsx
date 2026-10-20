import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { stageColor } from "@/lib/stage-colors";
import type { Stage } from "@/lib/types";

async function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-ink border border-line p-3 text-xs leading-relaxed text-fg">
      <code>{children}</code>
    </pre>
  );
}

export default async function SettingsPage() {
  const base = await baseUrl();
  const supabase = await createClient();
  const [{ data: stagesData }, { data: events }] = await Promise.all([
    supabase.from("stages").select("id, name, position, color, kind").order("position"),
    supabase
      .from("webhook_events")
      .select("id, source, event, error, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const stages = (stagesData ?? []) as Stage[];
  const kindLabel = { open: "aberta", won: "ganho", lost: "perdido" } as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-xl font-semibold">Configurações e integrações</h1>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">1. WhatsApp (Evolution API)</h2>
        <p className="text-sm text-muted">
          Na instância, configure o webhook com o evento <b>MESSAGES_UPSERT</b> e base64 desligado:
        </p>
        <Code>{`${base}/api/webhooks/evolution?secret=SEU_WEBHOOK_SECRET`}</Code>
        <p className="text-sm text-muted">Ou pela API da Evolution (v2):</p>
        <Code>{`curl -X POST "https://SUA-EVOLUTION/webhook/set/NOME_DA_INSTANCIA" \\
  -H "apikey: SUA_APIKEY" -H "Content-Type: application/json" \\
  -d '{
    "webhook": {
      "enabled": true,
      "url": "${base}/api/webhooks/evolution?secret=SEU_WEBHOOK_SECRET",
      "byEvents": false,
      "base64": false,
      "events": ["MESSAGES_UPSERT"]
    }
  }'`}</Code>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">2. Formulários do site</h2>
        <p className="text-sm text-muted">
          Envie <code>POST</code> em JSON ou form-urlencoded. Campos aceitos: <code>nome/name</code>,{" "}
          <code>telefone/whatsapp/phone</code>, <code>email</code>, <code>mensagem</code>, <code>utm_*</code>,{" "}
          <code>gclid</code>, <code>gbraid</code>, <code>wbraid</code>, <code>fbclid</code>, <code>landing_page</code>.
        </p>
        <p className="text-sm text-muted">
          De servidor (Zapier, Make, RD Station, Elementor) mande o segredo no header{" "}
          <code>X-Webhook-Secret</code>. Direto do navegador, basta o domínio estar em <code>ALLOWED_ORIGINS</code>.
        </p>
        <Code>{`curl -X POST "${base}/api/webhooks/form" \\
  -H "X-Webhook-Secret: SEU_WEBHOOK_SECRET" -H "Content-Type: application/json" \\
  -d '{"nome":"Maria","telefone":"(11) 98888-7777","utm_source":"google","utm_medium":"cpc","gclid":"Cj0KCQ..."}'`}</Code>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">3. Rastreamento do site (GCLID no WhatsApp)</h2>
        <p className="text-sm text-muted">
          Cole antes do <code>&lt;/body&gt;</code> do site. O script guarda UTMs e GCLID da visita, preenche
          campos ocultos dos formulários e adiciona um código como <code>[#A1B2C3]</code> na mensagem dos links{" "}
          <code>wa.me</code>. Quando a mensagem chega pela Evolution, o CRM liga a conversa ao clique do anúncio.
        </p>
        <Code>{`<script src="${base}/tracker.js" data-message="Olá! Vim pelo site." defer></script>`}</Code>
        <p className="text-sm text-muted">
          Em formulários, adicione <code>data-crm</code> na tag <code>&lt;form&gt;</code> para o script criar os campos
          ocultos sozinho.
        </p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">4. Conversões offline no Google Ads</h2>
        <p className="text-sm text-muted">
          Leads com GCLID que entram numa etapa do tipo <b>ganho</b> viram conversão. Baixe o CSV e importe em
          Metas &gt; Conversões &gt; Uploads (use o mesmo nome da ação de conversão criada no Google Ads).
        </p>
        <a href="/api/export/google-ads?name=Venda%20WhatsApp" className="btn">
          Baixar CSV (últimos 90 dias)
        </a>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Etapas do funil</h2>
        <p className="text-sm text-muted">
          Edite nome, ordem (<code>position</code>), cor e tipo na tabela <code>stages</code> do Supabase.
        </p>
        <ul className="divide-y divide-line text-sm">
          {stages.map((stage) => (
            <li key={stage.id} className="flex items-center gap-2 py-2">
              <span className={`h-2 w-2 rounded-full ${stageColor(stage.color).dot}`} />
              <span className="flex-1">{stage.name}</span>
              <span className="text-xs text-faint">{kindLabel[stage.kind]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Últimos webhooks recebidos</h2>
        <ul className="divide-y divide-line text-sm">
          {(events ?? []).map((event) => (
            <li key={event.id} className="flex flex-wrap items-center gap-x-3 py-2">
              <span className="w-20 font-mono text-xs text-muted">{event.source}</span>
              <span className="flex-1 font-mono text-xs">{event.event}</span>
              {event.error && <span className="text-xs text-rose-400">{event.error}</span>}
              <span className="text-xs text-faint">{formatDateTime(event.created_at)}</span>
            </li>
          ))}
          {(events ?? []).length === 0 && <li className="py-2 text-faint">Nenhum webhook ainda.</li>}
        </ul>
      </section>
    </div>
  );
}

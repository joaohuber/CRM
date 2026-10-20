import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractRef, parseEvolutionPayload, type EvolutionMessage } from "@/lib/evolution";
import { findLeadByPhone, logActivity, upsertLead } from "@/lib/leads";
import { ATTRIBUTION_FIELDS, type Attribution } from "@/lib/types";
import { hasValidSecret, logWebhook } from "@/lib/webhook";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Webhook da Evolution API.
 * URL: /api/webhooks/evolution?secret=WEBHOOK_SECRET
 * O catch-all aceita também /api/webhooks/evolution/messages-upsert ("Webhook by Events"),
 * mas aí o segredo precisa ir no header X-Webhook-Secret.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ event?: string[] }> }) {
  if (!hasValidSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const { event: pathEvent } = await ctx.params;
  const parsed = parseEvolutionPayload(body, pathEvent?.join("/"));
  const db = createAdminClient();

  if (parsed.event !== "messages.upsert") {
    return NextResponse.json({ ok: true, ignored: parsed.event || "sem evento" });
  }

  try {
    const results = [];
    for (const message of parsed.messages) {
      results.push(await handleMessage(db, message));
    }
    await logWebhook(db, "evolution", parsed.event, body);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logWebhook(db, "evolution", parsed.event, body, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleMessage(db: SupabaseClient, msg: EvolutionMessage) {
  const metadata = {
    instance: msg.instance,
    messageType: msg.messageType,
    ...(msg.adReply ? { adReply: msg.adReply } : {}),
  };

  // Mensagem enviada pela equipe: só registra se o lead já existe.
  if (msg.fromMe) {
    const lead = await findLeadByPhone(db, msg.phone);
    if (!lead) return { phone: msg.phone, skipped: "fromMe sem lead" };
    if (msg.text) {
      await db.from("leads").update({ last_message_at: msg.at }).eq("id", lead.id);
      await logActivity(db, lead.id, "message_out", msg.text, metadata, msg.messageId);
    }
    return { phone: msg.phone, lead: lead.id, direction: "out" };
  }

  // 1) Código do tracker.js na mensagem -> recupera GCLID/UTMs do clique no site
  const ref = extractRef(msg.text);
  let attribution: Attribution | undefined;
  if (ref) {
    const { data: click } = await db.from("tracking_clicks").select("*").eq("ref", ref).maybeSingle();
    if (click) {
      attribution = {};
      for (const field of ATTRIBUTION_FIELDS) attribution[field] = click[field] ?? null;
    }
  }

  // 2) Anúncio de clique para WhatsApp (Meta)
  if (!attribution && msg.adReply) {
    attribution = {
      utm_source: "meta",
      utm_medium: "ctwa",
      utm_campaign: msg.adReply.title,
      utm_content: msg.adReply.sourceId,
      landing_page: msg.adReply.sourceUrl,
    };
  }

  const { lead, created } = await upsertLead(db, {
    channel: "whatsapp",
    name: msg.pushName,
    phone: msg.phone,
    message: msg.text,
    direction: "in",
    attribution,
    metadata: { ...metadata, ...(ref ? { ref } : {}) },
    externalId: msg.messageId,
    at: msg.at,
  });

  if (ref) {
    await db.from("tracking_clicks").update({ lead_id: lead.id }).eq("ref", ref).is("lead_id", null);
  }

  return { phone: msg.phone, lead: lead.id, created, ref };
}

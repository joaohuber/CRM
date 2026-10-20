import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Aceita o segredo no header X-Webhook-Secret, em Authorization: Bearer, ou em ?secret= */
export function hasValidSecret(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const provided =
    req.headers.get("x-webhook-secret") ?? bearer ?? req.nextUrl.searchParams.get("secret");
  return Boolean(provided) && safeEqual(provided!, secret);
}

export function allowedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const list = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return list.includes("*") || list.includes(origin) ? origin : null;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret",
    Vary: "Origin",
  };
}

/** Lê JSON, x-www-form-urlencoded ou multipart. */
export async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data") || contentType.includes("x-www-form-urlencoded")) {
      const form = await req.formData();
      const out: Record<string, unknown> = {};
      form.forEach((value, key) => {
        if (typeof value === "string") out[key] = value;
      });
      return out;
    }
    const text = await req.text();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return Object.fromEntries(new URLSearchParams(text));
    }
  } catch {
    return null;
  }
}

/** Guarda o payload bruto para debug (tela Configurações). Nunca falha o webhook. */
export async function logWebhook(
  db: SupabaseClient,
  source: string,
  event: string | null,
  payload: unknown,
  error?: string,
) {
  try {
    const size = JSON.stringify(payload ?? null).length;
    await db.from("webhook_events").insert({
      source,
      event,
      payload: size > 100_000 ? { truncated: true, size } : payload,
      error: error ?? null,
    });
  } catch {
    // ignora
  }
}

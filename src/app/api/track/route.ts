import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractAttribution, toFieldMap } from "@/lib/payload";
import { allowedOrigin, corsHeaders } from "@/lib/webhook";

export const runtime = "nodejs";

/**
 * Recebe o clique no botão de WhatsApp do site (enviado pelo /tracker.js via sendBeacon).
 * Guarda UTMs/GCLID sob um código curto que vai junto na mensagem do WhatsApp.
 */
export async function POST(req: NextRequest) {
  const origin = allowedOrigin(req);
  const headers = corsHeaders(origin);
  if (!origin) return NextResponse.json({ error: "origem não permitida" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    // sendBeacon envia text/plain para evitar preflight de CORS
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400, headers });
  }

  const ref = String(body.ref ?? "").toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(ref)) {
    return NextResponse.json({ error: "ref inválido" }, { status: 400, headers });
  }

  const db = createAdminClient();
  const { error } = await db.from("tracking_clicks").upsert(
    {
      ref,
      ...extractAttribution(toFieldMap(body)),
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    },
    { onConflict: "ref" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
  return new NextResponse(null, { status: 204, headers });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(allowedOrigin(req)) });
}

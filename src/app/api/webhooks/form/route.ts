import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadInputError, upsertLead } from "@/lib/leads";
import { extractAttribution, pick, toFieldMap } from "@/lib/payload";
import { allowedOrigin, corsHeaders, hasValidSecret, logWebhook, readBody } from "@/lib/webhook";

export const runtime = "nodejs";

/**
 * Recebe leads de formulários.
 * - Servidor -> servidor (Zapier, Make, RD, Elementor webhook): envie o WEBHOOK_SECRET.
 * - Direto do navegador: a origem precisa estar em ALLOWED_ORIGINS (sem segredo).
 */
export async function POST(req: NextRequest) {
  const origin = allowedOrigin(req);
  const headers = corsHeaders(origin);

  if (!hasValidSecret(req) && !origin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }

  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "corpo inválido" }, { status: 400, headers });

  const fields = toFieldMap(body);

  // Honeypot: bots preenchem campos escondidos. Fingimos sucesso.
  if (pick(fields, ["_hp", "_honeypot", "website_url"])) {
    return NextResponse.json({ ok: true }, { headers });
  }

  const firstName = pick(fields, ["first_name", "firstname", "primeiro_nome"]);
  const lastName = pick(fields, ["last_name", "lastname", "sobrenome"]);
  const name =
    pick(fields, ["name", "nome", "full_name", "fullname", "nome_completo", "seu_nome"]) ??
    ([firstName, lastName].filter(Boolean).join(" ") || null);

  const db = createAdminClient();

  try {
    const { lead, created } = await upsertLead(db, {
      channel: "form",
      name,
      phone: pick(fields, ["phone", "telefone", "whatsapp", "celular", "tel", "phone_number", "fone"]),
      email: pick(fields, ["email", "e_mail", "your_email"]),
      message: pick(fields, ["message", "mensagem", "msg", "comments", "comentario", "observacao"]),
      attribution: extractAttribution(fields),
      metadata: { form: pick(fields, ["form_name", "form_id", "formulario"]) },
    });

    await logWebhook(db, "form", created ? "lead.created" : "lead.updated", body);

    // Formulário HTML comum (sem fetch): redireciona para a página de obrigado.
    const redirectTo = pick(fields, ["_redirect", "redirect", "redirect_url"]);
    if (redirectTo) {
      try {
        const target = new URL(redirectTo);
        const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim());
        if (allowed.includes(target.origin)) return NextResponse.redirect(target, 303);
      } catch {
        // ignora redirect inválido
      }
    }

    return NextResponse.json({ ok: true, id: lead.id, created }, { status: created ? 201 : 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logWebhook(db, "form", "error", body, message);
    const status = error instanceof LeadInputError ? 422 : 500;
    return NextResponse.json({ error: message }, { status, headers });
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(allowedOrigin(req)) });
}

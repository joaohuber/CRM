import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * CSV de conversões offline para importar no Google Ads
 * (Metas > Conversões > Importar > Cliques).
 * Exporta leads com GCLID que foram movidos para uma etapa "ganho".
 *
 * Query: ?name=Venda%20WhatsApp&days=90
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conversionName = req.nextUrl.searchParams.get("name") || "Venda WhatsApp";
  const days = Math.min(Number(req.nextUrl.searchParams.get("days")) || 90, 90);
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const { data, error } = await supabase
    .from("leads")
    .select("gclid, value, won_at")
    .not("gclid", "is", null)
    .not("won_at", "is", null)
    .gte("won_at", since)
    .order("won_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const toGoogleTime = (iso: string) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
  };
  const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

  const lines = [
    "Parameters:TimeZone=America/Sao_Paulo",
    "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
    ...(data ?? []).map((row) =>
      [
        csvCell(row.gclid as string),
        csvCell(conversionName),
        toGoogleTime(row.won_at as string),
        row.value != null ? Number(row.value).toFixed(2) : "",
        "BRL",
      ].join(","),
    ),
  ];

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="conversoes-google-ads-${date}.csv"`,
    },
  });
}

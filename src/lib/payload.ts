import { ATTRIBUTION_FIELDS, type Attribution, type AttributionField } from "./types";

export type FieldMap = Map<string, string>;

/** Normaliza nomes de campo: "Form_Fields[Telefone]" -> "telefone", "utm-source" -> "utm_source". */
function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/^(form_fields|fields|data)\[(.+)\]$/, "$2")
    .replace(/[\s-]+/g, "_");
}

/**
 * Achata o corpo do webhook (um nível de objetos aninhados) num mapa
 * chave-normalizada -> texto. Aceita payloads de Elementor, RD, Typeform etc.
 */
export function toFieldMap(body: unknown): FieldMap {
  const map: FieldMap = new Map();
  const visit = (obj: Record<string, unknown>, depth: number, prefix: string) => {
    for (const [rawKey, value] of Object.entries(obj)) {
      if (value == null) continue;
      if (typeof value === "object" && !Array.isArray(value) && depth < 2) {
        // { utm: { source: "google" } } vira utm_source
        const nested = normalizeKey(rawKey);
        visit(value as Record<string, unknown>, depth + 1, nested === "utm" || nested === "utms" ? "utm_" : "");
        continue;
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        let key = normalizeKey(rawKey);
        if (prefix && !key.startsWith(prefix)) key = prefix + key;
        const text = String(value).trim();
        if (text && !map.has(key)) map.set(key, text);
      }
    }
  };
  if (body && typeof body === "object") visit(body as Record<string, unknown>, 0, "");
  return map;
}

export function pick(map: FieldMap, aliases: string[]): string | null {
  for (const alias of aliases) {
    const value = map.get(alias);
    if (value) return value;
  }
  return null;
}

const ATTRIBUTION_ALIASES: Record<AttributionField, string[]> = {
  utm_source: ["utm_source"],
  utm_medium: ["utm_medium"],
  utm_campaign: ["utm_campaign"],
  utm_term: ["utm_term", "keyword"],
  utm_content: ["utm_content"],
  gclid: ["gclid"],
  gbraid: ["gbraid"],
  wbraid: ["wbraid"],
  fbclid: ["fbclid"],
  landing_page: ["landing_page", "page_url", "pageurl", "url", "page", "source_url"],
  referrer: ["referrer", "referer"],
};

const URL_PARAM_FIELDS: AttributionField[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
];

/** Extrai UTMs/GCLID dos campos e, se faltar algo, da query string da landing page. */
export function extractAttribution(map: FieldMap): Attribution {
  const out: Attribution = {};
  for (const field of ATTRIBUTION_FIELDS) {
    const value = pick(map, ATTRIBUTION_ALIASES[field]);
    if (value) out[field] = value.slice(0, 1000);
  }
  if (out.landing_page) {
    try {
      const url = new URL(out.landing_page);
      for (const field of URL_PARAM_FIELDS) {
        const value = url.searchParams.get(field);
        if (!out[field] && value) out[field] = value.slice(0, 1000);
      }
    } catch {
      // landing_page não é uma URL válida; mantém como texto
    }
  }
  return out;
}

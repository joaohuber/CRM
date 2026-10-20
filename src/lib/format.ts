import type { LeadChannel } from "./types";

export function formatPhone(phone?: string | null): string {
  if (!phone) return "";
  if (phone.startsWith("55") && (phone.length === 12 || phone.length === 13)) {
    const ddd = phone.slice(2, 4);
    const num = phone.slice(4);
    const split = num.length === 9 ? 5 : 4;
    return `(${ddd}) ${num.slice(0, split)}-${num.slice(split)}`;
  }
  return "+" + phone;
}

export function whatsappUrl(phone: string, text?: string): string {
  const base = `https://wa.me/${phone}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatCurrency(value?: number | null): string {
  return value == null ? "" : brl.format(Number(value));
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
export function formatDateTime(iso?: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : "";
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "agora";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), "day");
  return formatDateTime(iso);
}

export type OriginTone = "google" | "meta" | "other" | "none";

export function originOf(lead: {
  channel: LeadChannel;
  utm_source: string | null;
  utm_medium: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
}): { label: string; tone: OriginTone } {
  if (lead.gclid || lead.gbraid || lead.wbraid) return { label: "Google Ads", tone: "google" };

  const source = lead.utm_source?.toLowerCase() ?? "";
  const medium = lead.utm_medium?.toLowerCase() ?? "";
  const paid = /cpc|ppc|paid|ads|ctwa/.test(medium);
  if (lead.fbclid || (paid && /facebook|instagram|meta|^fb$|^ig$/.test(source))) {
    return { label: "Meta Ads", tone: "meta" };
  }
  if (source === "google" && paid) return { label: "Google Ads", tone: "google" };
  if (lead.utm_source) return { label: lead.utm_source, tone: "other" };

  const fallback: Record<LeadChannel, string> = {
    whatsapp: "WhatsApp direto",
    form: "Formulário",
    manual: "Manual",
  };
  return { label: fallback[lead.channel], tone: "none" };
}

export const ORIGIN_CLASSES: Record<OriginTone, string> = {
  google: "bg-brand-blue/15 text-brand-cyan ring-brand-sky/40",
  meta: "bg-violet-500/15 text-violet-300 ring-violet-400/40",
  other: "bg-raised text-fg ring-line-strong",
  none: "bg-transparent text-muted ring-line-strong",
};

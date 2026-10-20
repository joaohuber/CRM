export type StageKind = "open" | "won" | "lost";
export type LeadChannel = "manual" | "form" | "whatsapp";
export type ActivityKind =
  | "created"
  | "form"
  | "message_in"
  | "message_out"
  | "stage_change"
  | "note"
  | "attribution";

export const ATTRIBUTION_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "landing_page",
  "referrer",
] as const;

export type AttributionField = (typeof ATTRIBUTION_FIELDS)[number];
export type Attribution = Partial<Record<AttributionField, string | null>>;

export interface Stage {
  id: string;
  name: string;
  position: number;
  color: string;
  kind: StageKind;
}

export interface Lead extends Record<AttributionField, string | null> {
  id: string;
  name: string | null;
  phone: string | null;
  phone_key: string | null;
  email: string | null;
  stage_id: string | null;
  value: number | null;
  notes: string | null;
  channel: LeadChannel;
  has_google_click: boolean;
  first_message: string | null;
  last_message_at: string | null;
  won_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadSummary = Pick<
  Lead,
  | "id"
  | "name"
  | "phone"
  | "stage_id"
  | "value"
  | "channel"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "gclid"
  | "gbraid"
  | "wbraid"
  | "fbclid"
  | "first_message"
  | "last_message_at"
  | "created_at"
>;

export interface LeadActivity {
  id: string;
  lead_id: string;
  kind: ActivityKind;
  content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

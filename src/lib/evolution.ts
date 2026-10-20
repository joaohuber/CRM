/**
 * Parser do webhook da Evolution API (v1 e v2), evento MESSAGES_UPSERT.
 * Docs: https://doc.evolution-api.com
 */

export interface EvolutionMessage {
  phone: string;
  pushName: string | null;
  text: string | null;
  fromMe: boolean;
  messageId: string | null;
  messageType: string | null;
  at: string;
  instance: string | null;
  /** Presente quando a conversa veio de anúncio "clique para WhatsApp" (Meta). */
  adReply: { title: string | null; sourceId: string | null; sourceUrl: string | null } | null;
}

type Obj = Record<string, any>; // payload externo, formato varia entre versões

/** "MESSAGES_UPSERT", "messages.upsert" ou "/messages-upsert" -> "messages.upsert" */
export function normalizeEvent(raw: unknown): string {
  return String(raw ?? "")
    .replace(/^\/+/, "")
    .toLowerCase()
    .replace(/[_-]/g, ".");
}

/** Extrai o número de um JID, ignorando grupos, status e JIDs @lid sem número alternativo. */
function phoneFromKey(key: Obj): string | null {
  const remote = String(key.remoteJid ?? "");
  if (remote.endsWith("@g.us") || remote.endsWith("@broadcast") || remote.endsWith("@newsletter")) {
    return null;
  }
  const candidates = [key.remoteJid, key.remoteJidAlt, key.senderPn, key.participantAlt];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.endsWith("@s.whatsapp.net")) {
      return candidate.split("@")[0].split(":")[0];
    }
  }
  return null;
}

function unwrap(message: Obj | null | undefined): Obj | null {
  let m = message ?? null;
  for (let i = 0; i < 3 && m; i++) {
    const inner =
      m.ephemeralMessage?.message ??
      m.viewOnceMessage?.message ??
      m.viewOnceMessageV2?.message ??
      m.documentWithCaptionMessage?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

function textOf(m: Obj | null): string | null {
  if (!m) return null;
  const text =
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title ??
    m.templateButtonReplyMessage?.selectedDisplayText;
  if (typeof text === "string" && text.trim()) return text;

  if (m.audioMessage) return "[áudio]";
  if (m.imageMessage) return "[imagem]";
  if (m.videoMessage) return "[vídeo]";
  if (m.documentMessage) return "[documento]";
  if (m.stickerMessage) return "[figurinha]";
  if (m.locationMessage) return "[localização]";
  if (m.contactMessage || m.contactsArrayMessage) return "[contato]";
  return null;
}

function timestampOf(raw: unknown): string {
  const value = Number((raw as Obj)?.low ?? raw);
  if (!Number.isFinite(value) || value <= 0) return new Date().toISOString();
  return new Date(value < 1e12 ? value * 1000 : value).toISOString();
}

export function parseEvolutionPayload(
  body: Obj,
  pathEvent?: string,
): { event: string; instance: string | null; messages: EvolutionMessage[] } {
  const event = normalizeEvent(body?.event ?? pathEvent);
  const instance = typeof body?.instance === "string" ? body.instance : null;

  const data = body?.data;
  const items: Obj[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.messages)
      ? data.messages
      : data
        ? [data]
        : [];

  const messages: EvolutionMessage[] = [];
  for (const item of items) {
    const key: Obj = item?.key ?? {};
    const phone = phoneFromKey(key);
    if (!phone) continue;

    const message = unwrap(item.message);
    const contextInfo: Obj | undefined =
      item.contextInfo ??
      message?.extendedTextMessage?.contextInfo ??
      message?.imageMessage?.contextInfo ??
      message?.videoMessage?.contextInfo;
    const ad: Obj | undefined = contextInfo?.externalAdReply;

    messages.push({
      phone,
      pushName: typeof item.pushName === "string" && item.pushName.trim() ? item.pushName.trim() : null,
      text: textOf(message),
      fromMe: Boolean(key.fromMe),
      messageId: typeof key.id === "string" ? key.id : null,
      messageType: typeof item.messageType === "string" ? item.messageType : null,
      at: timestampOf(item.messageTimestamp),
      instance,
      adReply: ad
        ? {
            title: ad.title ?? null,
            sourceId: ad.sourceId ?? null,
            sourceUrl: ad.sourceUrl ?? null,
          }
        : null,
    });
  }

  return { event, instance, messages };
}

/** Código gerado pelo tracker.js e anexado à mensagem: "Olá! [#A1B2C3]" */
export function extractRef(text: string | null): string | null {
  const match = text?.match(/\[#([A-Z0-9]{6})\]/);
  return match ? match[1] : null;
}

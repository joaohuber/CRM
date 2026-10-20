/**
 * Normaliza para só dígitos com DDI. Números brasileiros sem DDI
 * (10 ou 11 dígitos: DDD + número) recebem 55 na frente.
 */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/**
 * Chave de deduplicação. O WhatsApp de contas brasileiras antigas chega
 * sem o 9º dígito (55 11 8888-7777), enquanto o formulário traz com ele
 * (55 11 98888-7777). Usamos DDI + DDD + últimos 8 dígitos para casar os dois.
 */
export function phoneKey(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.startsWith("55") && (phone.length === 12 || phone.length === 13)) {
    return "55" + phone.slice(2, 4) + phone.slice(-8);
  }
  return phone;
}

/**
 * movimenta7 — single source of truth for "this field is private" (D5/ADR-0004).
 *
 * Shared by the CI gate (valida_snapshot.mjs) and the moderation step
 * (publicar_snapshot.mjs) so the two can never disagree about what is private.
 *
 * Matching is TOKEN-based, not substring-based. A plain substring regex made
 * the short tokens ("rg", "cpf") match innocent field names — "organizacao"
 * contains "rg" — which failed the build on legitimate public data. Splitting
 * the key into words first keeps short tokens meaningful.
 */

const FORBIDDEN_TOKENS = new Set([
  "telefone", "telefones", "fone", "celular", "whatsapp", "zap",
  "email", "emails", "mail", "cpf", "rg", "nascimento",
  "responsavel", "pessoal", "pessoais", "endereco",
]);

// "61 99999-0000" · "(61)99999-0000" · "+55 61 9 9999 0000" …
export const PHONE_LIKE = /(\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\s?\d{4}[\s.-]?\d{4}/;

/** Splits a field name into lowercase, accent-free words (snake_case and camelCase). */
export function keyTokens(key) {
  return String(key ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True when the field name names private data and must never be published. */
export function isPrivateKey(key) {
  return keyTokens(key).some((t) => FORBIDDEN_TOKENS.has(t));
}

/**
 * True when a value looks like a phone number in a field that is not the one
 * the organizer explicitly marked as public.
 */
export function looksLikePhone(key, value) {
  return key !== "contato" && typeof value === "string" && PHONE_LIKE.test(value);
}

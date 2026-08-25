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
// The host allowlist lives in js/util.js so the browser and the build enforce
// the SAME rule from the same lines — the drift that this file's own history
// warns about (two copies of the public-field list) is not worth repeating.
import { linkMapa, linkRedeSocial } from "../js/util.js";

/**
 * ALLOWLIST — the primary control (Camada 5 do veredito de 24/08/2026).
 *
 * A denylist only stops the private fields we thought of; anything we failed to
 * imagine ships. This set is the inverse: a key that is not listed here never
 * reaches the public snapshot, whatever it is called. publicar_snapshot.mjs
 * already enforced its own private copy of this list — the CI gate did not, so
 * the two could drift. One list, both consumers.
 *
 * The denylist below stays as a SECOND layer: it names the private fields
 * explicitly, so an accidental widening of this allowlist still fails loudly.
 */
export const CAMPOS_PUBLICOS = new Set([
  "grupo", "organizacao", "regiao", "modalidades", "dias",
  "horario", "local", "rede_social", "mapa", "orientacao_profissional",
  "custo", "publico", "lat", "lon",
]);

/**
 * The two fields that are SUPPOSED to hold a link (ADR-0006). "contato" used to
 * be the single one and accepted any http(s) destination, WhatsApp included;
 * the owner replaced it on 25/08/2026 with the church's social profile and a
 * map link, and no personal channel at all.
 *
 * They are listed separately because the checks below treat them differently
 * from free text: a link here is normal and gets checked against a host
 * allowlist, while a link anywhere else is a red flag.
 */
export const CAMPOS_DE_LINK = new Set(["rede_social", "mapa"]);

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
 * True when a value looks like a phone number.
 *
 * There used to be a `key !== "contato"` carve-out here, which meant a personal
 * phone published as the group's public contact walked straight through the one
 * check that existed for it — including in "wa.me/5561..." form, where the
 * number is the URL. A personal phone is private data wherever it is written
 * (ADR-0004), so the field it sits in does not buy it an exemption.
 *
 * The one exemption that IS sound is the pair of link fields, and it rests on a
 * different guarantee than the old one did: their value is never free text.
 * The ingest rewrites them to a URL on an allowlisted host or drops them, and
 * linkNaoPermitido() below fails the build if anything else ever appears there.
 * A phone number cannot survive that, while digit soup that merely LOOKS like
 * one can — a Google Maps URL is full of coordinates and place ids, and an
 * Instagram handle may legitimately be digits.
 */
export function looksLikePhone(key, value) {
  if (CAMPOS_DE_LINK.has(key)) return false;
  return typeof value === "string" && PHONE_LIKE.test(value);
}

// ---------- value-level rejecters ----------
// Until now the only check against a VALUE was PHONE_LIKE: FORBIDDEN_TOKENS
// matches the name of a key and never its content, so an e-mail or a CPF typed
// into "local" was published verbatim. These run in microseconds and carry no
// list to maintain.

export const EMAIL_LIKE = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const URL_LIKE = /\b(https?:\/\/|www\.)\S+/i;

/** True when a value contains an e-mail address. */
export function looksLikeEmail(key, value) {
  if (CAMPOS_DE_LINK.has(key)) return false; // see looksLikePhone
  return typeof value === "string" && EMAIL_LIKE.test(value);
}

/**
 * True when a value carries a link in a field that is not meant to hold one.
 * The two link fields are links by design; a URL smuggled into a group name or
 * a place name is either an attempt to publish an unvetted destination or a
 * mistake. Now that publication is automatic, it is the former that matters:
 * this is the check that stops "Caminhada 6h https://premio-falso.example"
 * from reaching the map inside the group's NAME, where no allowlist looks.
 */
export function looksLikeUrlOutsideLinkFields(key, value) {
  return !CAMPOS_DE_LINK.has(key) && typeof value === "string" && URL_LIKE.test(value);
}

/**
 * True when one of the two link fields holds something that is not an
 * allowlisted destination (js/util.js: HOSTS_REDE_SOCIAL / HOSTS_MAPA).
 *
 * This is a backstop against OUR OWN code, not against the public: the ingest
 * already normalizes both fields to a validated URL or drops them, so a hit
 * here means the ingest was bypassed or a snapshot was hand-edited. It stays
 * fail-closed for exactly that reason.
 */
export function linkNaoPermitido(key, value) {
  if (!CAMPOS_DE_LINK.has(key)) return false;
  const v = String(value ?? "").trim();
  if (!v) return false;
  return key === "rede_social" ? !linkRedeSocial(v).url : !linkMapa(v);
}

/** Mod-11 check digits for CPF (11 digits). */
function isCPF(d) {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Mod-11 check digits for CNPJ (14 digits). */
function isCNPJ(d) {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (len) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

/**
 * True when a value contains a document number whose CHECK DIGITS are valid.
 * Validating mod-11 instead of "11 digits in a row" is what keeps this from
 * firing on a phone number, a date or a CEP: a random digit string passes
 * mod-11 about 1% of the time, so a hit here is almost never a coincidence.
 */
export function looksLikeDocument(key, value) {
  if (CAMPOS_DE_LINK.has(key)) return false; // see looksLikePhone
  if (typeof value !== "string") return false;
  for (const m of String(value).matchAll(/\d[\d.\-/]{9,17}\d/g)) {
    const d = m[0].replace(/\D/g, "");
    for (let i = 0; i + 11 <= d.length; i++) if (isCPF(d.slice(i, i + 11))) return true;
    for (let i = 0; i + 14 <= d.length; i++) if (isCNPJ(d.slice(i, i + 14))) return true;
  }
  return false;
}

/**
 * Every value-level privacy check, with the message the owner will read.
 * A hit in ANY of these is a PRIVACY-class failure: it aborts the whole build.
 */
export const CHECAGENS_DE_VALOR = [
  { teste: looksLikePhone, motivo: "valor com cara de telefone" },
  { teste: looksLikeEmail, motivo: "valor com cara de e-mail" },
  { teste: looksLikeDocument, motivo: "valor com cara de CPF/CNPJ (digito verificador confere)" },
  { teste: looksLikeUrlOutsideLinkFields, motivo: "link fora dos campos de rede social/mapa" },
  { teste: linkNaoPermitido, motivo: "link para um destino que nao esta na lista permitida" },
];

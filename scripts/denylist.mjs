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
import {
  dadosPessoaisEmUrlMapa, EMAIL_LIKE, linkMapa, linkRedeSocial, PHONE_LIKE,
  textoTemDocumento,
} from "../js/util.js";

// Kept as public exports for callers/tests that use the privacy primitives from
// this policy module; their implementation is shared with the URL normalizer.
export { EMAIL_LIKE, PHONE_LIKE };

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
  "custo", "publico", "lat", "lon", "posicao",
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
 * Link fields need format-aware checks rather than a blanket exemption. A Maps
 * coordinate is valid digit soup, but a phone hidden in q=/path/hash is still
 * private; dadosPessoaisEmUrlMapa distinguishes those cases. Social identifiers
 * are checked and canonicalized by linkRedeSocial before reaching this gate.
 */
export function looksLikePhone(key, value) {
  if (key === "mapa") return dadosPessoaisEmUrlMapa(value).telefone;
  if (key === "rede_social") return false;
  return typeof value === "string" && PHONE_LIKE.test(value);
}

// ---------- value-level rejecters ----------
// Until now the only check against a VALUE was PHONE_LIKE: FORBIDDEN_TOKENS
// matches the name of a key and never its content, so an e-mail or a CPF typed
// into "local" was published verbatim. These run in microseconds and carry no
// list to maintain.

const URL_LIKE = /\b(https?:\/\/|www\.)\S+/i;

/** True when a value contains an e-mail address. */
export function looksLikeEmail(key, value) {
  if (key === "mapa") return dadosPessoaisEmUrlMapa(value).email;
  if (key === "rede_social") return false; // normalized by linkRedeSocial
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
  const normalizado = key === "rede_social" ? linkRedeSocial(v).url : linkMapa(v);
  // The publisher must receive the canonical form the ingest would store. This
  // catches a hand-edited snapshot that still carries a stripped query/hash.
  return !normalizado || normalizado !== v;
}

/**
 * True when a value contains a document number whose CHECK DIGITS are valid.
 * Validating mod-11 instead of "11 digits in a row" is what keeps this from
 * firing on a phone number, a date or a CEP: a random digit string passes
 * mod-11 about 1% of the time, so a hit here is almost never a coincidence.
 */
export function looksLikeDocument(key, value) {
  if (key === "mapa") return dadosPessoaisEmUrlMapa(value).documento;
  if (key === "rede_social") return false; // normalized by linkRedeSocial
  return textoTemDocumento(value);
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

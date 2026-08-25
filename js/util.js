/* Pure helpers, covered by tests/util.test.mjs.
   Security invariant (ADR-0004): every data-borne string is cut hard at
   MAX_FIELD chars and only ever reaches the DOM via textContent.

   Since ADR-0006 the site publishes WITHOUT human review, so this file stopped
   being a second opinion after a moderator: it is now the only thing standing
   between a stranger's form answer and a visitor's screen. That is why links
   below are an ALLOWLIST of destinations instead of "any http(s) URL" —
   an unreviewed link is the one field that can send a visitor somewhere
   harmful, and safeUrl() alone accepts every destination on the web. */

export const MAX_FIELD = 120;   // hard cut per field
export const MAX_RECORDS = 500; // anti-flood ceiling: visitors' browsers must not pay for a flooded sheet

// Accepts only ABSOLUTE http(s) URLs — blocks "javascript:" and friends, and
// keeps free text (e.g. "@instagram") from being mistaken for a link.
// Used for the site's OWN links (js/config.js), which are not community data.
export function safeUrl(u) {
  if (!u) return "";
  try {
    const p = new URL(String(u)); // no base: relative input throws → ""
    if (p.protocol === "https:" || p.protocol === "http:") return p.href;
  } catch (e) { /* invalid/relative URL → treated as empty */ }
  return "";
}

/* ---------- link allowlist (ADR-0006) ----------
   The owner's rule for what a group may publish as contact: the church's or
   group's social profile, or a map link for the meeting point. Nothing else.
   These two lists ARE that rule, written once and enforced in three places —
   the browser, the ingest and the CI gate. */

/** Social networks a group may point to. */
export const HOSTS_REDE_SOCIAL = [
  "instagram.com", "facebook.com", "fb.com", "threads.net",
  "youtube.com", "youtu.be", "tiktok.com", "twitter.com", "x.com",
  "strava.com",
];

/* Map services, split by how much of the host is maps.
   DEDICADOS serve nothing but maps, so any path on them is fine — and one of
   them, maps.app.goo.gl, is what the "Compartilhar" button in Google Maps
   actually produces, so this is the format most people will paste.
   COM_CAMINHO are hosts that serve the whole Google catalogue; there the URL
   has to be under /maps or "a Google Maps link" becomes a way to publish any
   Google-hosted page, a Drive file included. */
export const HOSTS_MAPA_DEDICADOS = [
  "maps.google.com", "maps.google.com.br", "maps.app.goo.gl",
  "openstreetmap.org", "osm.org",
];
export const HOSTS_MAPA_COM_CAMINHO = ["google.com", "google.com.br", "goo.gl"];
export const HOSTS_MAPA = [...HOSTS_MAPA_DEDICADOS, ...HOSTS_MAPA_COM_CAMINHO];

/* Exact host, or a subdomain of it. Written as "===" plus endsWith("." + d) on
   purpose: a plain endsWith(d) would also accept
   "instagram.com.exemplo-malicioso.com", which is somebody else's site. */
function hostPermitido(host, dominios) {
  return dominios.some((d) => host === d || host.endsWith("." + d));
}

/** Instagram/TikTok/X handles: letters, digits, dot and underscore. */
const ARROBA = /^@?([A-Za-z0-9._]{1,40})$/;

function comoUrl(v) {
  try {
    const p = new URL(String(v ?? "").trim());
    if (p.protocol !== "https:" && p.protocol !== "http:") return null;
    return p;
  } catch (e) { return null; }
}

/* The handle shown to the reader: "@nome" when we can derive one, otherwise
   the bare host. Like every other string, it reaches the DOM via textContent. */
const COM_ARROBA = ["instagram.com", "tiktok.com", "twitter.com", "x.com", "threads.net"];

function rotuloDe(p) {
  const primeiro = (p.pathname.split("/").filter(Boolean)[0] || "").replace(/^@/, "");
  if (hostPermitido(p.hostname, COM_ARROBA) && ARROBA.test(primeiro)) return "@" + primeiro;
  return p.hostname.replace(/^www\./, "");
}

/**
 * Normalizes the public social contact.
 * Accepts "@handle" (read as Instagram, which is what the form asks for) or a
 * URL on an allowlisted network. Returns { url, rotulo }, with url === "" when
 * the value is not an acceptable destination — the group still publishes, it
 * just publishes without a clickable link. Dropping the link instead of the
 * record matters now that nobody reviews: one bad answer must not delete a
 * real group from the map.
 */
export function linkRedeSocial(v) {
  const bruto = String(v ?? "").trim();
  if (!bruto) return { url: "", rotulo: "" };

  const p = comoUrl(bruto);
  if (p) {
    if (!hostPermitido(p.hostname, HOSTS_REDE_SOCIAL)) return { url: "", rotulo: "" };
    return { url: p.href, rotulo: rotuloDe(p) };
  }

  // Not a URL: the form asks for "@handle", and a good half of people will type
  // it without the @. Accepting both is worth more than the tidiness of
  // requiring one, so the @ is optional here.
  const m = ARROBA.exec(bruto);
  if (!m) return { url: "", rotulo: "" };
  return { url: "https://www.instagram.com/" + m[1], rotulo: "@" + m[1] };
}

/**
 * Normalizes the public map link. Returns "" for anything that is not a map —
 * again dropping the link, never the group.
 *
 * The dedicated hosts are checked FIRST because maps.google.com also ends in
 * ".google.com": testing the broad list first would send it down the /maps
 * path rule and reject a perfectly good link.
 */
export function linkMapa(v) {
  const p = comoUrl(v);
  if (!p) return "";
  if (hostPermitido(p.hostname, HOSTS_MAPA_DEDICADOS)) return p.href;
  if (hostPermitido(p.hostname, HOSTS_MAPA_COM_CAMINHO) && /^\/maps(\/|$|\?)/.test(p.pathname)) return p.href;
  return "";
}

/* Invisible characters that change how text READS without changing what it
   says: bidi overrides (Trojan Source, CVE-2021-42574) can make a popup render
   a different string than the one the moderator approved, and zero-width
   characters split a word so that no filter downstream ever matches it.
   Stripped BEFORE the cut, so they cannot spend the 120-char budget either. */
const INVISIVEIS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function cleanField(v) {
  if (v == null) return "";
  return String(v)
    .normalize("NFC")        // one canonical form, so equal strings compare equal
    .replace(INVISIVEIS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FIELD);
}

/* ---------- pin emoji, by modality ----------
   A pin says WHAT happens there before it is tapped: on a map of the whole DF,
   a screen of identical green dots forces a tap per group just to find out
   whether it is a run or a volleyball game.

   What travels from here to the browser is a SLUG, never an emoji: the glyph
   itself lives in css/style.css (.pin-mov--<slug>), so no emoji is ever written
   into the marker as HTML. Leaflet's L.divIcon renders its `html` option with
   innerHTML, and this project's rule is textContent always, innerHTML never
   (ADR-0004) — a class name keeps that rule intact without an exception for
   "but it is our own string".

   The slug IS the accent-stripped modality, and the set below has to stay equal
   to the options the form offers in scripts/criar_form.gs. Both directions are
   frozen by tests/util.test.mjs: a modality with no pin, and a pin with no CSS
   rule, are the same silent failure — every group drawn with the fallback. */
export const PINS_CONHECIDOS = new Set([
  "corrida", "caminhada", "ciclismo", "volei", "futebol", "funcional", "trilhas", "natacao",
]);
/** Used for "Outra" and for anything the form starts offering before we style it. */
export const PIN_PADRAO = "outra";

const semAcento = (s) => String(s ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Picks the pin for a group: the first modality that has one.
 *
 * Groups check several boxes ("Corrida, Caminhada"), and a pin can only show
 * one thing. First-listed wins because that is the order the form presents, so
 * the choice is at least predictable; the popup still lists every modality.
 */
export function pinModalidade(modalidades) {
  for (const m of Array.isArray(modalidades) ? modalidades : []) {
    const slug = semAcento(m);
    if (PINS_CONHECIDOS.has(slug)) return slug;
  }
  return PIN_PADRAO;
}

/**
 * "há 8 minutos", "há 3 horas", "há 2 dias" — the freshness seal.
 *
 * With publication automatic, a pipeline that quietly stopped working looks
 * exactly like a week where nobody registered. Relative time is used on purpose
 * instead of a clock reading: it needs no timezone to be right, and "há 3 dias"
 * is a sentence a visitor can judge, while "25/08 17:12 UTC" is not.
 * Returns "" when there is no usable timestamp, and the caller shows nothing.
 */
export function descreveIdade(iso, agora = Date.now()) {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return "";
  const min = Math.floor((agora - t) / 60000);
  if (min < 0) return "";           // clock skew: say nothing rather than "há -2 minutos"
  if (min < 2) return "agora mesmo";
  if (min < 60) return `há ${min} minutos`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? "há 1 hora" : `há ${h} horas`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

// Rough DF bounding box (sanity check only; real bounds come from the RA GeoJSON).
function insideDF(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -16.6 && lat <= -15.0 && lon >= -48.8 && lon <= -46.8;
}

/* Normalizes the public snapshot. Accepts both shapes:
   [] (bare list) or { registros: [], atualizado_em: "" }.
   Unknown/private keys are simply never read — they cannot reach the DOM. */
export function parseSnapshot(j) {
  const list = Array.isArray(j) ? j : (j && Array.isArray(j.registros) ? j.registros : []);
  // The cap below is a real ceiling, not a formality: past it the page would
  // show fewer groups than the counter announces. Saying so out loud is the
  // difference between a known limit and a number nobody can explain.
  if (list.length > MAX_RECORDS && typeof console !== "undefined") {
    console.warn(`movimenta7: o snapshot tem ${list.length} registros e o mapa desenha ${MAX_RECORDS}.`);
  }
  const out = [];
  for (const r of list.slice(0, MAX_RECORDS)) {
    if (r == null || typeof r !== "object") continue;
    const lat = Number(r.lat), lon = Number(r.lon);
    const rede = linkRedeSocial(r.rede_social);
    const rec = {
      grupo: cleanField(r.grupo),
      organizacao: cleanField(r.organizacao),
      regiao: cleanField(r.regiao),
      modalidades: (Array.isArray(r.modalidades) ? r.modalidades : [])
        .slice(0, 9).map(cleanField).filter(Boolean),
      dias: (Array.isArray(r.dias) ? r.dias : [])
        .slice(0, 7).map(cleanField).filter(Boolean),
      horario: cleanField(r.horario),
      local: cleanField(r.local),
      custo: cleanField(r.custo),
      publico: (Array.isArray(r.publico) ? r.publico : [])
        .slice(0, 6).map(cleanField).filter(Boolean),
      orientacao_profissional: cleanField(r.orientacao_profissional),
      redeUrl: rede.url,
      redeRotulo: cleanField(rede.rotulo),
      mapaUrl: linkMapa(r.mapa),
      lat: insideDF(lat, lon) ? lat : null,
      lon: insideDF(lat, lon) ? lon : null,
    };
    if (!rec.grupo) continue; // a record without a group name is not renderable
    out.push(rec);
  }
  return out;
}

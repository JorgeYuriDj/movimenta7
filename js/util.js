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
export const MAX_URL = 2048;

// Shared privacy primitives. They live in this browser-safe module because map
// links are normalized here, before denylist.mjs can inspect a public snapshot.
export const PHONE_LIKE = /(?:\+?55[\s./-]?)?\(?\d{2}\)?[\s./-]?9?[\s./-]?\d{4}[\s./-]?\d{4}/;
export const EMAIL_LIKE = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;

function isCPF(d) {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return (r === 10 ? 0 : r) === Number(d[len]);
  };
  return dv(9) && dv(10);
}

function isCNPJ(d) {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (len) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * pesos[i];
    const r = soma % 11;
    return (r < 2 ? 0 : 11 - r) === Number(d[len]);
  };
  return dv(12) && dv(13);
}

/** Valid CPF/CNPJ embedded in ordinary text. */
export function textoTemDocumento(value) {
  if (typeof value !== "string") return false;
  for (const m of value.matchAll(/\d[\d.\-/]{9,17}\d/g)) {
    const d = m[0].replace(/\D/g, "");
    for (let i = 0; i + 11 <= d.length; i++) if (isCPF(d.slice(i, i + 11))) return true;
    for (let i = 0; i + 14 <= d.length; i++) if (isCNPJ(d.slice(i, i + 14))) return true;
  }
  return false;
}

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

/* Exact map hosts exposed as policy metadata. linkMapa applies the path rules:
   Google catalogue hosts require /maps; shorteners require their token shape;
   query/hash payloads are reduced to what a route actually needs. */
export const HOSTS_MAPA_DEDICADOS = [
  "maps.google.com", "maps.google.com.br", "maps.app.goo.gl", "share.google",
  "openstreetmap.org", "www.openstreetmap.org", "osm.org", "www.osm.org",
];
export const HOSTS_MAPA_COM_CAMINHO = [
  "google.com", "www.google.com", "google.com.br", "www.google.com.br", "goo.gl",
];
export const HOSTS_MAPA = [...HOSTS_MAPA_DEDICADOS, ...HOSTS_MAPA_COM_CAMINHO];

/* Social networks use a few service subdomains. The dot boundary matters: a
   plain endsWith(d) would accept instagram.com.exemplo-malicioso.com. Map hosts
   deliberately do NOT use this helper; they are exact below. */
function hostPermitido(host, dominios) {
  return dominios.some((d) => host === d || host.endsWith("." + d));
}

/** Instagram/TikTok/X handles: letters, digits, dot and underscore. */
const ARROBA = /^@?([A-Za-z0-9._]{1,40})$/;

// A social profile is public, but a phone/e-mail hidden in its identifier is
// still personal data. Link fields cannot use the generic digit checks (Maps
// URLs legitimately contain coordinates), so the social boundary owns this
// narrower check. Ten to thirteen phone-like digits covers Brazilian numbers
// with/without country code; shorter numeric club/channel ids remain valid.
function textoDecodificado(v) {
  let atual = String(v ?? "");
  // Two encoded layers are enough to catch accidental double encoding without
  // turning malformed percent text into an exception or an unbounded loop.
  for (let i = 0; i < 2; i++) {
    try {
      const proximo = decodeURIComponent(atual.replace(/\+/g, " "));
      if (proximo === atual) break;
      atual = proximo;
    } catch (e) { break; }
  }
  return atual.normalize("NFKC").replace(INVISIVEIS, "");
}

function identificadorSocialTemDadoPessoal(v) {
  const texto = textoDecodificado(v);
  return PHONE_LIKE.test(texto) || EMAIL_LIKE.test(texto) || textoTemDocumento(texto);
}

function comoUrl(v) {
  try {
    const bruto = String(v ?? "").trim();
    if (!bruto || bruto.length > MAX_URL || TEM_INVISIVEIS.test(bruto)) return null;
    const p = new URL(bruto);
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
 * the value is not an acceptable destination. The ingestion boundary decides
 * what to do with that result; today both a social profile and a route are
 * required, so an empty result quarantines the registration.
 */
export function linkRedeSocial(v) {
  const bruto = String(v ?? "").trim();
  if (!bruto) return { url: "", rotulo: "" };

  const p = comoUrl(bruto);
  if (p) {
    if (!hostPermitido(p.hostname, HOSTS_REDE_SOCIAL)) return { url: "", rotulo: "" };
    if (p.username || p.password || p.port) return { url: "", rotulo: "" };
    if (identificadorSocialTemDadoPessoal(p.pathname)) return { url: "", rotulo: "" };

    // Query strings and fragments are trackers at best and an unnoticed place
    // to carry PII at worst. A public contact needs only the canonical path.
    // Query-dependent Facebook profiles are rejected instead of being turned
    // into the unrelated /profile.php page after canonicalization.
    if (/\/profile\.php\/?$/i.test(p.pathname)) return { url: "", rotulo: "" };
    p.protocol = "https:";
    p.search = "";
    p.hash = "";
    return { url: p.href, rotulo: rotuloDe(p) };
  }

  // Not a URL: the form asks for "@handle", and a good half of people will type
  // it without the @. Accepting both is worth more than the tidiness of
  // requiring one, so the @ is optional here.
  if (identificadorSocialTemDadoPessoal(bruto)) return { url: "", rotulo: "" };
  const m = ARROBA.exec(bruto);
  if (!m) return { url: "", rotulo: "" };
  return { url: "https://www.instagram.com/" + m[1], rotulo: "@" + m[1] };
}

const HOSTS_GOOGLE_MAPS = new Set([
  "google.com", "www.google.com", "maps.google.com",
  "google.com.br", "www.google.com.br", "maps.google.com.br",
]);
const HOSTS_OPENSTREETMAP = new Set([
  "openstreetmap.org", "www.openstreetmap.org", "osm.org", "www.osm.org",
]);
const PARAMETROS_GOOGLE_MAPS = new Set([
  "api", "q", "query", "query_place_id", "ll", "center", "saddr", "daddr",
  "origin", "destination", "waypoints", "travelmode", "dir_action", "layer",
  "zoom", "cid", "ftid", "data", "output", "map_action", "basemap",
]);
const PARAMETROS_OPENSTREETMAP = new Set([
  "mlat", "mlon", "lat", "lon", "zoom", "query", "route", "engine", "from",
  "to", "layers", "m", "bbox", "marker",
]);

function temPortaExplicita(v) {
  const m = /^(?:[a-z][a-z\d+.-]*:)?[\\/]{2}([^/\\?#]*)/i
    .exec(String(v ?? "").trim());
  if (!m) return false;
  const host = m[1].slice(m[1].lastIndexOf("@") + 1);
  return host.startsWith("[") ? host.includes("]:") : host.includes(":");
}

function manterParametros(p, permitidos) {
  const limpos = new URLSearchParams();
  for (const [chave, valor] of p.searchParams) {
    const normalizada = chave.toLowerCase();
    if (permitidos.has(normalizada)) limpos.append(normalizada, valor);
  }
  p.search = limpos.toString();
}

function manterHashOpenStreetMap(p) {
  if (!p.hash) return;
  const partes = p.hash.slice(1).split("&").filter((parte) => {
    const chave = textoDecodificado(parte.split("=", 1)[0]).toLowerCase();
    return chave === "map" || chave === "layers";
  });
  p.hash = partes.length ? "#" + partes.join("&") : "";
}

function numeroEntre(v, min, max) {
  if (!/^-?\d{1,3}(?:\.\d+)?$/.test(String(v))) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max;
}

function parDeCoordenadas(v) {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(String(v));
  return !!m && numeroEntre(m[1], -90, 90) && numeroEntre(m[2], -180, 180);
}

function valorTecnicoDoMapa(chave, valor) {
  const k = String(chave).toLowerCase();
  const v = textoDecodificado(valor).trim();
  if (["mlat", "lat"].includes(k)) return numeroEntre(v, -90, 90);
  if (["mlon", "lon"].includes(k)) return numeroEntre(v, -180, 180);
  if (["ll", "center", "q", "query", "saddr", "daddr", "origin", "destination", "from", "to"].includes(k) &&
      parDeCoordenadas(v)) return true;
  if (k === "marker") return parDeCoordenadas(v);
  if (k === "bbox") {
    const itens = v.split(",");
    return itens.length === 4 && numeroEntre(itens[0], -180, 180) &&
      numeroEntre(itens[1], -90, 90) && numeroEntre(itens[2], -180, 180) &&
      numeroEntre(itens[3], -90, 90);
  }
  if (k === "route") return v.split(";").every(parDeCoordenadas);
  // These are opaque Google place identifiers, not human-entered digit strings.
  if (k === "cid" && /^\d{1,20}$/.test(v)) return true;
  if (["query_place_id", "ftid"].includes(k) &&
      /^(?:place_id:)?(?:ChI|GhI|0x)[A-Za-z0-9_:-]+$/.test(v)) return true;
  return false;
}

function textoDoCaminhoSemCoordenadas(p) {
  return textoDecodificado(p.pathname)
    .replace(/\/(?:node|way|relation|changeset)\/\d+(?=\/|$)/gi, "")
    .replace(/!3d-?\d{1,2}(?:\.\d+)?!4d-?\d{1,3}(?:\.\d+)?/gi, "")
    .replace(/@-?\d{1,2}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?(?:,[^/]*)?/gi, "")
    .replace(/-?\d{1,2}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?/g, "");
}

function textoDoHashSemCoordenadas(hash) {
  return textoDecodificado(String(hash || "").replace(/^#/, ""))
    .replace(/(?:^|&)map=\d+(?:\.\d+)?\/-?\d{1,2}(?:\.\d+)?\/-?\d{1,3}(?:\.\d+)?(?=&|$)/gi, "");
}

const PHONE_LIKE_MAPA = /(?:^|[^\d])(?:\+?55[\s,./-]?)?\(?\d{2}\)?[\s,./-]?9?[\s,./-]?\d{4}[\s,./-]?\d{4}(?!\d)/;

function mapaTemDocumento(texto) {
  for (const m of texto.matchAll(/(?:^|[^\d])(\d[\d.\-/]{9,17}\d)(?=$|[^\d])/g)) {
    const d = m[1].replace(/\D/g, "");
    for (let i = 0; i + 11 <= d.length; i++) if (isCPF(d.slice(i, i + 11))) return true;
    for (let i = 0; i + 14 <= d.length; i++) if (isCNPJ(d.slice(i, i + 14))) return true;
  }
  return false;
}

/** Which privacy class, if any, survives in a map URL's meaningful payload. */
export function dadosPessoaisEmUrlMapa(v) {
  let p;
  try { p = new URL(String(v ?? "")); } catch (e) {
    return { telefone: false, email: false, documento: false };
  }
  const partes = [p.username, p.password, textoDoCaminhoSemCoordenadas(p)];
  for (const [chave, valor] of p.searchParams) {
    if (!valorTecnicoDoMapa(chave, valor)) partes.push(textoDecodificado(chave), textoDecodificado(valor));
  }
  partes.push(textoDoHashSemCoordenadas(p.hash));
  const texto = partes.filter(Boolean).join("\n").normalize("NFKC");
  return {
    telefone: PHONE_LIKE_MAPA.test(texto),
    email: EMAIL_LIKE.test(texto),
    documento: mapaTemDocumento(texto),
  };
}

/**
 * Normalizes the public map link. Returns "" for anything that is not a map;
 * the ingestion boundary treats that as an invalid required field.
 *
 * The dedicated hosts are checked FIRST because maps.google.com also ends in
 * ".google.com": testing the broad list first would send it down the /maps
 * path rule and reject a perfectly good link.
 */
export function linkMapa(v) {
  if (temPortaExplicita(v)) return "";
  const p = comoUrl(v);
  if (!p) return "";
  if (p.username || p.password || p.port) return "";

  const host = p.hostname.toLowerCase();
  const caminhoMaps = /^\/maps(?:\/|$)/.test(p.pathname);
  if (host === "share.google") {
    // The Google app now also emits share.google/<token>. It is a general
    // shortener, not a Maps-only host, so this is only a syntactic admission:
    // ingestion follows it and quarantines the record unless the final Google
    // destination proves it represents a place.
    if (!/^\/[A-Za-z0-9_-]{8,128}\/?$/.test(p.pathname)) return "";
    p.search = ""; p.hash = "";
  } else if (host === "maps.app.goo.gl") {
    if (!/^\/[A-Za-z0-9_-]+\/?$/.test(p.pathname)) return "";
    p.search = ""; p.hash = ""; // the path token is the whole short link
  } else if (host === "goo.gl") {
    if (!/^\/maps\/[A-Za-z0-9_-]+\/?$/.test(p.pathname)) return "";
    p.search = ""; p.hash = "";
  } else if (HOSTS_GOOGLE_MAPS.has(host)) {
    if (host.startsWith("maps.")) {
      if (p.pathname !== "/" && !caminhoMaps) return "";
    } else if (!caminhoMaps) return "";
    manterParametros(p, PARAMETROS_GOOGLE_MAPS);
    p.hash = ""; // Google Maps does not need fragments for a shared destination
  } else if (HOSTS_OPENSTREETMAP.has(host)) {
    manterParametros(p, PARAMETROS_OPENSTREETMAP);
    manterHashOpenStreetMap(p);
  } else return "";

  // All allowed services support HTTPS. Upgrade old links, but never carry
  // credentials, explicit ports, trackers or a hidden personal identifier.
  p.protocol = "https:";
  const pii = dadosPessoaisEmUrlMapa(p.href);
  return pii.telefone || pii.email || pii.documento ? "" : p.href;
}

/* Invisible characters that change how text READS without changing what it
   says: bidi overrides (Trojan Source, CVE-2021-42574) can make a popup render
   a different string than the one the moderator approved, and zero-width
   characters split a word so that no filter downstream ever matches it.
   Stripped BEFORE the cut, so they cannot spend the 120-char budget either. */
// Default_Ignorable covers more than the familiar zero-width/bidi characters:
// U+2060 WORD JOINER and U+00AD SOFT HYPHEN are invisible too and can split a
// phone number so a privacy regex sees two harmless fragments while a person
// sees one continuous number. C0/C1 controls get the same treatment. Newlines,
// tabs and carriage returns are left for the whitespace collapse below so two
// words do not get accidentally glued together.
const INVISIVEIS = /[\p{Default_Ignorable_Code_Point}\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu;
// URLs do not need any control character at all. Reject instead of rewriting:
// URL parsers silently discard some of them, which makes validation inspect a
// different spelling from the destination a browser finally opens.
const TEM_INVISIVEIS = /[\p{Default_Ignorable_Code_Point}\u0000-\u001F\u007F-\u009F]/u;

export function cleanField(v) {
  if (v == null) return "";
  return String(v)
    .normalize("NFKC")       // also folds full-width digits before privacy checks
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

/**
 * The scheduled safety net may legitimately take up to one hour. Two hours
 * without a fresh snapshot is therefore no longer "quiet week, no signups";
 * it is an operationally stale list and the interface must say so plainly.
 */
export function snapshotAtrasado(iso, agora = Date.now(), limiteMs = 2 * 60 * 60 * 1000) {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t) || !Number.isFinite(agora) || !Number.isFinite(limiteMs)) return false;
  const idade = agora - t;
  return idade >= 0 && idade > limiteMs;
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
      posicao: r.posicao === "exata" ? "exata" : "regiao",
      lat: insideDF(lat, lon) ? lat : null,
      lon: insideDF(lat, lon) ? lon : null,
    };
    if (!rec.grupo) continue; // a record without a group name is not renderable
    out.push(rec);
  }
  return out;
}

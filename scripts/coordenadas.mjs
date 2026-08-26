/**
 * movimenta7 — turns what a person pasted into a position on the map.
 *
 * WHY THIS FILE EXISTS. The form never asks where the group meets. It asks for
 * an administrative region and for the place's NAME in free text ("Skate
 * parque"), so every pin was drawn at the centroid of its region, with a small
 * fan-out so pins in the same region did not stack. On a region the size of
 * Samambaia that is kilometres away from the actual meeting point, and the owner
 * saw it immediately: two groups whose real address is the 502 Sul were sitting
 * in the middle of Samambaia.
 *
 * THREE LAYERS, BEST FIRST:
 *   1. the coordinate carried inside the Google Maps link the person pasted —
 *      exact, free, and needs no third-party service;
 *   2. (still to come) geocoding the typed place name;
 *   3. the region centroid, which stops being the answer and becomes the last
 *      resort it always should have been.
 *
 * WHICH SOURCE WINS WHEN THEY DISAGREE — the decision that matters here. If a
 * link's coordinate lands in a different region than the one the person picked
 * from the dropdown, the COORDINATE WINS and the region is corrected to match.
 * That is not the obvious choice, so it is worth writing down: the failure that
 * started all of this was a group whose real place is in the Plano Piloto
 * registered under Samambaia. Checking a link against the declared region would
 * have thrown away the one piece of information that was RIGHT and kept the one
 * that was wrong. A dropdown is a guess someone makes about geography; a shared
 * map link is where they actually stood.
 *
 * The check that does stay is the outer one: a coordinate outside the Federal
 * District is refused outright, and the group falls back to its declared region.
 * Someone pasting a link to another city cannot drag a pin off to Goiás.
 */

import { linkMapa } from "../js/util.js";

/* ---------- geometry ----------
   Lifted out of publicar_snapshot.mjs, which now imports from here. Two copies
   of a point-in-polygon test in one repository is one copy too many: they would
   answer differently one day, and the day they did, the ingest and the publisher
   would disagree about which region a group is in. */

export const ringsOf = (geom) =>
  geom?.type === "Polygon" ? [geom.coordinates[0]]
    : geom?.type === "MultiPolygon" ? geom.coordinates.map((p) => p[0])
      : [];

/** Ray casting. Points exactly on an edge are undefined-but-consistent. */
export function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Signed-area centroid. For a concave region it can land OUTSIDE the polygon,
 * which is why interiorPoint() checks it before trusting it.
 */
export function centroidOf(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const f = xj * yi - xi * yj;
    a += f; cx += (xj + xi) * f; cy += (yj + yi) * f;
  }
  if (a === 0) return null;
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

export function interiorPoint(ring) {
  const c = centroidOf(ring);
  if (c && pointInRing(c[0], c[1], ring)) return c;
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (let i = 1; i < 20; i++) {
    for (let j = 1; j < 20; j++) {
      const x = x0 + ((x1 - x0) * i) / 20, y = y0 + ((y1 - y0) * j) / 20;
      if (pointInRing(x, y, ring)) return [x, y];
    }
  }
  return null;
}

/**
 * Which administrative region contains this point, by NAME as the official
 * IPEDF layer spells it — or "" for a point outside every region.
 *
 * This replaces the bounding box in js/util.js for anything the pipeline
 * decides. A box around the whole Federal District also contains a good slice of
 * Goiás, so "inside the box" was never the same statement as "inside the DF" —
 * it was just the cheapest sentence that sounded like it.
 */
export function regiaoDaCoordenada(lat, lon, geojson) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  for (const f of geojson?.features || []) {
    const nome = f.properties?.ra;
    if (!nome) continue;
    for (const ring of ringsOf(f.geometry)) {
      if (pointInRing(lon, lat, ring)) return String(nome);
    }
  }
  return "";
}

/** True when the point falls inside any administrative region of the DF. */
export const dentroDoDF = (lat, lon, geojson) => regiaoDaCoordenada(lat, lon, geojson) !== "";

/* ---------- reading a coordinate out of a map link ---------- */

/** Plausible as an Earth coordinate at all. Bounds to the DF happen elsewhere. */
function coordenadaValida(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&
    // 0,0 is in the Atlantic and is what a half-parsed URL produces. Nobody
    // meets there, so treating it as "no answer" costs nothing and catches a
    // whole class of parsing mistakes.
    !(lat === 0 && lon === 0);
}

const NUM = "(-?\\d+\\.\\d+)";

/**
 * Where a coordinate can hide in a Google Maps URL, MOST TRUSTWORTHY FIRST.
 * The order is the entire point of this list, so each entry says what it is:
 *
 *  - !3d/!4d live in the `data=` blob and are the PLACE Google resolved. This is
 *    what the Compartilhar button produces once the short link is followed, and
 *    it is the only one that means "this pin", rather than "this view".
 *  - /@lat,lon,17z is the CAMERA. For a shared place it usually sits on the
 *    place, but pan the map before sharing and it drifts — right often enough to
 *    use, wrong often enough to rank below !3d.
 *  - q= / query= / ll= / center= are what an explicitly typed coordinate looks
 *    like. They are exact when present, but q= is much more often a search
 *    ("q=skate+park+samambaia"), which is why the pattern demands two numbers
 *    and the caller must accept "no answer" as the common case.
 */
const PADROES = [
  { nome: "lugar", re: new RegExp(`!3d${NUM}!4d${NUM}`) },
  { nome: "camera", re: new RegExp(`[/@]@?${NUM},${NUM}`) },
  { nome: "consulta", re: new RegExp(`[?&](?:q|query|ll|center|daddr|destination)=${NUM}%2C${NUM}`, "i") },
  { nome: "consulta", re: new RegExp(`[?&](?:q|query|ll|center|daddr|destination)=${NUM},${NUM}`, "i") },
];

/* The redirect resolver is a network boundary, not a general-purpose URL
   follower. A valid Google short link must never turn the Actions runner into
   an SSRF client through an unexpected Location header. Keep this list exact:
   accepting `endsWith("google.com")` would also accept
   `notgoogle.com`, while accepting every Google subdomain would be broader than
   the one job this function has. */
const HOSTS_GOOGLE_MAPS = new Set([
  "google.com", "www.google.com", "maps.google.com",
  "google.com.br", "www.google.com.br", "maps.google.com.br",
]);

function temPortaExplicita(valor) {
  // URL.port normalizes the default :443 to "", so inspect the original
  // authority too. Network-path redirects (//host:443/...) and backslashes are
  // included because the WHATWG URL parser treats them as authority separators
  // for HTTPS URLs.
  const m = /^(?:[a-z][a-z\d+.-]*:)?[\\/]{2}([^/\\?#]*)/i
    .exec(String(valor ?? "").trim());
  if (!m) return false; // relative redirect; the already-approved base has no port
  const host = m[1].slice(m[1].lastIndexOf("@") + 1);
  return host.startsWith("[") ? host.includes("]:") : host.includes(":");
}

/**
 * Resolves and validates one URL before it may be inspected or fetched.
 * Returns its normalized HTTPS URL, or "" for anything outside Google Maps.
 */
function urlGoogleMapsParaRede(valor, base) {
  if (temPortaExplicita(valor)) return "";
  let p;
  try { p = new URL(String(valor ?? ""), base); } catch (e) { return ""; }
  if (p.protocol !== "https:" || p.username || p.password || p.port) return "";

  const host = p.hostname.toLowerCase();
  const caminhoMaps = /^\/maps(?:\/|$)/.test(p.pathname);
  if (HOSTS_GOOGLE_MAPS.has(host)) {
    // maps.google.* also uses the root path with q=/ll= query parameters.
    if (host.startsWith("maps.")) return p.pathname === "/" || caminhoMaps ? p.href : "";
    return caminhoMaps ? p.href : "";
  }
  // Google short links are opaque single tokens. Restricting the path keeps
  // this resolver tied to that service instead of accepting arbitrary endpoints
  // merely because they share a Google-owned host.
  if (host === "maps.app.goo.gl") {
    return /^\/[A-Za-z0-9_-]+\/?$/.test(p.pathname) ? p.href : "";
  }
  if (host === "goo.gl") {
    return /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(p.pathname) ? p.href : "";
  }
  return "";
}

/** Initial Google-app short link. The host is general-purpose; destination
 * validation happens after every redirect below. */
function urlShareGoogleInicial(valor) {
  if (temPortaExplicita(valor)) return "";
  let p;
  try { p = new URL(String(valor ?? "")); } catch (e) { return ""; }
  if (p.protocol !== "https:" || p.hostname !== "share.google" ||
      p.username || p.password || p.port || p.search || p.hash) return "";
  return /^\/[A-Za-z0-9_-]{8,128}\/?$/.test(p.pathname) ? p.href : "";
}

function tokenShareGoogle(url) {
  try { return new URL(url).pathname.split("/").filter(Boolean)[0] || ""; }
  catch (e) { return ""; }
}

/** The first redirect observed from share.google. It may carry only the exact
 * opaque token from the initial URL; accepting an arbitrary Google endpoint
 * here would turn this into a general redirect follower. */
function intermediarioShareGoogle(valor, base, token) {
  if (temPortaExplicita(valor)) return "";
  let p;
  try { p = new URL(String(valor ?? ""), base); } catch (e) { return ""; }
  if (p.protocol !== "https:" || p.username || p.password || p.port || p.hash) return "";
  const host = p.hostname.toLowerCase();
  if (!HOSTS_GOOGLE_MAPS.has(host) || p.pathname !== "/share.google") return "";
  const params = [...p.searchParams];
  return params.length === 1 && params[0][0] === "q" && params[0][1] === token
    ? p.href : "";
}

/**
 * Google-app place shares currently finish on a Google Search place result,
 * identified by a Knowledge Graph place id and source=sh/x/loc/.... Convert
 * that result to a clean Maps search URL. A generic article/image share lacks
 * this contract and is rejected.
 */
function mapaDaBuscaCompartilhada(valor, base) {
  if (temPortaExplicita(valor)) return "";
  let p;
  try { p = new URL(String(valor ?? ""), base); } catch (e) { return ""; }
  if (p.protocol !== "https:" || p.username || p.password || p.port || p.hash) return "";
  const host = p.hostname.toLowerCase();
  if (!HOSTS_GOOGLE_MAPS.has(host) || p.pathname !== "/search") return "";

  const consulta = String(p.searchParams.get("q") || "").trim();
  const kgmid = String(p.searchParams.get("kgmid") || "");
  const origem = String(p.searchParams.get("source") || "");
  if (!consulta || consulta.length > 240 ||
      !/^\/g\/[A-Za-z0-9_-]{3,128}$/.test(kgmid) ||
      !/^sh\/x\/loc(?:\/|$)/.test(origem)) return "";

  const mapa = new URL("https://www.google.com/maps/search/");
  mapa.searchParams.set("api", "1");
  mapa.searchParams.set("query", consulta);
  return linkMapa(mapa.href);
}

/**
 * Resolves the Google app's general share.google shortener into a proven Maps
 * destination. Only redirect headers are read; the page body is never used.
 * Returns a canonical Maps URL and, when present in that URL, its coordinate.
 */
export async function resolverCompartilhamentoGoogle(url, {
  buscar = fetch, maxHops = 4, timeoutMs = 8000,
} = {}) {
  let atual = urlShareGoogleInicial(url);
  if (!atual) return null;
  const token = tokenShareGoogle(atual);
  const signal = typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function" && timeoutMs > 0
    ? AbortSignal.timeout(timeoutMs)
    : undefined;

  for (let i = 0; i < maxHops; i++) {
    let resp;
    try {
      const opcoes = { redirect: "manual" };
      if (signal) opcoes.signal = signal;
      resp = await buscar(atual, opcoes);
    } catch (e) { return null; }

    const proximo = resp?.headers?.get?.("location") || "";
    if (!proximo) return null;

    const intermediario = intermediarioShareGoogle(proximo, atual, token);
    if (intermediario) { atual = intermediario; continue; }

    const destinoMaps = urlGoogleMapsParaRede(proximo, atual);
    if (destinoMaps) {
      const mapa = linkMapa(destinoMaps);
      if (!mapa) return null;
      const pos = coordenadaDeUrl(mapa);
      return pos ? { mapa, lat: pos.lat, lon: pos.lon } : { mapa };
    }

    const mapa = mapaDaBuscaCompartilhada(proximo, atual);
    return mapa ? { mapa } : null;
  }
  return null;
}

/**
 * Reads the coordinate out of a map URL. Returns { lat, lon, fonte } or null.
 *
 * Pure and offline: it reads the URL it is handed and nothing else. A short
 * maps.app.goo.gl link carries no coordinate at all, so following redirects is
 * the caller's job (resolverCoordenada below) — keeping the parsing separate is
 * what makes the tricky half of this testable without a network.
 */
export function coordenadaDeUrl(url) {
  const texto = String(url ?? "");
  if (!texto) return null;
  for (const { nome, re } of PADROES) {
    const m = re.exec(texto);
    if (!m) continue;
    const lat = Number(m[1]), lon = Number(m[2]);
    if (coordenadaValida(lat, lon)) return { lat, lon, fonte: nome };
  }
  return null;
}

/**
 * Follows a short link until a coordinate falls out of the URL.
 *
 * maps.app.goo.gl is what the Compartilhar button in Google Maps hands people,
 * so it is the format most registrations will carry — and it is opaque: the
 * coordinate only exists at the far end of the redirect. Each hop is checked, so
 * a chain that reveals the position early stops early.
 *
 * ONLY URLs ARE READ, NEVER THE PAGE BODY, and that limit was measured rather
 * than assumed. The first version of this function fell back to scanning the
 * HTML Google finally served, because a real Maps page does carry the position
 * (as `staticmap?center=lat%2Clon`). Tried against two completely different
 * places on 25/08/2026 — "skate park samambaia" and "Catedral de Brasília" — it
 * returned the SAME coordinate for both: -15.8793728,-48.1099776. Google serves
 * an unauthenticated robot a generic page with a fixed map on it, so the body
 * scan produced a confident, precise, wrong answer, and it would have produced
 * it for every group whose link could not be resolved — parking the entire map
 * on one arbitrary spot in Samambaia. That is the exact bug this file was
 * written to fix, made worse by looking correct. A coordinate in the URL was put
 * there by Google resolving a place; a coordinate in the body may be furniture.
 *
 * NEVER THROWS. A group with an unreadable link is a group at its region's
 * centroid, which is where it would have been anyway; a group whose ingestion
 * crashed is a map that stops updating for everyone. The `buscar` parameter
 * exists so the tests can drive this without a network.
 */
export async function resolverCoordenada(url, { buscar = fetch, maxHops = 4, timeoutMs = 8000 } = {}) {
  // Validate BEFORE parsing too: a hostile URL carrying /@lat,lon must not be
  // accepted merely because it already names a coordinate and needs no fetch.
  let atual = urlGoogleMapsParaRede(url);
  if (!atual) return null;
  const direto = coordenadaDeUrl(atual);
  if (direto) return direto;

  // One budget for the whole redirect chain. A fresh timeout per hop would let
  // one hostile short link multiply the limit and hold the publication job.
  const signal = typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function" && timeoutMs > 0
    ? AbortSignal.timeout(timeoutMs)
    : undefined;
  for (let i = 0; i < maxHops && atual; i++) {
    let resp;
    try {
      const opcoes = { redirect: "manual" };
      if (signal) opcoes.signal = signal;
      resp = await buscar(atual, opcoes);
    } catch (e) {
      return null;
    }
    const proximo = resp?.headers?.get?.("location") || "";
    if (!proximo) return null; // chain ended without ever naming a position
    // Validate EVERY Location before parsing or following it. This blocks an
    // open redirect from reaching localhost, cloud metadata, an external host,
    // a non-HTTPS scheme or a Google-looking suffix controlled by somebody else.
    const absoluto = urlGoogleMapsParaRede(proximo, atual);
    if (!absoluto) return null;
    const achou = coordenadaDeUrl(absoluto);
    if (achou) return achou;
    atual = absoluto;
  }
  return null;
}

/**
 * Reports coordinates shared by different groups without destroying them.
 *
 * The defence for the class of bug found above, kept even though the cause was
 * removed: any upstream that answers with a constant — a robot page, a cached
 * error, a geocoder returning the centre of Brazil — shows up here as several
 * groups landing on the identical point. Real groups do not share a coordinate
 * to seven decimal places, and the fan-out that keeps same-region pins legible
 * only works on groups that fell back to a centroid.
 *
 * Different groups legitimately meet at the same church, park gate or court.
 * The previous implementation deleted both exact positions, which silently
 * made good Maps links approximate. The browser now fans overlapping markers
 * out visually while every route link keeps pointing at the real place.
 */
export function coordenadasCompartilhadas(registros) {
  const vistos = new Map();
  for (const r of registros) {
    if (!Number.isFinite(r?.lat) || !Number.isFinite(r?.lon)) continue;
    const chave = `${r.lat.toFixed(6)},${r.lon.toFixed(6)}`;
    vistos.set(chave, (vistos.get(chave) || 0) + 1);
  }
  const avisos = [];
  for (const [chave, total] of vistos) {
    if (total > 1) avisos.push(`${total} grupos compartilham a coordenada ${chave}; ` +
      `os pins serao separados apenas na apresentacao.`);
  }
  return { registros, avisos };
}

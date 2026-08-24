/* Pure helpers, covered by tests/util.test.mjs.
   Security invariant (ADR-0004): every data-borne string is cut hard at
   MAX_FIELD chars and only ever reaches the DOM via textContent. */

export const MAX_FIELD = 120;   // hard cut per field
export const MAX_RECORDS = 500; // anti-flood ceiling: visitors' browsers must not pay for a flooded sheet

// Accepts only ABSOLUTE http(s) URLs — blocks "javascript:" and friends, and
// keeps free text (e.g. "@instagram") from being mistaken for a link.
export function safeUrl(u) {
  if (!u) return "";
  try {
    const p = new URL(String(u)); // no base: relative input throws → ""
    if (p.protocol === "https:" || p.protocol === "http:") return p.href;
  } catch (e) { /* invalid/relative URL → treated as empty */ }
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
      contatoTexto: cleanField(r.contato),
      contatoUrl: safeUrl(r.contato), // "" when the public contact is not a link (e.g. @instagram)
      lat: insideDF(lat, lon) ? lat : null,
      lon: insideDF(lat, lon) ? lon : null,
    };
    if (!rec.grupo) continue; // a record without a group name is not renderable
    out.push(rec);
  }
  return out;
}

/**
 * movimenta7 — publication step of the Write-Audit-Publish pipeline (ADR-0002).
 *
 * Reads moderacao/aprovados.json (PUBLIC fields only, produced by
 * ingerir_csv.mjs) and writes data/snapshot.json, which is what the site reads.
 *
 * This file used to say that the manual copy step WAS the privacy control and
 * must never be automated. ADR-0006 replaced that control rather than deleting
 * it: the form stopped collecting personal data at all, so there is no longer a
 * private column for a human to leave behind. What a human used to do by being
 * careful, the pipeline now does by not having the data.
 *
 * Still fail-closed, and that is deliberate ASYMMETRY with the ingest: the
 * ingest quarantines one bad row and carries on, because its input is the open
 * public. This step's input is a file our own ingest just wrote, so anything
 * wrong here is a bug in us and deserves a red build.
 *
 * Coordinates: the form does not ask for them, so a group is placed at the
 * centroid of its administrative region, taken from the official IPEDF layer
 * (data/ra_df.geojson). Never hardcode coordinates (ADR-0003). Groups sharing
 * a region get a small deterministic offset so their pins do not overlap.
 *
 * Fail-closed: any private-looking field aborts the write (exit 1).
 *
 * Run: node scripts/publicar_snapshot.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
// Same denylist the CI gate uses — one list, so the two can never disagree.
import { CAMPOS_PUBLICOS, CHECAGENS_DE_VALOR, isPrivateKey } from "./denylist.mjs";

const IN = new URL("../moderacao/aprovados.json", import.meta.url);
const GEO = new URL("../data/ra_df.geojson", import.meta.url);
const REG = new URL("../data/regioes.json", import.meta.url);
const OUT = new URL("../data/snapshot.json", import.meta.url);

// Same allowlist the CI gate uses. It used to be a private copy of this list
// living only here, which meant the two could drift apart without a test
// noticing — and the gate was the one that had drifted.
const PUBLIC_KEYS = CAMPOS_PUBLICOS;

const fail = (msg) => { console.error("PUBLICACAO ABORTADA: " + msg); process.exit(1); };

// ---------- geometry ----------

const ringsOf = (geom) =>
  geom.type === "Polygon" ? [geom.coordinates[0]]
    : geom.type === "MultiPolygon" ? geom.coordinates.map((p) => p[0])
      : [];

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Signed-area centroid; for concave regions it can land outside the polygon,
// so it is checked and replaced by a grid-scanned interior point when needed.
function centroidOf(ring) {
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

function interiorPoint(ring) {
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

const norm = (s) => String(s || "").normalize("NFD")
  .replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function buildRegionIndex(geo) {
  const idx = new Map();
  for (const f of geo.features) {
    const nome = f.properties?.ra;
    const ring = ringsOf(f.geometry)[0];
    if (!nome || !ring) continue;
    const pt = interiorPoint(ring);
    if (pt) idx.set(norm(nome), { nome, lon: pt[0], lat: pt[1] });
  }
  return idx;
}

// ---------- main ----------

let aprovados;
try {
  aprovados = JSON.parse(readFileSync(IN, "utf8"));
} catch (e) {
  fail("moderacao/aprovados.json invalido ou ausente: " + e.message);
}
if (!Array.isArray(aprovados)) fail("moderacao/aprovados.json deve ser uma LISTA [ ... ]");

const geo = JSON.parse(readFileSync(GEO, "utf8"));
const regioes = buildRegionIndex(geo);

// data/regioes.json is the single source of truth linking a form option to a
// polygon. The two name sets do NOT match by luck: the official layer carries
// "Sol Nascente/  Pôr do Sol" (double space) and "Sudoeste/ Octogonal", and it
// predates the Arapoanga / Água Quente splits. Without this map those groups
// were counted and then silently vanished from the map.
const mapaRegioes = new Map();
for (const r of JSON.parse(readFileSync(REG, "utf8")).regioes || []) {
  mapaRegioes.set(norm(r.rotulo), r);
}

const erros = [];
const semCoordenada = [];
const usoPorRegiao = new Map();
const registros = [];

aprovados.forEach((r, i) => {
  const rotulo = `registro ${i + 1}` + (r?.grupo ? ` ("${r.grupo}")` : "");
  if (r == null || typeof r !== "object") { erros.push(`${rotulo}: nao e um objeto`); return; }

  for (const [k, v] of Object.entries(r)) {
    if (isPrivateKey(k)) erros.push(`${rotulo}: campo privado "${k}" — remova antes de publicar`);
    else if (!PUBLIC_KEYS.has(k)) erros.push(`${rotulo}: campo desconhecido "${k}" — so os campos publicos entram`);
    for (const valor of Array.isArray(v) ? v : [v]) {
      for (const { teste, motivo } of CHECAGENS_DE_VALOR) {
        if (teste(k, valor)) erros.push(`${rotulo}: ${motivo} no campo "${k}"`);
      }
    }
  }
  if (!r.grupo) { erros.push(`${rotulo}: falta "grupo" (sem nome do grupo o site nao mostra)`); return; }
  if (!r.regiao) { erros.push(`${rotulo}: falta "regiao"`); return; }

  // Every public field is carried through. custo, publico and
  // orientacao_profissional used to be collected, validated — and then dropped
  // right here, so the form asked three questions whose answers no visitor ever
  // saw. They are the answers to "posso levar meu filho?", "é pago?" and "tem
  // profissional?", which is exactly what someone deciding whether to show up
  // wants to know.
  const rec = {
    grupo: r.grupo, organizacao: r.organizacao || "", regiao: r.regiao,
    modalidades: Array.isArray(r.modalidades) ? r.modalidades : [],
    dias: Array.isArray(r.dias) ? r.dias : [],
    horario: r.horario || "", local: r.local || "",
    custo: r.custo || "",
    publico: Array.isArray(r.publico) ? r.publico : [],
    orientacao_profissional: r.orientacao_profissional || "",
    rede_social: r.rede_social || "", mapa: r.mapa || "",
  };

  if (Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon))) {
    rec.lat = Number(r.lat); rec.lon = Number(r.lon);
  } else {
    // Fail loudly. A region we cannot place used to pass with a console.warn
    // nobody reads, so the group was counted and never drawn.
    const decl = mapaRegioes.get(norm(r.regiao));
    if (!decl) {
      erros.push(`${rotulo}: regiao "${r.regiao}" nao esta declarada em data/regioes.json — ` +
        `corrija o nome ou acrescente a regiao la (com a feicao correspondente, ou "sem_pin": true)`);
      return;
    }
    const ra = decl.feicao ? regioes.get(norm(decl.feicao)) : null;
    if (!ra && !decl.sem_pin) {
      erros.push(`${rotulo}: regiao "${r.regiao}" aponta para a feicao "${decl.feicao}", ` +
        `que nao existe em data/ra_df.geojson — data/regioes.json esta fora de sincronia`);
      return;
    }
    if (!ra) {
      semCoordenada.push(`${rotulo}: "${r.regiao}" e declarada SEM pin de proposito — conta no total, fica fora do mapa`);
    } else {
      // deterministic fan-out (~250 m steps) so pins in the same region stay legible
      const n = usoPorRegiao.get(ra.nome) || 0;
      usoPorRegiao.set(ra.nome, n + 1);
      const ang = n * 2.39996, raio = n === 0 ? 0 : 0.0022 * Math.sqrt(n);
      rec.lat = +(ra.lat + raio * Math.sin(ang)).toFixed(6);
      rec.lon = +(ra.lon + raio * Math.cos(ang)).toFixed(6);
    }
  }
  registros.push(rec);
});

if (erros.length) fail("\n- " + erros.join("\n- "));

// Full timestamp, not just the date. With nobody approving each entry, "when
// did this last refresh?" is the only way the owner can tell a working pipeline
// from one that has been quietly failing since Tuesday — and the page shows it.
const doc = { atualizado_em: new Date().toISOString(), registros };
writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n", { encoding: "utf-8" });

semCoordenada.forEach((a) => console.warn("AVISO: " + a));
const comPin = registros.filter((r) => r.lat != null).length;
console.log(`data/snapshot.json publicado: ${registros.length} registro(s), ${comPin} com pin no mapa.`);
console.log("Confira com: node scripts/valida_snapshot.mjs");

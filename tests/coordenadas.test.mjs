/**
 * Covers scripts/coordenadas.mjs — the step that decides WHERE a pin goes.
 *
 * The stakes here are different from the rest of the suite. Everywhere else a
 * mistake shows up as a missing group or a red build; here a mistake shows up as
 * a pin sitting confidently on the wrong street, which nobody can tell apart
 * from a pin sitting on the right one. So the cases below are mostly about
 * refusing to answer: what must NOT be read as a coordinate, and what must be
 * thrown away once read.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  coordenadaDeUrl, resolverCoordenada, regiaoDaCoordenada, dentroDoDF,
  descartarCoordenadasRepetidas,
} from "../scripts/coordenadas.mjs";

const GEO = JSON.parse(readFileSync(new URL("../data/ra_df.geojson", import.meta.url), "utf8"));

/** Resposta falsa de rede: um redirect, ou o fim da linha. */
const salto = (destino) => ({ headers: { get: (h) => (h === "location" ? destino : null) } });
const semSalto = { headers: { get: () => null } };

// ---------- lendo a coordenada de um link ----------

/**
 * The priority order IS the feature. !3d/!4d is the place Google resolved;
 * /@lat,lon is wherever the camera happened to be pointing when the person hit
 * share. They are usually within metres of each other and occasionally are not,
 * so when a URL carries both, the place has to win.
 */
test("the resolved place beats the camera position when a link carries both", () => {
  const url = "https://www.google.com/maps/place/Parque/@-15.7000000,-47.8000000,17z" +
    "/data=!4m6!3m5!8m2!3d-15.7975123!4d-47.9028456";
  assert.deepEqual(coordenadaDeUrl(url), { lat: -15.7975123, lon: -47.9028456, fonte: "lugar" });
});

test("a link that is only a camera position is still usable", () => {
  assert.deepEqual(coordenadaDeUrl("https://www.google.com/maps/@-15.7975,-47.9028,17z"),
    { lat: -15.7975, lon: -47.9028, fonte: "camera" });
});

test("a typed coordinate is read, comma-encoded or not", () => {
  assert.deepEqual(coordenadaDeUrl("https://maps.google.com/?q=-15.83,-47.92"),
    { lat: -15.83, lon: -47.92, fonte: "consulta" });
  assert.deepEqual(coordenadaDeUrl("https://maps.google.com/?ll=-15.83%2C-47.92"),
    { lat: -15.83, lon: -47.92, fonte: "consulta" });
});

/**
 * The real link from the owner's live map on 25/08: a SEARCH, not a place. It
 * has no coordinate in it and never will, and pretending otherwise is how a
 * group ends up pinned to whatever the search engine felt like that day.
 */
test("a search link has no position, and says so", () => {
  assert.equal(coordenadaDeUrl("https://www.google.com/maps?q=skate+park+samambaia"), null);
  assert.equal(coordenadaDeUrl("https://maps.app.goo.gl/abc123"), null);
  assert.equal(coordenadaDeUrl(""), null);
  assert.equal(coordenadaDeUrl(null), null);
});

// A half-parsed URL yields 0,0 — a point in the Atlantic that would sail through
// any "is it a number" check and land a group in the ocean.
test("the null island is not a place anyone meets", () => {
  assert.equal(coordenadaDeUrl("https://maps.google.com/?q=0.0,0.0"), null);
});

test("integers are not read as coordinates", () => {
  // "/maps/dir/12,34" is not a position, and demanding a decimal point is what
  // keeps route and zoom fragments from being mistaken for one.
  assert.equal(coordenadaDeUrl("https://www.google.com/maps/dir/12,34"), null);
});

// ---------- seguindo o link curto ----------

test("a short link is followed until a URL names the position", () => {
  const rota = {
    "https://maps.app.goo.gl/xyz": salto("https://www.google.com/maps/place/X?authuser=0"),
    "https://www.google.com/maps/place/X?authuser=0":
      salto("https://www.google.com/maps/place/X/data=!8m2!3d-15.79!4d-47.88"),
  };
  return resolverCoordenada("https://maps.app.goo.gl/xyz", {
    buscar: async (u) => rota[u] || semSalto,
  }).then((r) => assert.deepEqual(r, { lat: -15.79, lon: -47.88, fonte: "lugar" }));
});

/**
 * THE BUG THAT WAS MEASURED, FROZEN SO IT CANNOT COME BACK.
 *
 * This function used to fall back to scanning the HTML Google finally served,
 * because a real Maps page does contain the position as
 * `staticmap?center=lat%2Clon`. Run against two entirely different places on
 * 25/08/2026 — "skate park samambaia" and "Catedral de Brasília" — it returned
 * the SAME coordinate for both: -15.8793728,-48.1099776. Google hands an
 * unauthenticated robot a generic page with a fixed map on it. Every group with
 * an unresolvable link would have been pinned to that one arbitrary spot in
 * Samambaia, precisely and wrongly — the original bug, wearing a disguise.
 */
test("the page body is never read, however tempting its contents", async () => {
  let corpoLido = false;
  const resposta = {
    status: 200,
    headers: { get: () => null },
    text: async () => { corpoLido = true; return "staticmap?center=-15.8793728%2C-48.1099776"; },
  };
  const r = await resolverCoordenada("https://maps.app.goo.gl/xyz", { buscar: async () => resposta });
  assert.equal(r, null, "leu a posicao do corpo da pagina — ela pode ser mobilia do Google");
  assert.equal(corpoLido, false);
});

test("a broken network costs a position, never the ingestion", async () => {
  const r = await resolverCoordenada("https://maps.app.goo.gl/xyz", {
    buscar: async () => { throw new Error("rede caiu"); },
  });
  assert.equal(r, null);
});

test("a redirect loop gives up instead of spinning", async () => {
  let chamadas = 0;
  const r = await resolverCoordenada("https://maps.app.goo.gl/a", {
    buscar: async () => { chamadas++; return salto("https://maps.app.goo.gl/a"); },
    maxHops: 4,
  });
  assert.equal(r, null);
  assert.equal(chamadas, 4);
});

// ---------- a coordenada cai onde? ----------

test("a point in the Plano Piloto is placed in the Plano Piloto", () => {
  // Congresso Nacional, from the official layer's own geometry.
  assert.match(regiaoDaCoordenada(-15.7997, -47.8645, GEO), /Plano Piloto/i);
  assert.ok(dentroDoDF(-15.7997, -47.8645, GEO));
});

/**
 * Why the bounding box in js/util.js could not stay in charge of this decision.
 * A box around the Federal District also contains a wide band of Goiás, so
 * "inside the box" was never the same sentence as "inside the DF" — it was the
 * cheapest sentence that sounded like it. Goiânia is far outside; Luziânia sits
 * right against the border and is the case that actually matters.
 */
test("a point outside the DF is refused, even from just over the border", () => {
  assert.equal(dentroDoDF(-16.5, -49.2, GEO), false, "Goiania");
  assert.equal(dentroDoDF(-16.2525, -47.9503, GEO), false, "Luziania, colada na divisa");
  assert.equal(regiaoDaCoordenada(-16.2525, -47.9503, GEO), "");
  assert.equal(dentroDoDF(NaN, NaN, GEO), false);
});

// ---------- a defesa contra origens que respondem sempre a mesma coisa ----------

test("groups that land on the identical point all lose it", () => {
  const registros = [
    { grupo: "A", lat: -15.8793728, lon: -48.1099776 },
    { grupo: "B", lat: -15.8793728, lon: -48.1099776 },
    { grupo: "C", lat: -15.7997, lon: -47.8645 },
    { grupo: "D" },
  ];
  const { avisos } = descartarCoordenadasRepetidas(registros);

  assert.equal(registros[0].lat, undefined, "A ficou com a posicao repetida");
  assert.equal(registros[1].lat, undefined, "B ficou com a posicao repetida");
  assert.equal(registros[2].lat, -15.7997, "C tem posicao propria e nao podia ser tocada");
  assert.equal(avisos.length, 2);
  assert.match(avisos[0], /ponto fixo/);
});

test("a group with no coordinate at all is left alone", () => {
  const registros = [{ grupo: "A" }, { grupo: "B" }];
  const { avisos } = descartarCoordenadasRepetidas(registros);
  assert.deepEqual(avisos, []);
});

// ---------- a costura com a ingestão ----------

/**
 * The seam, end to end: a spreadsheet row carrying a full Maps URL has to come
 * out of the ingest with lat/lon on it. Both halves pass their own tests and
 * still leave this joint free to be wired backwards — the position is read from
 * the NORMALISED link, so a change to the host allowlist that empties `mapa`
 * would silently take the coordinate with it.
 */
test("a registration whose link names its position arrives with that position", async () => {
  const { registrosPublicaveis } = await import("../scripts/ingerir_csv.mjs");
  const colunas = "grupo,organizacao,regiao,modalidades,dias,horario,local," +
    "rede_social,mapa,orientacao_profissional,custo,publico,remover";
  const link = "https://www.google.com/maps/place/Quadra+502+Sul/data=!8m2!3d-15.8163!4d-47.8963";
  const csv = `${colunas}\n"502 fit","IASD","Samambaia","Funcional","Segunda","06h00",` +
    `"Quadra 502 Sul","","${link}","Encontro social de prática livre","Gratuito","",""\n`;

  const [rec] = registrosPublicaveis(csv);
  assert.equal(rec.lat, -15.8163);
  assert.equal(rec.lon, -47.8963);
  // And the position it carries really is in a different region than the one the
  // person picked — which is the case publicar_snapshot.mjs then corrects.
  assert.match(regiaoDaCoordenada(rec.lat, rec.lon, GEO), /Plano Piloto/i);
  assert.equal(rec.regiao, "Samambaia", "a ingestao nao mexe na regiao; quem corrige e a publicacao");
});

test("a registration with a search link keeps no position at all", async () => {
  const { registrosPublicaveis } = await import("../scripts/ingerir_csv.mjs");
  const colunas = "grupo,organizacao,regiao,modalidades,dias,horario,local," +
    "rede_social,mapa,orientacao_profissional,custo,publico,remover";
  const csv = `${colunas}\n"502 fit","IASD","Samambaia","Funcional","Segunda","06h00",` +
    `"Quadra 502 Sul","","https://www.google.com/maps?q=skate+park","Encontro","Gratuito","",""\n`;

  const [rec] = registrosPublicaveis(csv);
  assert.equal(rec.lat, undefined, "inventou uma posicao a partir de uma busca");
  assert.equal(rec.mapa, "https://www.google.com/maps?q=skate+park", "o link em si continua util");
});

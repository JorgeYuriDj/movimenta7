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
  coordenadasCompartilhadas, geocodificarLocalPublico, resolverCompartilhamentoGoogle,
} from "../scripts/coordenadas.mjs";

const GEO = JSON.parse(readFileSync(new URL("../data/ra_df.geojson", import.meta.url), "utf8"));

/** Resposta falsa de rede: um redirect, ou o fim da linha. */
const salto = (destino) => ({ headers: { get: (h) => (h === "location" ? destino : null) } });
const semSalto = { headers: { get: () => null } };
const respostaJson = (valor) => {
  const bytes = new TextEncoder().encode(JSON.stringify(valor));
  return {
    ok: true,
    headers: { get: (h) => h === "content-length" ? String(bytes.byteLength) : "application/json" },
    arrayBuffer: async () => bytes.buffer,
  };
};

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

test("a share.google place is proven and converted to a canonical Maps route", async () => {
  const inicial = "https://share.google/FfiPZmaScAgrNXWab";
  const intermediario = "https://www.google.com/share.google?q=FfiPZmaScAgrNXWab";
  const destino = "https://www.google.com/search?kgmid=%2Fg%2F11c5h30rlp" +
    "&q=Skatepark+Samambaia&source=sh%2Fx%2Floc%2Fact%2Fm1%2F2&utm_source=tracker";
  const rota = {
    [inicial]: salto(intermediario),
    [intermediario]: salto(destino),
  };
  const chamadas = [];
  const r = await resolverCompartilhamentoGoogle(inicial, {
    buscar: async (url) => { chamadas.push(url); return rota[url] || semSalto; },
  });
  assert.deepEqual(r, {
    mapa: "https://www.google.com/maps/search/?api=1&query=Skatepark+Samambaia",
    consulta: "Skatepark Samambaia",
  });
  assert.deepEqual(chamadas, [inicial, intermediario]);
});

test("a proven public place name is geocoded inside the DF with strict request policy", async () => {
  let chamada;
  const r = await geocodificarLocalPublico("Skatepark Samambaia", "Samambaia", {
    buscar: async (url, opcoes) => {
      chamada = { url: new URL(url), opcoes };
      return respostaJson([{
        lat: "-15.8818071",
        lon: "-48.0827960",
        display_name: "Skatepark Samambaia, Samambaia, Distrito Federal, Brasil",
        address: { country_code: "br" },
      }]);
    },
  });
  assert.deepEqual(r, { lat: -15.8818071, lon: -48.082796, fonte: "nominatim" });
  assert.equal(chamada.url.hostname, "nominatim.openstreetmap.org");
  assert.equal(chamada.url.pathname, "/search");
  assert.equal(chamada.url.searchParams.get("bounded"), "1");
  assert.equal(chamada.url.searchParams.get("countrycodes"), "br");
  assert.match(chamada.url.searchParams.get("q"), /Skatepark Samambaia, Samambaia/);
  assert.match(chamada.opcoes.headers["user-agent"], /^movimenta7\/1\.0/);
  assert.equal(chamada.opcoes.redirect, "error");
});

test("geocoding refuses vague, mismatched, foreign, oversized and malformed answers", async () => {
  let chamadas = 0;
  const naoConsulta = async () => { chamadas++; return respostaJson([]); };
  assert.equal(await geocodificarLocalPublico("Parque", "Samambaia", { buscar: naoConsulta }), null);
  assert.equal(chamadas, 0, "uma consulta vaga chegou ao servico externo");

  for (const resposta of [
    [{ lat: "-15.88", lon: "-48.08", display_name: "Outro lugar, Samambaia", address: { country_code: "br" } }],
    [{ lat: "-15.88", lon: "-48.08", display_name: "Skatepark Samambaia", address: { country_code: "us" } }],
    [{ lat: "-23.55", lon: "-46.63", display_name: "Skatepark Samambaia", address: { country_code: "br" } }],
  ]) {
    assert.equal(await geocodificarLocalPublico("Skatepark Samambaia", "Samambaia", {
      buscar: async () => respostaJson(resposta),
    }), null);
  }

  const enorme = new Uint8Array(64 * 1024 + 1);
  assert.equal(await geocodificarLocalPublico("Skatepark Samambaia", "Samambaia", {
    buscar: async () => ({
      ok: true,
      headers: { get: () => String(enorme.byteLength) },
      arrayBuffer: async () => enorme.buffer,
    }),
  }), null);
});

test("share.google never becomes a general-purpose or unsafe redirect", async () => {
  const inicial = "https://share.google/FfiPZmaScAgrNXWab";
  const intermediario = "https://www.google.com/share.google?q=FfiPZmaScAgrNXWab";
  for (const destino of [
    "https://example.com/artigo",
    "https://169.254.169.254/latest/meta-data",
    "https://www.google.com/search?q=artigo&source=sh/x/web",
    "https://www.google.com/search?q=Parque&source=sh/x/loc/act/m1/2",
  ]) {
    const chamadas = [];
    const r = await resolverCompartilhamentoGoogle(inicial, {
      buscar: async (url) => {
        chamadas.push(url);
        return url === inicial ? salto(intermediario) : salto(destino);
      },
    });
    assert.equal(r, null, destino);
    assert.deepEqual(chamadas, [inicial, intermediario]);
  }

  let chamadas = 0;
  assert.equal(await resolverCompartilhamentoGoogle(
    "https://share.google/images/FfiPZmaScAgrNXWab",
    { buscar: async () => { chamadas++; return semSalto; } },
  ), null);
  assert.equal(chamadas, 0, "um formato nao permitido consultou a rede");
});

test("real Google Maps URL shapes remain accepted by the network resolver", async () => {
  let chamadas = 0;
  const buscar = async () => { chamadas++; return semSalto; };
  const casos = [
    "https://www.google.com/maps/place/X/@-15.79,-47.88,17z",
    "https://www.google.com.br/maps/place/X/data=!8m2!3d-15.79!4d-47.88",
    "https://maps.google.com/?q=-15.79,-47.88",
    "https://maps.google.com.br/?ll=-15.79%2C-47.88",
  ];
  for (const url of casos) {
    assert.deepEqual(await resolverCoordenada(url, { buscar }),
      { lat: -15.79, lon: -47.88, fonte: url.includes("!3d") ? "lugar" : url.includes("@") ? "camera" : "consulta" });
  }
  assert.equal(chamadas, 0, "um link completo do Google nao precisava consultar a rede");

  const rotaRelativa = {
    "https://maps.app.goo.gl/real": salto("https://www.google.com/maps/place/X"),
    "https://www.google.com/maps/place/X": salto("/maps/place/X/@-15.79,-47.88,17z"),
  };
  const relativo = await resolverCoordenada("https://maps.app.goo.gl/real", {
    buscar: async (url) => rotaRelativa[url] || semSalto,
  });
  assert.deepEqual(relativo, { lat: -15.79, lon: -47.88, fonte: "camera" });

  const legado = await resolverCoordenada("https://goo.gl/maps/abc123", {
    buscar: async () => salto("https://maps.google.com/?q=-15.79,-47.88"),
  });
  assert.deepEqual(legado, { lat: -15.79, lon: -47.88, fonte: "consulta" });
});

test("an untrusted initial URL is rejected before coordinate parsing or network access", async () => {
  const recusados = [
    "http://www.google.com/maps/@-15.79,-47.88,17z",
    "file:///maps/@-15.79,-47.88,17z",
    "https://evil.example/maps/@-15.79,-47.88,17z",
    "https://www.google.com.evil.example/maps/@-15.79,-47.88,17z",
    "https://192.0.2.1/maps/@-15.79,-47.88,17z",
    "https://127.0.0.1/maps/@-15.79,-47.88,17z",
    "https://[::1]/maps/@-15.79,-47.88,17z",
    "https://localhost/maps/@-15.79,-47.88,17z",
    "https://169.254.169.254/maps/@-15.79,-47.88,17z",
    "https://usuario@www.google.com/maps/@-15.79,-47.88,17z",
    "https://www.google.com:444/maps/@-15.79,-47.88,17z",
    "https://www.google.com:443/maps/@-15.79,-47.88,17z",
    "https://www.google.com/search?q=-15.79,-47.88",
    "https://maps.google.com/not-maps/@-15.79,-47.88,17z",
    "https://maps.app.goo.gl/codigo/extra",
    "https://goo.gl/maps/codigo/extra",
    "https://goo.gl/not-maps/@-15.79,-47.88,17z",
  ];
  let chamadas = 0;
  for (const url of recusados) {
    const r = await resolverCoordenada(url, {
      buscar: async () => { chamadas++; return semSalto; },
    });
    assert.equal(r, null, url);
  }
  assert.equal(chamadas, 0, "consultou a rede antes de validar a URL inicial");
});

test("every redirect hop is rejected before parsing or fetching an unsafe destination", async () => {
  const destinos = [
    "http://www.google.com/maps/@-15.79,-47.88,17z",
    "file:///maps/@-15.79,-47.88,17z",
    "https://evil.example/maps/@-15.79,-47.88,17z",
    "https://www.google.com.evil.example/maps/@-15.79,-47.88,17z",
    "https://127.0.0.1/maps/@-15.79,-47.88,17z",
    "https://localhost/maps/@-15.79,-47.88,17z",
    "https://169.254.169.254/latest/meta-data/@-15.79,-47.88,17z",
    "https://usuario@www.google.com/maps/@-15.79,-47.88,17z",
    "https://www.google.com:444/maps/@-15.79,-47.88,17z",
    "https://www.google.com/search?q=-15.79,-47.88",
    "//www.google.com:443/maps/@-15.79,-47.88,17z",
    "//169.254.169.254/maps/@-15.79,-47.88,17z",
  ];

  for (const destino of destinos) {
    const chamadas = [];
    const r = await resolverCoordenada("https://maps.app.goo.gl/seguro", {
      buscar: async (url) => {
        chamadas.push(url);
        return salto(destino);
      },
    });
    assert.equal(r, null, destino);
    assert.deepEqual(chamadas, ["https://maps.app.goo.gl/seguro"],
      `seguiu ou extraiu coordenada do destino recusado: ${destino}`);
  }
});

test("an unsafe destination is rejected even after an allowed intermediate hop", async () => {
  const chamadas = [];
  const rota = {
    "https://maps.app.goo.gl/inicio": salto("https://www.google.com/maps/place/sem-coordenada"),
    "https://www.google.com/maps/place/sem-coordenada":
      salto("https://169.254.169.254/latest/meta-data/@-15.79,-47.88,17z"),
  };
  const r = await resolverCoordenada("https://maps.app.goo.gl/inicio", {
    buscar: async (url) => {
      chamadas.push(url);
      return rota[url] || semSalto;
    },
  });
  assert.equal(r, null);
  assert.deepEqual(chamadas, [
    "https://maps.app.goo.gl/inicio",
    "https://www.google.com/maps/place/sem-coordenada",
  ], "o cliente tentou buscar o host de metadata no segundo redirect");
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

test("groups may share a real meeting point without losing its coordinate", () => {
  const registros = [
    { grupo: "A", lat: -15.8793728, lon: -48.1099776 },
    { grupo: "B", lat: -15.8793728, lon: -48.1099776 },
    { grupo: "C", lat: -15.7997, lon: -47.8645 },
    { grupo: "D" },
  ];
  const { avisos } = coordenadasCompartilhadas(registros);

  assert.equal(registros[0].lat, -15.8793728, "A perdeu o local real compartilhado");
  assert.equal(registros[1].lat, -15.8793728, "B perdeu o local real compartilhado");
  assert.equal(registros[2].lat, -15.7997, "C tem posicao propria e nao podia ser tocada");
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /2 grupos compartilham/);
});

test("a group with no coordinate at all is left alone", () => {
  const registros = [{ grupo: "A" }, { grupo: "B" }];
  const { avisos } = coordenadasCompartilhadas(registros);
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
    `"Quadra 502 Sul","https://instagram.com/502fit","${link}",` +
    `"Encontro social de prática livre","Gratuito","",""\n`;

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
    `"Quadra 502 Sul","https://instagram.com/502fit",` +
    `"https://www.google.com/maps?q=skate+park","Encontro","Gratuito","",""\n`;

  const [rec] = registrosPublicaveis(csv);
  assert.equal(rec.lat, undefined, "inventou uma posicao a partir de uma busca");
  assert.equal(rec.mapa, "https://www.google.com/maps?q=skate+park", "o link em si continua util");
});

test("a short Maps link is resolved once and reused from the private cache", async () => {
  const { completarCoordenadas } = await import("../scripts/ingerir_csv.mjs");
  const cache = { versao: 3, itens: {} };
  let chamadas = 0;
  const buscar = async () => {
    chamadas++;
    return salto("https://www.google.com/maps/place/X/data=!8m2!3d-15.79!4d-47.88");
  };
  const primeiro = [{ grupo: "A", mapa: "https://maps.app.goo.gl/xyz" }];
  const r1 = await completarCoordenadas(primeiro, { cache, buscar, agora: () => "agora" });
  assert.equal(r1.alterado, true);
  assert.equal(primeiro[0].lat, -15.79);
  assert.equal(chamadas, 1);

  const segundo = [{ grupo: "B", mapa: "https://maps.app.goo.gl/xyz" }];
  const r2 = await completarCoordenadas(segundo, { cache: r1.cache, buscar });
  assert.equal(r2.alterado, false);
  assert.equal(segundo[0].lon, -47.88);
  assert.equal(chamadas, 1, "o mesmo link voltou a consultar o Google");
});

test("a share.google registration is kept only after its place destination is proven", async () => {
  const { completarCoordenadas, registrosPublicaveis } =
    await import("../scripts/ingerir_csv.mjs");
  const colunas = "grupo,organizacao,regiao,modalidades,dias,horario,local," +
    "rede_social,mapa,orientacao_profissional,custo,publico,remover";
  const inicial = "https://share.google/FfiPZmaScAgrNXWab";
  const csv = `${colunas}\n"Grupo","IASD","Samambaia","Corrida","Segunda","19h",` +
    `"Parque","@grupo","${inicial}","Encontro","Gratuito","Todos",""\n`;
  const registros = registrosPublicaveis(csv);
  assert.equal(registros[0].mapa, inicial, "a entrada foi recusada antes de poder ser comprovada");

  const intermediario = "https://www.google.com/share.google?q=FfiPZmaScAgrNXWab";
  const destino = "https://www.google.com/search?kgmid=%2Fg%2F11c5h30rlp" +
    "&q=Skatepark+Samambaia&source=sh%2Fx%2Floc%2Fact%2Fm1%2F2";
  let chamadas = 0;
  const resolucao = await completarCoordenadas(registros, {
    cache: { versao: 3, itens: {} },
    buscar: async (url) => {
      chamadas++;
      if (url === inicial) return salto(intermediario);
      if (url === intermediario) return salto(destino);
      if (new URL(url).hostname === "nominatim.openstreetmap.org") return respostaJson([{
        lat: "-15.8818071",
        lon: "-48.0827960",
        display_name: "Skatepark Samambaia, Samambaia, Distrito Federal, Brasil",
        address: { country_code: "br" },
      }]);
      return semSalto;
    },
    agora: () => "2026-08-26T04:00:00.000Z",
  });
  assert.equal(registros.length, 1);
  assert.equal(registros[0].mapa,
    "https://www.google.com/maps/search/?api=1&query=Skatepark+Samambaia");
  assert.equal(registros[0].lat, -15.8818071);
  assert.equal(registros[0].lon, -48.082796);
  assert.equal(chamadas, 3);

  const repetido = [{ grupo: "Outro", mapa: inicial }];
  await completarCoordenadas(repetido, { cache: resolucao.cache, buscar: async () => {
    chamadas++; return semSalto;
  } });
  assert.equal(repetido[0].mapa,
    "https://www.google.com/maps/search/?api=1&query=Skatepark+Samambaia");
  assert.equal(repetido[0].lat, -15.8818071);
  assert.equal(chamadas, 3, "o destino share.google comprovado nao veio do cache");
});

test("multiple place geocodes are serialized to at most one request per second", async () => {
  const { completarCoordenadas } = await import("../scripts/ingerir_csv.mjs");
  const registros = [
    { grupo: "A", regiao: "Samambaia", mapa: "https://share.google/TokenSeguroA1" },
    { grupo: "B", regiao: "Samambaia", mapa: "https://share.google/TokenSeguroB2" },
  ];
  const pausas = [];
  const buscar = async (url) => {
    const p = new URL(url);
    if (p.hostname === "share.google") {
      const token = p.pathname.slice(1);
      return salto(`https://www.google.com/share.google?q=${token}`);
    }
    if (p.pathname === "/share.google") {
      const token = p.searchParams.get("q");
      const nome = token === "TokenSeguroA1" ? "Skatepark Samambaia" : "Parque Tres Meninas";
      return salto("https://www.google.com/search?kgmid=%2Fg%2F11local" +
        `&q=${encodeURIComponent(nome)}&source=sh%2Fx%2Floc%2Fact%2Fm1%2F2`);
    }
    if (p.hostname === "nominatim.openstreetmap.org") {
      const nome = p.searchParams.get("q").split(",", 1)[0];
      return respostaJson([{
        lat: nome === "Skatepark Samambaia" ? "-15.8818071" : "-15.8700000",
        lon: nome === "Skatepark Samambaia" ? "-48.0827960" : "-48.0900000",
        display_name: `${nome}, Samambaia, Distrito Federal, Brasil`,
        address: { country_code: "br" },
      }]);
    }
    return semSalto;
  };

  await completarCoordenadas(registros, {
    cache: { versao: 3, itens: {} },
    buscar,
    relogio: () => 10_000,
    pausar: async (ms) => pausas.push(ms),
  });
  assert.deepEqual(pausas, [1000]);
  assert.equal(registros.every((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon)), true);
});

test("a generic share.google destination is quarantined without blocking other groups", async () => {
  const { completarCoordenadas } = await import("../scripts/ingerir_csv.mjs");
  const token = "https://share.google/LinkGenerico123";
  const registros = [
    { grupo: "Recusado", mapa: token },
    { grupo: "Preservado", mapa: "https://www.google.com/maps?q=Parque" },
  ];
  const avisos = [];
  const anterior = console.warn;
  console.warn = (msg) => avisos.push(String(msg));
  try {
    await completarCoordenadas(registros, {
      cache: { versao: 3, itens: {} },
      buscar: async (url) => url === token
        ? salto("https://www.google.com/share.google?q=LinkGenerico123")
        : salto("https://example.com/artigo"),
      agora: () => "2026-08-26T04:00:00.000Z",
    });
  } finally { console.warn = anterior; }
  assert.deepEqual(registros.map((r) => r.grupo), ["Preservado"]);
  assert.deepEqual(avisos, [
    "AVISO: 1 cadastro(s) com share.google ficaram de fora porque o destino nao comprovou ser um local do Google.",
  ], "o log publico precisa ser generico, sem repetir o link recusado");
});

test("a transient short-link failure expires instead of making the pin approximate forever", async () => {
  const { completarCoordenadas } = await import("../scripts/ingerir_csv.mjs");
  const cache = { versao: 3, itens: {} };
  let chamadas = 0;
  const falha = async () => { chamadas++; return semSalto; };
  const link = "https://maps.app.goo.gl/transitorio";

  const r1 = await completarCoordenadas([{ grupo: "A", mapa: link }], {
    cache,
    buscar: falha,
    agora: () => "2026-08-25T10:00:00.000Z",
  });
  assert.equal(chamadas, 1);

  await completarCoordenadas([{ grupo: "B", mapa: link }], {
    cache: r1.cache,
    buscar: falha,
    agora: () => "2026-08-25T12:00:00.000Z",
  });
  assert.equal(chamadas, 1, "o cooldown negativo nao evitou a repeticao imediata");

  const recuperou = async () => {
    chamadas++;
    return salto("https://www.google.com/maps/place/X/@-15.79,-47.88,17z");
  };
  const registro = { grupo: "C", mapa: link };
  await completarCoordenadas([registro], {
    cache: r1.cache,
    buscar: recuperou,
    agora: () => "2026-08-25T17:00:01.000Z",
  });
  assert.equal(chamadas, 2);
  assert.equal(registro.lat, -15.79);
  assert.equal(registro.lon, -47.88);
});

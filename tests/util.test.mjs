import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  safeUrl, cleanField, parseSnapshot, descreveIdade, snapshotAtrasado,
  linkRedeSocial, linkMapa, MAX_FIELD, MAX_RECORDS,
  pinModalidade, PINS_CONHECIDOS, PIN_PADRAO,
} from "../js/util.js";

test("safeUrl accepts http(s) only", () => {
  assert.equal(safeUrl("https://wa.me/5561999990000"), "https://wa.me/5561999990000");
  assert.equal(safeUrl("http://exemplo.org/x"), "http://exemplo.org/x");
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("data:text/html,oops"), "");
  assert.equal(safeUrl("@grupo_no_insta"), ""); // free text is not a link
  assert.equal(safeUrl("chat.whatsapp.com/abc"), ""); // relative (no scheme) is not a link
  assert.equal(safeUrl(""), "");
  assert.equal(safeUrl(null), "");
});

test("cleanField trims, collapses whitespace and cuts at MAX_FIELD", () => {
  assert.equal(cleanField("  Corrida   da\n IASD  "), "Corrida da IASD");
  assert.equal(cleanField(null), "");
  assert.equal(cleanField(42), "42");
  assert.equal(cleanField("x".repeat(500)).length, MAX_FIELD);
});

test("parseSnapshot accepts both bare-array and {registros} shapes", () => {
  const rec = { grupo: "Corredores AC", regiao: "Águas Claras", lat: -15.84, lon: -48.02 };
  assert.equal(parseSnapshot([rec]).length, 1);
  assert.equal(parseSnapshot({ registros: [rec] }).length, 1);
  assert.equal(parseSnapshot({}).length, 0);
  assert.equal(parseSnapshot(null).length, 0);
});

test("parseSnapshot drops records without grupo and junk entries", () => {
  const out = parseSnapshot([{ regiao: "Gama" }, null, "x", { grupo: "Vôlei Guará" }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].grupo, "Vôlei Guará");
});

test("parseSnapshot rejects coordinates outside the DF box", () => {
  const [r] = parseSnapshot([{ grupo: "G", lat: 10, lon: 10 }]);
  assert.equal(r.lat, null);
  assert.equal(r.lon, null);
  const [ok] = parseSnapshot([{ grupo: "G", lat: -15.79, lon: -47.88 }]);
  assert.equal(ok.lat, -15.79);
});

/* ---------- link allowlist (ADR-0006) ----------
   safeUrl() accepts every destination on the web, which was fine while a human
   read each entry first. Nobody does any more, so these two decide where a
   community-submitted link is allowed to point. */

test("linkRedeSocial accepts a handle, with or without the @", () => {
  assert.deepEqual(linkRedeSocial("@corrida_df"),
    { url: "https://www.instagram.com/corrida_df", rotulo: "@corrida_df" });
  // Half the people will forget the @; dropping their link over punctuation
  // would be a worse outcome than assuming Instagram, which is what we asked for.
  assert.deepEqual(linkRedeSocial("corrida_df"),
    { url: "https://www.instagram.com/corrida_df", rotulo: "@corrida_df" });
});

test("linkRedeSocial accepts allowlisted networks and derives a readable label", () => {
  assert.deepEqual(linkRedeSocial("https://www.instagram.com/iasd.central/"),
    { url: "https://www.instagram.com/iasd.central/", rotulo: "@iasd.central" });
  assert.equal(linkRedeSocial("https://facebook.com/iasd").url, "https://facebook.com/iasd");
  assert.equal(linkRedeSocial("https://www.strava.com/clubs/123").url, "https://www.strava.com/clubs/123");
});

test("linkRedeSocial never turns a phone or e-mail into a public profile", () => {
  for (const value of [
    "61999990000",
    "@61999990000",
    "https://instagram.com/61999990000",
    "https://instagram.com/nome%40pessoal.com",
    "https://user:secret@instagram.com/igreja",
  ]) {
    assert.equal(linkRedeSocial(value).url, "", value);
  }
});

test("linkRedeSocial canonicalizes a profile and drops trackers or hidden query data", () => {
  assert.deepEqual(
    linkRedeSocial("http://instagram.com/iasd.central?utm_source=x#bio"),
    { url: "https://instagram.com/iasd.central", rotulo: "@iasd.central" },
  );
  assert.equal(
    linkRedeSocial("https://instagram.com/iasd.central?telefone=61999990000#pessoal@x.com").url,
    "https://instagram.com/iasd.central",
  );
  assert.equal(linkRedeSocial("https://facebook.com/profile.php?id=123").url, "");
});

test("linkRedeSocial refuses everything outside the allowlist", () => {
  assert.equal(linkRedeSocial("https://malware.example/x").url, "");
  assert.equal(linkRedeSocial("javascript:alert(1)").url, "");
  // WhatsApp is not on the list at all now — the owner removed the channel.
  assert.equal(linkRedeSocial("https://chat.whatsapp.com/abc").url, "");
  // The important one: a lookalike host is a different site. endsWith("instagram.com")
  // would have accepted this and sent visitors to somebody else's server.
  assert.equal(linkRedeSocial("https://instagram.com.exemplo-malicioso.com/x").url, "");
});

test("linkMapa accepts the format the Google Maps share button produces", () => {
  // This is what "Compartilhar" gives you on a phone, so it is the format most
  // people will paste. An earlier version of this rule rejected it.
  assert.equal(linkMapa("https://maps.app.goo.gl/abc123"), "https://maps.app.goo.gl/abc123");
  assert.equal(linkMapa("https://share.google/FfiPZmaScAgrNXWab"),
    "https://share.google/FfiPZmaScAgrNXWab");
  assert.equal(linkMapa("https://maps.google.com/?q=Parque"), "https://maps.google.com/?q=Parque");
  assert.equal(linkMapa("https://goo.gl/maps/xyz"), "https://goo.gl/maps/xyz");
  assert.equal(linkMapa("https://www.openstreetmap.org/#map=15"), "https://www.openstreetmap.org/#map=15");
});

test("linkMapa preserves real coordinates and opaque place identifiers", () => {
  assert.equal(
    linkMapa("https://www.google.com/maps/place/Parque/@-15.79422870,-47.88216580,17z?entry=ttu"),
    "https://www.google.com/maps/place/Parque/@-15.79422870,-47.88216580,17z",
    "oito casas decimais nao podem parecer telefone",
  );
  assert.equal(
    linkMapa("https://www.google.com/maps/search/?api=1&query=Parque&query_place_id=ChIJabc_123-XYZ"),
    "https://www.google.com/maps/search/?api=1&query=Parque&query_place_id=ChIJabc_123-XYZ",
  );
  assert.equal(
    linkMapa("https://maps.google.com/?cid=1234567890123456789"),
    "https://maps.google.com/?cid=1234567890123456789",
  );
  assert.equal(
    linkMapa("https://www.openstreetmap.org/?mlat=-15.79422870&mlon=-47.88216580#map=17/-15.79422870/-47.88216580"),
    "https://www.openstreetmap.org/?mlat=-15.79422870&mlon=-47.88216580#map=17/-15.79422870/-47.88216580",
  );
});

test("linkMapa removes dispensable query/hash data and upgrades known hosts", () => {
  assert.equal(
    linkMapa("http://maps.app.goo.gl/abc123?g_st=ic#joao%40exemplo.org"),
    "https://maps.app.goo.gl/abc123",
  );
  assert.equal(
    linkMapa("http://share.google/FfiPZmaScAgrNXWab?tracker=x#segredo"),
    "https://share.google/FfiPZmaScAgrNXWab",
  );
  assert.equal(
    linkMapa("https://www.google.com/maps/place/Parque?entry=ttu&segredo=joao%40exemplo.org#61999990000"),
    "https://www.google.com/maps/place/Parque",
  );
});

test("linkMapa rejects personal data that is meaningful to the destination", () => {
  for (const value of [
    "https://joao%40exemplo.org:segredo@www.google.com/maps/place/X",
    "https://www.google.com/maps/search/joao%40exemplo.org",
    "https://maps.google.com/?q=61%2099999-0000",
    "https://maps.google.com/?q=61%2C99999%2C0000",
    "https://maps.google.com/?q=61%E2%80%8B99999-0000",
    "https://maps.google.com/?q=%EF%BC%96%EF%BC%91%20%EF%BC%99%EF%BC%99%EF%BC%99%EF%BC%99%EF%BC%99-0000",
    "https://maps.google.com/?q=joao%2540exemplo.org",
    "https://maps.google.com/?query=529.982.247-25",
    "https://maps.google.com/?query=052998224725",
    "https://www.openstreetmap.org/search?query=11.222.333%2F0001-81",
    "https://www.openstreetmap.org/#layers=joao%40exemplo.org",
  ]) assert.equal(linkMapa(value), "", value);
});

test("linkMapa refuses Google pages that are not maps", () => {
  // google.com hosts the whole catalogue; without the /maps rule "a maps link"
  // would be a way to publish a Drive file or a search results page.
  assert.equal(linkMapa("https://www.google.com/maps/place/Parque"), "https://www.google.com/maps/place/Parque");
  assert.equal(linkMapa("https://www.google.com/search?q=x"), "");
  assert.equal(linkMapa("https://drive.google.com/file/d/1"), "");
  assert.equal(linkMapa("https://goo.gl/xyz"), "");
  assert.equal(linkMapa("https://maps.app.goo.gl.exemplo-malicioso.com/a"), "");
  assert.equal(linkMapa("https://share.google.exemplo-malicioso.com/FfiPZmaScAgrNXWab"), "");
  assert.equal(linkMapa("https://share.google/images/FfiPZmaScAgrNXWab"), "");
  assert.equal(linkMapa("https://sites.google.com/maps/viewer"), "");
  assert.equal(linkMapa("https://www.google.com:443/maps/place/Parque"), "");
});

test("parseSnapshot exposes the two links and never the raw text", () => {
  const [a] = parseSnapshot([{ grupo: "G", rede_social: "@corrida_df", mapa: "https://maps.app.goo.gl/x" }]);
  assert.equal(a.redeUrl, "https://www.instagram.com/corrida_df");
  assert.equal(a.redeRotulo, "@corrida_df");
  assert.equal(a.mapaUrl, "https://maps.app.goo.gl/x");

  // A refused destination costs the group its link, never its pin.
  const [b] = parseSnapshot([{ grupo: "G", rede_social: "https://malware.example", mapa: "nada" }]);
  assert.equal(b.grupo, "G");
  assert.equal(b.redeUrl, "");
  assert.equal(b.redeRotulo, "");
  assert.equal(b.mapaUrl, "");
});

test("parseSnapshot keeps only the two declared position precisions", () => {
  const [exata] = parseSnapshot([{ grupo: "A", posicao: "exata" }]);
  const [legado] = parseSnapshot([{ grupo: "B", posicao: "inventada" }]);
  assert.equal(exata.posicao, "exata");
  assert.equal(legado.posicao, "regiao");
});

test("descreveIdade says how stale the list is, in words a visitor can judge", () => {
  const agora = Date.parse("2026-08-25T12:00:00Z");
  const atras = (min) => new Date(agora - min * 60000).toISOString();
  assert.equal(descreveIdade(atras(0), agora), "agora mesmo");
  assert.equal(descreveIdade(atras(12), agora), "há 12 minutos");
  assert.equal(descreveIdade(atras(60), agora), "há 1 hora");
  assert.equal(descreveIdade(atras(60 * 5), agora), "há 5 horas");
  assert.equal(descreveIdade(atras(60 * 24 * 3), agora), "há 3 dias");
  assert.equal(descreveIdade("", agora), "");
  assert.equal(descreveIdade("nao e data", agora), "");
  // Clock skew must not produce "há -2 minutos"; saying nothing is correct.
  assert.equal(descreveIdade(atras(-2), agora), "");
});

test("snapshotAtrasado only warns after the two-hour fallback window", () => {
  const agora = Date.parse("2026-08-25T12:00:00Z");
  const atras = (min) => new Date(agora - min * 60000).toISOString();
  assert.equal(snapshotAtrasado(atras(119), agora), false);
  assert.equal(snapshotAtrasado(atras(120), agora), false);
  assert.equal(snapshotAtrasado(atras(121), agora), true);
  assert.equal(snapshotAtrasado("", agora), false);
  assert.equal(snapshotAtrasado(new Date(agora + 60_000).toISOString(), agora), false);
});

test("parseSnapshot caps the number of records (anti-flood)", () => {
  const many = Array.from({ length: MAX_RECORDS + 50 }, (_, i) => ({ grupo: "G" + i }));
  assert.equal(parseSnapshot(many).length, MAX_RECORDS);
});

test("parseSnapshot never exposes unknown keys (private data cannot leak through)", () => {
  const [r] = parseSnapshot([{ grupo: "G", telefone: "61 99999-0000", nome: "Fulano" }]);
  assert.equal("telefone" in r, false);
  assert.equal("nome" in r, false);
});

test("cleanField strips invisible characters (Trojan Source, zero-width)", () => {
  // U+202E flips rendering order: a moderator approves one string and the
  // popup shows another. U+200B splits a word so no filter downstream matches.
  assert.equal(cleanField("Cami‮nhada"), "Caminhada");
  assert.equal(cleanField("Cami​nhada"), "Caminhada");
  assert.equal(cleanField("﻿Grupo⁦ da Paz⁩"), "Grupo da Paz");
  assert.equal(cleanField("61\u206099999-0000"), "6199999-0000", "word joiner nao separa telefone");
  assert.equal(cleanField("61\u00AD99999-0000"), "6199999-0000", "soft hyphen nao separa telefone");
  assert.equal(cleanField("Grupo\u0000 Seguro"), "Grupo Seguro", "controle C0 nao chega ao DOM");
  assert.equal(cleanField("Caminhada matinal"), "Caminhada matinal", "texto normal intacto");
});

test("cleanField strips invisibles BEFORE the cut, not after", () => {
  // Otherwise 120 invisible characters would spend the whole budget and the
  // visible name would be truncated to nothing.
  const entrada = "​".repeat(MAX_FIELD) + "Grupo de Caminhada";
  assert.equal(cleanField(entrada), "Grupo de Caminhada");
});

/* ---------- pins por modalidade ----------
   The emoji pin is split across three files on purpose (js/util.js picks a
   slug, css/style.css holds the glyph, scripts/criar_form.gs offers the
   modality), and nothing in the browser complains when they disagree: a slug
   with no CSS rule just renders the fallback, so EVERY group would silently
   come out as the same generic pin. These tests are the only thing that reads
   the three lists together. */

test("pinModalidade picks the first modality that has a pin", () => {
  assert.equal(pinModalidade(["Corrida", "Caminhada"]), "corrida");
  assert.equal(pinModalidade(["Caminhada", "Corrida"]), "caminhada");
});

test("pinModalidade ignores accents and case, like the rest of the pipeline", () => {
  assert.equal(pinModalidade(["Vôlei"]), "volei");
  assert.equal(pinModalidade(["NATAÇÃO"]), "natacao");
  assert.equal(pinModalidade([" ciclismo "]), "ciclismo");
  assert.equal(pinModalidade(["Lutas / artes marciais"]), "lutas");
  assert.equal(pinModalidade(["Muay Thai"]), "lutas");
  assert.equal(pinModalidade(["Skate / patins"]), "skate");
});

test("an unknown or missing modality still gets a pin, never a crash", () => {
  assert.equal(pinModalidade(["Xadrez"]), PIN_PADRAO);
  assert.equal(pinModalidade(["Outra"]), PIN_PADRAO);
  assert.equal(pinModalidade([]), PIN_PADRAO);
  assert.equal(pinModalidade(null), PIN_PADRAO);
  assert.equal(pinModalidade("Corrida"), PIN_PADRAO); // a string is not the list
});

test("every pin slug has its emoji in css/style.css", () => {
  const css = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
  const semRegra = [...PINS_CONHECIDOS, PIN_PADRAO]
    .filter((slug) => {
      // Plain string walk, not a regex: the slug is interpolated into the
      // pattern, and one escaping mistake here turns the gate into a test that
      // passes on an empty stylesheet.
      const at = css.indexOf(`.pin-mov--${slug}`);
      if (at === -1) return true;
      return !css.slice(at, css.indexOf("}", at)).includes("--pin-emoji");
    });
  assert.deepEqual(semRegra, [],
    `sem emoji no CSS (o grupo sairia com o pin generico): ${semRegra.join(", ")}`);
});

test("every modality the form offers has its own pin", () => {
  const gs = readFileSync(new URL("../scripts/criar_form.gs", import.meta.url), "utf8");
  const bloco = gs.match(/var MODALIDADES_COMUNS\s*=\s*\[([^\]]*)\]/);
  assert.ok(bloco, "nao achei MODALIDADES_COMUNS em scripts/criar_form.gs");
  const opcoes = [...bloco[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(opcoes.length >= 16, `so achei ${opcoes.length} modalidades — a regex saiu do lugar`);

  const genericas = opcoes.filter((o) => pinModalidade([o]) === PIN_PADRAO);
  assert.deepEqual(genericas, [],
    `o formulario oferece modalidades sem pin proprio: ${genericas.join(", ")}`);
  assert.match(gs, /configurarModalidades_[\s\S]*?showOtherOption\(true\)/,
    "o formulario precisa aceitar qualquer outra modalidade pelo campo nativo");
});

/* Leaflet's stylesheet is fetched at runtime by js/app.js, so it lands in the
   <head> AFTER css/style.css and wins every tie on source order. `display` is
   the one that matters: .leaflet-marker-icon sets it to block, which would drop
   the emoji into the corner of the circle instead of its centre. Two classes
   beat one — and the day someone "simplifies" this back to a single class, the
   pins go subtly wrong in a way no test would otherwise notice. */
test("the pin's display rule outranks the Leaflet stylesheet loaded after it", () => {
  const css = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
  const at = css.indexOf(".leaflet-marker-icon.pin-mov");
  assert.notEqual(at, -1,
    "a regra de display do pin precisa dos DOIS seletores para vencer o Leaflet");
  assert.match(css.slice(at, css.indexOf("}", at)), /display:\s*grid/);
});

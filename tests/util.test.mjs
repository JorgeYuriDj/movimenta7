import { test } from "node:test";
import assert from "node:assert/strict";
import { safeUrl, cleanField, parseSnapshot, MAX_FIELD, MAX_RECORDS } from "../js/util.js";

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

test("parseSnapshot keeps public contact as link only when http(s)", () => {
  const [a] = parseSnapshot([{ grupo: "G", contato: "https://chat.whatsapp.com/abc" }]);
  assert.equal(a.contatoUrl, "https://chat.whatsapp.com/abc");
  const [b] = parseSnapshot([{ grupo: "G", contato: "@corrida_df" }]);
  assert.equal(b.contatoUrl, "");
  assert.equal(b.contatoTexto, "@corrida_df");
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
  assert.equal(cleanField("Caminhada matinal"), "Caminhada matinal", "texto normal intacto");
});

test("cleanField strips invisibles BEFORE the cut, not after", () => {
  // Otherwise 120 invisible characters would spend the whole budget and the
  // visible name would be truncated to nothing.
  const entrada = "​".repeat(MAX_FIELD) + "Grupo de Caminhada";
  assert.equal(cleanField(entrada), "Grupo de Caminhada");
});

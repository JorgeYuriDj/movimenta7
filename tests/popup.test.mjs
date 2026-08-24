/**
 * Proves the anti-innerHTML gate rejects what it must and accepts what it must.
 * A gate nobody ever saw fail is indistinguishable from a gate that is broken —
 * and this project already shipped one gate that failed legitimate data
 * (see tests/denylist.test.mjs), so both directions are tested here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { analisar, varrerProjeto } from "../scripts/valida_popup.mjs";

test("reprova string literal passada para bindPopup (CVE-2025-69993)", () => {
  const erros = analisar("f.js", 'marker.bindPopup("<b>" + rec.grupo + "</b>");');
  assert.equal(erros.length, 1);
  assert.match(erros[0], /bindPopup/);
});

test("reprova template literal e aspas simples nos setters do Leaflet", () => {
  assert.equal(analisar("f.js", "m.bindTooltip(`${nome}`);").length, 1);
  assert.equal(analisar("f.js", "m.setContent('oi');").length, 1);
});

test("reprova innerHTML e amigos", () => {
  assert.equal(analisar("f.js", "el.innerHTML = x;").length, 1);
  assert.equal(analisar("f.js", "el.insertAdjacentHTML('beforeend', x);").length, 1);
});

test("ACEITA Element — o caminho correto que o app usa hoje", () => {
  assert.deepEqual(analisar("f.js", "marker.bindPopup(popupFor(rec));"), []);
  assert.deepEqual(analisar("f.js", "marker.bindPopup( box );"), []);
});

test("NAO reprova a propria documentacao: 'innerHTML' em comentario e em texto", () => {
  const src = [
    "// Popup content is built node by node — textContent only, never innerHTML.",
    "/* do not use innerHTML here */",
    'const aviso = "nunca use innerHTML";',
    "el.textContent = aviso;",
  ].join("\n");
  assert.deepEqual(analisar("f.js", src), []);
});

test("nao confunde // dentro de URL com inicio de comentario", () => {
  const src = 'const u = "https://exemplo.org/a"; el.innerHTML = x;';
  const erros = analisar("f.js", src);
  assert.equal(erros.length, 1, "o innerHTML depois da URL tem de ser visto");
});

test("o codigo do site passa pelo gate hoje", () => {
  const { arquivos, erros } = varrerProjeto();
  assert.ok(arquivos.length > 0, "o gate precisa ter arquivos para varrer");
  assert.deepEqual(erros, []);
});

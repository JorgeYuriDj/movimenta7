import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reg = JSON.parse(readFileSync(new URL("../data/regioes.json", import.meta.url), "utf8"));
const geo = JSON.parse(readFileSync(new URL("../data/ra_df.geojson", import.meta.url), "utf8"));
const gs = readFileSync(new URL("../scripts/criar_form.gs", import.meta.url), "utf8");

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const feicoes = new Set(geo.features.map((f) => norm(f.properties?.ra)));

/** The 36 dropdown options the Google Form actually offers. */
function opcoesDoFormulario() {
  // Anchored on the setTitle CALL, not on the title text. The text now also
  // appears in the TITULOS constant at the top of the file, and splitting on it
  // landed this parser on the consent question's choices instead — a test that
  // reads the wrong block is worse than no test, because it still goes green
  // once the wrong block happens to satisfy it.
  const bloco = gs.split("setTitle(TITULOS.regiao)")[1].split("setChoiceValues([")[1].split("]);")[0];
  return [...bloco.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

// Regression: 6 of the 36 form options did not resolve to a polygon. Three of
// them differ only in whitespace ("Sol Nascente/  Pôr do Sol" has a double
// space in the official layer). Groups in those regions were counted and then
// silently dropped from the map — the only signal was a console.warn.
test("every form option is declared in data/regioes.json", () => {
  const declarados = new Set(reg.regioes.map((r) => norm(r.rotulo)));
  const faltando = opcoesDoFormulario().filter((o) => !declarados.has(norm(o)));
  assert.deepEqual(faltando, [], `opcoes do formulario sem declaracao: ${faltando.join(" | ")}`);
});

test("every declared feicao exists in the official IPEDF layer", () => {
  const quebradas = reg.regioes
    .filter((r) => r.feicao != null && !feicoes.has(norm(r.feicao)))
    .map((r) => `${r.rotulo} -> ${r.feicao}`);
  assert.deepEqual(quebradas, [], `feicoes inexistentes na camada: ${quebradas.join(" | ")}`);
});

test("a region without a feicao must say sem_pin explicitly", () => {
  const ambiguas = reg.regioes.filter((r) => r.feicao == null && r.sem_pin !== true).map((r) => r.rotulo);
  assert.deepEqual(ambiguas, [], "regiao sem feicao precisa declarar \"sem_pin\": true");
});

test("the tricky cases stay pinned to their exact layer names", () => {
  const por = (rot) => reg.regioes.find((r) => norm(r.rotulo) === norm(rot));
  assert.equal(por("Sol Nascente/Pôr do Sol").feicao, "Sol Nascente/  Pôr do Sol");
  assert.equal(por("Sudoeste/Octogonal").feicao, "Sudoeste/ Octogonal");
  assert.equal(por("SCIA/Estrutural").feicao, "SCIA");
  assert.equal(por("Entorno (fora do DF)").sem_pin, true);
});

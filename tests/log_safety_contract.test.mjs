import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ingest = readFileSync(new URL("../scripts/ingerir_csv.mjs", import.meta.url), "utf8");
const publish = readFileSync(new URL("../scripts/publicar_snapshot.mjs", import.meta.url), "utf8");

test("logs publicos identificam a linha sem repetir grupo ou regiao recusados", () => {
  assert.doesNotMatch(ingest, /\$\{rec\.regiao\}/);
  assert.doesNotMatch(publish, /\$\{r\?\.grupo\}|\$\{r\.grupo\}|\$\{r\.regiao\}/);
  assert.match(publish, /const rotulo = `registro \$\{i \+ 1\}`/);
});

test("erros estruturais nao imprimem nomes inesperados da planilha", () => {
  assert.doesNotMatch(ingest, /intrusas\.join/);
});

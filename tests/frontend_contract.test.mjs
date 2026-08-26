import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

test("o cadastro embutido continua isolado no Google e so carrega por acao do usuario", () => {
  assert.match(html, /frame-src https:\/\/docs\.google\.com/);
  assert.match(html, /<iframe id="cadastro-frame"(?![^>]*\ssrc=)/);
  assert.match(app, /p\.hostname !== "docs\.google\.com"/);
  assert.match(app, /searchParams\.set\("embedded", "true"\)/);
  assert.match(app, /showModal\(\)/);
});

test("o mapa confere um snapshot novo sem depender de recarregar a pagina", () => {
  assert.match(app, /const POLL_NORMAL = 60_000/);
  assert.match(app, /addEventListener\("focus", conferir\)/);
  assert.match(app, /addEventListener\("visibilitychange"/);
  assert.match(app, /Math\.floor\(Date\.now\(\) \/ POLL_NORMAL\)/,
    "visitantes da mesma janela devem compartilhar o cache da CDN");
  assert.doesNotMatch(app, /cache: "no-store"/);
  assert.match(app, /snapshotAtrasado/);
});

test("busca, filtros e lista acessivel existem mesmo sem tiles do mapa", () => {
  for (const id of ["busca", "filtro-modalidade", "filtro-regiao", "lista-grupos", "dados-tentar"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="mapa"[^>]*role="region"[^>]*aria-busy="true"/);
  assert.match(html, /id="dados-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(app, /replaceChildren\(\)/, "a lista deve ser reconciliada sem HTML cru");
});

test("a interface nao finge precisao e mantem rota como acao principal", () => {
  assert.match(app, /Posição aproximada — centro da região/);
  assert.match(app, /Ponto exato do link/);
  assert.match(app, /Como chegar ↗/);
  assert.match(app, /pin-mov--aproximado/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const leafletJsBytes = readFileSync(new URL("../vendor/leaflet/leaflet.js", import.meta.url));
const leafletCssBytes = readFileSync(new URL("../vendor/leaflet/leaflet.css", import.meta.url));
const leafletJs = leafletJsBytes.toString("utf8");
const leafletCss = leafletCssBytes.toString("utf8");

function sriSha256(bytes) {
  return `sha256-${createHash("sha256").update(bytes).digest("base64")}`;
}

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

test("Leaflet fica no proprio site e nao depende de CDN para abrir o mapa", () => {
  assert.ok(app.includes('href: "vendor/leaflet/leaflet.css"'));
  assert.ok(app.includes('src: "vendor/leaflet/leaflet.js"'));
  assert.equal(app.includes("unpkg.com"), false);
  assert.equal(html.includes("unpkg.com"), false);
  assert.match(leafletJs, /Leaflet 1\.9\.4/);
  assert.match(leafletCss, /\.leaflet-container/);
  assert.ok(app.includes(`integrity: "${sriSha256(leafletJsBytes)}"`), "SRI do JS precisa corresponder ao arquivo");
  assert.ok(app.includes(`integrity: "${sriSha256(leafletCssBytes)}"`), "SRI do CSS precisa corresponder ao arquivo");
});

test("a interface nao finge precisao e mantem rota como acao principal", () => {
  assert.match(app, /Posição aproximada — centro da região/);
  assert.match(app, /Ponto exato do link/);
  assert.match(app, /Como chegar ↗/);
  assert.match(app, /pin-mov--aproximado/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readText(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n?/g, "\n");
}

const ci = readText("../.github/workflows/ci.yml");
const refresh = readText("../.github/workflows/refresh.yml");
const dependabot = readText("../.github/dependabot.yml");
const runbook = readText("../moderacao/COMO_LIGAR_A_PLANILHA.md");
const adr = readText("../docs/adr/0007-feed-privado-e-atualizacao-automatica.md");

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  assert.notEqual(from, -1, `secao ausente: ${start.trim()}`);
  assert.notEqual(to, -1, `fim de secao ausente: ${end?.trim()}`);
  return source.slice(from, to);
}

test("CI remains directly dispatchable and reusable, with schedule isolated", () => {
  const triggers = between(ci, "\non:\n", "\npermissions:\n");
  assert.match(triggers, /^  workflow_dispatch:\s*$/m);
  assert.match(triggers, /^  workflow_call:\s*$/m);
  assert.match(triggers, /branches: \[main\]/);
  assert.doesNotMatch(triggers, /^  schedule:/m);

  assert.match(refresh, /cron: "7,17,27,37,47,57 \* \* \* \*"/);
  assert.match(refresh, /uses: \.\/\.github\/workflows\/ci\.yml/);
  assert.match(refresh, /^    secrets: inherit$/m);
});

test("QA has no secrets and publication is main-only behind github-pages", () => {
  const qa = between(ci, "\n  qa:\n", "\n  publish:\n");
  const publish = between(ci, "\n  publish:\n");

  assert.doesNotMatch(qa, /secrets\./);
  assert.match(publish, /^    needs: qa$/m);
  assert.match(publish, /github\.ref == 'refs\/heads\/main'/);
  assert.match(publish, /github\.event_name != 'pull_request'/);
  assert.match(publish, /^    environment:\n      name: github-pages$/m);
  assert.match(publish, /PLANILHA_FEED_URL:\s*\$\{\{ secrets\.PLANILHA_FEED_URL \}\}/);
  assert.match(publish, /PLANILHA_FEED_TOKEN:\s*\$\{\{ secrets\.PLANILHA_FEED_TOKEN \}\}/);
  assert.match(publish, /^      pages: write$/m);
  assert.match(publish, /^      id-token: write$/m);
});

test("all first-party Actions are pinned to the audited commit SHAs", () => {
  const expected = new Map([
    ["actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1"],
    ["actions/setup-node", "820762786026740c76f36085b0efc47a31fe5020"],
    ["actions/cache/restore", "55cc8345863c7cc4c66a329aec7e433d2d1c52a9"],
    ["actions/cache/save", "55cc8345863c7cc4c66a329aec7e433d2d1c52a9"],
    ["actions/upload-pages-artifact", "fc324d3547104276b827a68afc52ff2a11cc49c9"],
    ["actions/deploy-pages", "cd2ce8fcbc39b97be8ca5fce6e763baed58fa128"],
  ]);
  const found = [...ci.matchAll(/uses:\s+(actions\/[\w/-]+)@([0-9a-f]{40})\s+#\s+v\d+/g)];
  assert.ok(found.length >= expected.size, "referencias de Actions sem SHA completo/comentario de versao");
  for (const [action, sha] of expected) {
    assert.ok(found.some((match) => match[1] === action && match[2] === sha), `${action} nao esta no SHA auditado`);
  }
  assert.doesNotMatch(ci, /uses:\s+actions\/[\w/-]+@v\d+/);
});

test("scheduled caller delegates the permissions required by Pages", () => {
  for (const permission of ["contents: read", "pages: write", "id-token: write"]) {
    assert.ok(refresh.includes(permission), `refresh sem ${permission}`);
  }
});

test("artifact inclui a dependencia local do mapa", () => {
  assert.match(ci, /cp -r css js data assets vendor _site\//);
});

test("Dependabot checks GitHub Actions weekly", () => {
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.match(dependabot, /interval: weekly/);
});

test("owner runbook keeps the operational security contract explicit", () => {
  assert.match(runbook, /Environment secrets/);
  assert.match(runbook, /sem colaboradores editores/);
  assert.match(runbook, /janela anônima\/privativa/);
  assert.match(runbook, /Actions: write não significa “só apertar um botão”/);
  assert.match(runbook, /build_type: workflow/);
  assert.match(runbook, /desativação não atinge `\.github\/workflows\/ci\.yml`/);
  assert.match(runbook, /gere localmente um segredo aleatório com pelo menos 32 caracteres/);
  assert.match(runbook, /prefira 64/);
  assert.match(runbook, /nunca deve mostrar o valor/);
  assert.doesNotMatch(runbook, /token mostrado por `configurarFeedPrivado`/);
  assert.match(adr, /`publish` só\s+recebe os Environment secrets/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { feedParaCSV, lerTextoLimitado, parseCSV, registrosPublicaveis } from "../scripts/ingerir_csv.mjs";

const CAB = "grupo,organizacao,regiao,modalidades,dias,horario,local,rede_social,mapa," +
  "orientacao_profissional,custo,publico,remover";
// Quoting a field that contains a comma is what a real CSV export does; without
// it the field would simply be two columns, and the test would be testing a
// document Google Sheets never produces.
const csvCampo = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const linha = (o = {}) => [
  o.grupo ?? "Caminhada da Manha", o.organizacao ?? "Igreja Central",
  o.regiao ?? "Plano Piloto", o.modalidades ?? "Caminhada", o.dias ?? "Segunda",
  o.horario ?? "06h30", o.local ?? "Parque da Cidade",
  o.rede_social ?? "@grupo", o.mapa ?? "https://maps.app.goo.gl/abc",
  o.orientacao ?? "Encontro social de pratica livre",
  o.custo ?? "Gratuito", o.publico ?? "Iniciantes bem-vindos",
  o.remover ?? "FALSE",
].map(csvCampo).join(",");

test("parseCSV respeita virgula e quebra de linha dentro de aspas", () => {
  const l = parseCSV('a,"b,c","d\ne",f');
  assert.deepEqual(l, [["a", "b,c", "d\ne", "f"]]);
});

test("parseCSV entende aspas duplicadas como aspa literal", () => {
  assert.deepEqual(parseCSV('x,"diz ""oi"" aqui"'), [["x", 'diz "oi" aqui']]);
});

test("o feed privado tem contrato versionado e largura fixa", () => {
  const csv = feedParaCSV({
    ok: true,
    schema_version: 1,
    colunas: CAB.split(","),
    linhas: [linha().split(",")],
  });
  assert.equal(registrosPublicaveis(csv).length, 1);
  assert.throws(() => feedParaCSV({ ok: true, schema_version: 2 }), /schema_version=1/);
  assert.throws(() => feedParaCSV({
    ok: true, schema_version: 1, colunas: ["a", "b"], linhas: [["x"]],
  }), /largura/);
});

test("o teto do feed conta bytes UTF-8 e interrompe antes de aceitar multibyte demais", async () => {
  assert.equal(await lerTextoLimitado(new Response("á"), 2), "á");
  await assert.rejects(() => lerTextoLimitado(new Response("áá"), 3), /limite de bytes/);
  await assert.rejects(() => lerTextoLimitado(new Response("ok", {
    headers: { "content-length": "99" },
  }), 10), /limite de bytes/);
});

// ADR-0006: a caixinha "aprovado" deixou de existir. Este teste e o que trava a
// decisao do dono — todo cadastro entra, sem fila.
test("todo cadastro entra sozinho: nao existe mais fila de aprovacao", () => {
  const csv = [CAB, linha(), linha({ grupo: "Outro Grupo" })].join("\n");
  const r = registrosPublicaveis(csv);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((x) => x.grupo), ["Caminhada da Manha", "Outro Grupo"]);
});

test("marcado para remover sai do ar", () => {
  const csv = [CAB, linha({ remover: "TRUE" })].join("\n");
  assert.deepEqual(registrosPublicaveis(csv), []);
});

// Quem montou a aba PUBLICAR no desenho antigo tem uma coluna "aprovado" la.
// Ela nao pode derrubar a ingestao nem voltar a segurar cadastro.
test("a coluna antiga 'aprovado' e aceita e ignorada", () => {
  const cab = CAB + ",aprovado";
  const csv = [cab, linha() + ",FALSE"].join("\n");
  const r = registrosPublicaveis(csv);
  assert.equal(r.length, 1, "FALSE em 'aprovado' nao segura mais nada");
  assert.equal("aprovado" in r[0], false, "e coluna de controle, nao vira campo publico");
});

test("campos de lista viram array", () => {
  const csv = [CAB, linha({ modalidades: "Caminhada, Corrida", dias: "Segunda, Quarta" })].join("\n");
  const r = registrosPublicaveis(csv)[0];
  assert.deepEqual(r.modalidades, ["Caminhada", "Corrida"]);
  assert.deepEqual(r.dias, ["Segunda", "Quarta"]);
});

test("NAO deixa forjar um cadastro pelo texto de um campo", () => {
  // Um split(",") ingenuo leria isto como duas linhas e criaria um cadastro
  // que ninguem enviou. Agora que tudo publica sozinho, isso seria uma forma de
  // inventar grupos escrevendo dentro do nome de um.
  const csv = [CAB, linha({ grupo: "Grupo\nFALSO,Igreja,Plano Piloto,Caminhada,Segunda,06h30,L,@x,,x,Gratuito,Todos,FALSE" })].join("\n");
  const r = registrosPublicaveis(csv);
  assert.equal(r.length, 1, "a linha forjada nao pode virar um registro proprio");
  assert.match(r[0].grupo, /FALSO/, "o texto continua sendo apenas texto de um campo");
});

test("a ordem das colunas nao importa: resolve por NOME", () => {
  const cab = "remover,publico,custo,orientacao_profissional,mapa,rede_social," +
    "local,horario,dias,modalidades,regiao,organizacao,grupo";
  const csv = [cab, "FALSE,Todos,Gratuito,livre,https://maps.app.goo.gl/x,@g,Parque,06h30,Segunda,Caminhada,Taguatinga,Igreja X,Grupo Y"].join("\n");
  const r = registrosPublicaveis(csv)[0];
  assert.equal(r.grupo, "Grupo Y");
  assert.equal(r.regiao, "Taguatinga");
  assert.equal(r.rede_social, "https://www.instagram.com/g");
});

/* ---------- quarentena por cadastro (ADR-0006) ----------
   Sem revisao humana, uma linha ruim NAO pode derrubar o build: isso daria a
   qualquer pessoa o poder de congelar o site inteiro preenchendo o formulario
   com lixo. Ela sai sozinha e o resto publica. */

test("cadastro com dado pessoal e pulado, e o resto do mapa continua no ar", () => {
  const csv = [CAB,
    linha({ grupo: "Grupo Bom" }),
    linha({ grupo: "Grupo Ruim", local: "Chame no 61 99999-0000" }),
    linha({ grupo: "Outro Bom", regiao: "Gama" }),
  ].join("\n");
  const r = registrosPublicaveis(csv);
  assert.deepEqual(r.map((x) => x.grupo), ["Grupo Bom", "Outro Bom"]);
});

test("caracter invisivel ou digito full-width nao esconde telefone", () => {
  const csv = [CAB,
    linha({ grupo: "Com zero width", local: "Chame 61\u200B99999-0000" }),
    linha({ grupo: "Com word joiner", local: "Chame 61\u206099999-0000" }),
    linha({ grupo: "Com soft hyphen", local: "Chame 61\u00AD99999-0000" }),
    linha({ grupo: "Com barra", local: "Chame 61/99999/0000" }),
    linha({ grupo: "Com full width", local: "Chame ６１ ９９９９９-００００" }),
    linha({ grupo: "Seguro" }),
  ].join("\n");
  assert.deepEqual(registrosPublicaveis(csv).map((r) => r.grupo), ["Seguro"]);
});

test("texto publico e normalizado e limitado antes de ser gravado", () => {
  const [r] = registrosPublicaveis([CAB, linha({ grupo: "Ａ".repeat(200) })].join("\n"));
  assert.equal(r.grupo, "A".repeat(120));
});

test("sem rede social ou rota validas o cadastro inteiro fica em quarentena", () => {
  const csv = [CAB, linha({ rede_social: "https://malware.example", mapa: "sei la" })].join("\n");
  assert.deepEqual(registrosPublicaveis(csv), []);
  assert.deepEqual(registrosPublicaveis([CAB, linha({ rede_social: "", mapa: "" })].join("\n")), []);
});

test("telefone disfarçado de perfil social nunca vira link publico", () => {
  const csv = [CAB, linha({ rede_social: "@61999990000" }), linha({ grupo: "Seguro" })].join("\n");
  assert.deepEqual(registrosPublicaveis(csv).map((r) => r.grupo), ["Seguro"]);
});

test("links aceitos sao gravados ja normalizados, nunca o texto cru", () => {
  // moderacao/aprovados.json e publico: guardar o texto digitado seria guardar
  // o que a checagem acabou de recusar.
  const csv = [CAB, linha({ rede_social: "iasd.central", mapa: "https://maps.app.goo.gl/xyz" })].join("\n");
  const r = registrosPublicaveis(csv)[0];
  assert.equal(r.rede_social, "https://www.instagram.com/iasd.central");
  assert.equal(r.mapa, "https://maps.app.goo.gl/xyz");
});

test("PII escondida em URL de mapa fica em quarentena sem aparecer no log", () => {
  const hostis = [
    "https://joao%40exemplo.org:segredo@www.google.com/maps/place/X",
    "https://maps.google.com/?q=61%2099999-0000",
    "https://maps.google.com/?q=529.982.247-25",
    "https://www.openstreetmap.org/search?query=11.222.333%2F0001-81",
  ];
  const avisos = [];
  const anterior = console.warn;
  console.warn = (msg) => avisos.push(String(msg));
  let registros;
  try {
    registros = registrosPublicaveis([
      CAB,
      ...hostis.map((mapa, i) => linha({ grupo: `Hostil ${i}`, mapa })),
      linha({ grupo: "Seguro", mapa: "https://maps.app.goo.gl/abc?g_st=ic#tracker" }),
    ].join("\n"));
  } finally {
    console.warn = anterior;
  }
  assert.deepEqual(registros.map((r) => r.grupo), ["Seguro"]);
  assert.equal(registros[0].mapa, "https://maps.app.goo.gl/abc");
  for (const bruto of hostis) assert.equal(avisos.some((msg) => msg.includes(bruto)), false);
});

test("regiao que o mapa nao conhece pula o cadastro em vez de reprovar o build", () => {
  const csv = [CAB, linha({ grupo: "Fora do mapa", regiao: "Rio de Janeiro" }), linha()].join("\n");
  const r = registrosPublicaveis(csv);
  assert.deepEqual(r.map((x) => x.grupo), ["Caminhada da Manha"]);
});

test("logs de descarte nunca repetem o valor hostil de uma celula", () => {
  const segredo = "REGIAO-61-99999-0000";
  const avisos = [];
  const anterior = console.warn;
  console.warn = (msg) => avisos.push(String(msg));
  try {
    registrosPublicaveis([CAB, linha({ regiao: segredo }), linha()].join("\n"));
  } finally {
    console.warn = anterior;
  }
  assert.equal(avisos.some((msg) => msg.includes(segredo)), false);
});

test("envio duplicado entra uma vez so", () => {
  // Formulario aberto: gente clica em enviar duas vezes.
  const csv = [CAB, linha(), linha(), linha({ local: "Outro parque" })].join("\n");
  const r = registrosPublicaveis(csv);
  assert.equal(r.length, 2, "mesmo grupo/regiao/local colapsa; local diferente e outro encontro");
});

test("enxurrada e cortada no teto, sem reprovar o build", () => {
  // Reprovar acima do teto congelaria o site — que e exatamente o que uma
  // enxurrada quer. Corta e avisa.
  const muitas = Array.from({ length: 520 }, (_, i) => linha({ grupo: "Grupo " + i }));
  const r = registrosPublicaveis([CAB, ...muitas].join("\n"));
  assert.equal(r.length, 500);
});

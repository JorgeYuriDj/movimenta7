import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCSV, registrosAprovados } from "../scripts/ingerir_csv.mjs";

const CAB = "grupo,organizacao,regiao,modalidades,dias,horario,local,contato," +
  "orientacao_profissional,custo,publico,aprovado,remover";
// Quoting a field that contains a comma is what a real CSV export does; without
// it the field would simply be two columns, and the test would be testing a
// document Google Sheets never produces.
const csvCampo = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const linha = (o = {}) => [
  o.grupo ?? "Caminhada da Manha", o.organizacao ?? "Igreja Central",
  o.regiao ?? "Plano Piloto", o.modalidades ?? "Caminhada", o.dias ?? "Segunda",
  o.horario ?? "06h30", o.local ?? "Parque da Cidade", o.contato ?? "@grupo",
  o.orientacao ?? "sim", o.custo ?? "Gratuito", o.publico ?? "Todos",
  o.aprovado ?? "TRUE", o.remover ?? "FALSE",
].map(csvCampo).join(",");

test("parseCSV respeita virgula e quebra de linha dentro de aspas", () => {
  const l = parseCSV('a,"b,c","d\ne",f');
  assert.deepEqual(l, [["a", "b,c", "d\ne", "f"]]);
});

test("parseCSV entende aspas duplicadas como aspa literal", () => {
  assert.deepEqual(parseCSV('x,"diz ""oi"" aqui"'), [["x", 'diz "oi" aqui']]);
});

test("so entra o que esta marcado como aprovado", () => {
  const csv = [CAB, linha(), linha({ grupo: "Nao aprovado", aprovado: "FALSE" })].join("\n");
  const r = registrosAprovados(csv);
  assert.equal(r.length, 1);
  assert.equal(r[0].grupo, "Caminhada da Manha");
});

test("marcado para remover sai do ar mesmo estando aprovado", () => {
  const csv = [CAB, linha({ remover: "TRUE" })].join("\n");
  assert.deepEqual(registrosAprovados(csv), []);
});

test("campos de lista viram array", () => {
  const csv = [CAB, linha({ modalidades: "Caminhada, Corrida", dias: "Segunda, Quarta" })].join("\n");
  const r = registrosAprovados(csv)[0];
  assert.deepEqual(r.modalidades, ["Caminhada", "Corrida"]);
  assert.deepEqual(r.dias, ["Segunda", "Quarta"]);
});

test("NAO deixa forjar uma aprovacao pelo texto de um campo", () => {
  // Um split(",") ingenuo leria isto como duas linhas e criaria um cadastro
  // aprovado que ninguem aprovou.
  const csv = [CAB, linha({ grupo: "Grupo\nFALSO,Igreja,Plano Piloto,Caminhada,Segunda,06h30,L,@x,sim,Gratuito,Todos,TRUE,FALSE" })].join("\n");
  const r = registrosAprovados(csv);
  assert.equal(r.length, 1, "a linha forjada nao pode virar um registro proprio");
  assert.match(r[0].grupo, /FALSO/, "o texto continua sendo apenas texto de um campo");
});

test("a ordem das colunas nao importa: resolve por NOME", () => {
  const cab = "remover,aprovado,publico,custo,orientacao_profissional,contato," +
    "local,horario,dias,modalidades,regiao,organizacao,grupo";
  const csv = [cab, "FALSE,TRUE,Todos,Gratuito,sim,@g,Parque,06h30,Segunda,Caminhada,Taguatinga,Igreja X,Grupo Y"].join("\n");
  const r = registrosAprovados(csv)[0];
  assert.equal(r.grupo, "Grupo Y");
  assert.equal(r.regiao, "Taguatinga");
  assert.equal(r.contato, "@g");
});

import test from "node:test";
import assert from "node:assert/strict";
import { MAX_FIELD, MAX_URL } from "../js/util.js";
import { validarSnapshot } from "../scripts/valida_snapshot.mjs";

const instante = "2026-08-25T19:39:24.728Z";
const registroValido = (mudancas = {}) => ({
  grupo: "Caminhada da Manha",
  organizacao: "Igreja Central",
  regiao: "Plano Piloto",
  modalidades: ["Caminhada"],
  dias: ["Segunda"],
  horario: "06h30",
  local: "Parque da Cidade",
  custo: "Gratuito",
  publico: ["Adultos"],
  orientacao_profissional: "Encontro social de pratica livre",
  rede_social: "https://www.instagram.com/caminhada",
  mapa: "https://www.google.com/maps/place/Parque",
  lat: -15.79,
  lon: -47.88,
  posicao: "exata",
  ...mudancas,
});
const snapshot = (registros = [registroValido()]) => ({ atualizado_em: instante, registros });

test("aceita o contrato publicado e o snapshot vazio", () => {
  assert.deepEqual(validarSnapshot(snapshot()), []);
  assert.deepEqual(validarSnapshot(snapshot([])), [], "zero cadastros continua sendo um estado valido");
});

test("a raiz tem formato fixo e timestamp canonico", () => {
  assert.match(validarSnapshot([]).join("\n"), /raiz.*objeto/);
  assert.match(validarSnapshot({ atualizado_em: instante }).join("\n"), /registros deve ser uma lista/);
  assert.match(validarSnapshot({ atualizado_em: "ontem", registros: [] }).join("\n"), /ISO-8601/);
  assert.match(validarSnapshot({ atualizado_em: instante, registros: [], segredo: "x" }).join("\n"), /campo desconhecido/);
});

test("cada registro usa o esquema completo e tipos declarados", () => {
  const semCusto = registroValido();
  delete semCusto.custo;
  assert.match(validarSnapshot(snapshot([semCusto])).join("\n"), /falta o campo "custo"/);
  assert.match(validarSnapshot(snapshot([registroValido({ dias: "Segunda" })])).join("\n"), /dias: deve ser uma lista/);
  assert.match(validarSnapshot(snapshot([registroValido({ grupo: 42 })])).join("\n"), /grupo: deve ser texto/);
  assert.match(validarSnapshot(snapshot([registroValido({ telefone: "61999990000" })])).join("\n"), /nao esta na lista/);
});

test("limita texto, quantidade das listas e tamanho das URLs", () => {
  const erros = validarSnapshot(snapshot([registroValido({
    grupo: "x".repeat(MAX_FIELD + 1),
    modalidades: Array.from({ length: 21 }, (_, i) => `Modalidade ${i}`),
    dias: Array.from({ length: 8 }, (_, i) => `Dia ${i}`),
    publico: Array.from({ length: 7 }, (_, i) => `Publico ${i}`),
    rede_social: "https://www.instagram.com/" + "x".repeat(MAX_URL),
  })])).join("\n");
  assert.match(erros, /grupo: excede 120/);
  assert.match(erros, /modalidades: excede 20 itens/);
  assert.match(erros, /dias: excede 7 itens/);
  assert.match(erros, /publico: excede 6 itens/);
  assert.match(erros, /rede_social: excede 2048/);
});

test("rede social e rota sao obrigatorias no snapshot publico", () => {
  const erros = validarSnapshot(snapshot([registroValido({
    rede_social: "",
    mapa: "",
  })])).join("\n");
  assert.match(erros, /rede_social: nao pode ser vazio/);
  assert.match(erros, /mapa: nao pode ser vazio/);
});

test("share.google nunca chega sem resolucao ao snapshot publico", () => {
  const erros = validarSnapshot(snapshot([registroValido({
    mapa: "https://share.google/FfiPZmaScAgrNXWab",
  })])).join("\n");
  assert.match(erros, /share\.google precisa estar resolvido/);
  assert.deepEqual(validarSnapshot(snapshot([registroValido({
    mapa: "https://www.google.com/maps/search/?api=1&query=Skatepark+Samambaia",
  })])), []);
});

test("recusa item vazio, texto nao normalizado e PII dentro de lista", () => {
  const erros = validarSnapshot(snapshot([registroValido({
    grupo: "  Grupo  com  espaco  ",
    modalidades: ["", "Ligue 61 99999-0000"],
  })])).join("\n");
  assert.match(erros, /texto nao esta normalizado/);
  assert.match(erros, /item vazio/);
  assert.match(erros, /cara de telefone/);
});

test("posicao aceita somente exata ou regiao", () => {
  assert.match(validarSnapshot(snapshot([registroValido({ posicao: "GPS" })])).join("\n"),
    /deve ser "exata" ou "regiao"/);

  const aproximada = registroValido({ posicao: "regiao" });
  delete aproximada.lat;
  delete aproximada.lon;
  assert.deepEqual(validarSnapshot(snapshot([aproximada])), [],
    "uma regiao declarada sem pin pode legitimamente nao ter coordenada");
});

test("coordenadas sao numericas, pareadas e plausiveis no DF", () => {
  const semLon = registroValido();
  delete semLon.lon;
  assert.match(validarSnapshot(snapshot([semLon])).join("\n"), /lat e lon devem existir juntas/);
  assert.match(validarSnapshot(snapshot([registroValido({ lat: "-15.79" })])).join("\n"),
    /devem ser numeros finitos/);
  assert.match(validarSnapshot(snapshot([registroValido({ lat: -23.55, lon: -46.63 })])).join("\n"),
    /fora dos limites plausiveis do DF/);

  const exataSemCoordenada = registroValido();
  delete exataSemCoordenada.lat;
  delete exataSemCoordenada.lon;
  assert.match(validarSnapshot(snapshot([exataSemCoordenada])).join("\n"),
    /posicao exata exige lat e lon validas/);
});

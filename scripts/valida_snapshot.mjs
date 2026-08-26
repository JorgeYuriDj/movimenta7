/**
 * movimenta7 — last, fail-closed gate before data/snapshot.json is deployed.
 *
 * The ingest quarantines a bad submission. This file has a different job: its
 * input was produced by our own publisher, so a malformed value here means a
 * pipeline regression (or a hand-edited public file) and must stop the build.
 *
 * Run: node scripts/valida_snapshot.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CAMPOS_PUBLICOS, CHECAGENS_DE_VALOR, isPrivateKey } from "./denylist.mjs";
import { cleanField, MAX_FIELD, MAX_RECORDS, MAX_URL } from "../js/util.js";

const PATH = new URL("../data/snapshot.json", import.meta.url);

// publicar_snapshot.mjs always emits these fields, even when their value is
// empty. Keeping one fixed record shape makes omissions visible in CI instead
// of turning them into subtly incomplete cards in the browser.
const CAMPOS_TEXTO = new Set([
  "grupo", "organizacao", "regiao", "horario", "local", "custo",
  "orientacao_profissional",
]);
const CAMPOS_LINK = new Set(["rede_social", "mapa"]);
const LIMITES_LISTA = new Map([
  ["modalidades", 9],
  ["dias", 7],
  ["publico", 6],
]);
const CAMPOS_OBRIGATORIOS = new Set([
  ...CAMPOS_TEXTO, ...CAMPOS_LINK, ...LIMITES_LISTA.keys(), "posicao",
]);
const CAMPOS_RAIZ = new Set(["atualizado_em", "registros"]);

const dentroDaCaixaDoDF = (lat, lon) =>
  lat >= -16.6 && lat <= -15.0 && lon >= -48.8 && lon <= -46.8;

function validarTexto(erros, valor, caminho) {
  if (typeof valor !== "string") {
    erros.push(`${caminho}: deve ser texto`);
    return;
  }
  if (valor.length > MAX_FIELD) {
    erros.push(`${caminho}: excede ${MAX_FIELD} caracteres`);
  }
  // The publisher receives already-clean fields from the ingest. A difference
  // here catches controls/invisibles, compatibility glyphs and whitespace that
  // could otherwise render differently from what the safety checks inspected.
  if (cleanField(valor) !== valor) {
    erros.push(`${caminho}: texto nao esta normalizado`);
  }
}

/**
 * Returns every contract violation without throwing or exiting.
 * An empty, correctly-shaped snapshot is valid: zero registrations is a real
 * state and must not be confused with a malformed document.
 */
export function validarSnapshot(doc) {
  const erros = [];

  if (doc == null || typeof doc !== "object" || Array.isArray(doc)) {
    return ["raiz: deve ser um objeto com atualizado_em e registros"];
  }

  for (const chave of Object.keys(doc)) {
    if (!CAMPOS_RAIZ.has(chave)) erros.push(`raiz: campo desconhecido "${chave}"`);
  }

  if (typeof doc.atualizado_em !== "string" ||
      !Number.isFinite(Date.parse(doc.atualizado_em)) ||
      new Date(doc.atualizado_em).toISOString() !== doc.atualizado_em) {
    erros.push("raiz: atualizado_em deve ser uma data ISO-8601 canonica");
  }

  if (!Array.isArray(doc.registros)) {
    erros.push("raiz: registros deve ser uma lista");
    return erros;
  }
  const registros = doc.registros;

  if (registros.length > MAX_RECORDS) {
    erros.push(`o snapshot tem ${registros.length} registros e o site so desenha ${MAX_RECORDS}`);
  }

  registros.forEach((r, i) => {
    const prefixo = `registro ${i}`;
    if (r == null || typeof r !== "object" || Array.isArray(r)) {
      erros.push(`${prefixo}: nao e um objeto`);
      return;
    }

    for (const chave of CAMPOS_OBRIGATORIOS) {
      if (!Object.hasOwn(r, chave)) erros.push(`${prefixo}: falta o campo "${chave}"`);
    }

    for (const [k, v] of Object.entries(r)) {
      if (!CAMPOS_PUBLICOS.has(k)) {
        erros.push(`${prefixo}: campo "${k}" nao esta na lista de campos publicos`);
        continue;
      }
      if (isPrivateKey(k)) {
        erros.push(`${prefixo}: chave proibida "${k}" (dado privado no snapshot publico)`);
      }

      if (CAMPOS_TEXTO.has(k)) {
        validarTexto(erros, v, `${prefixo}.${k}`);
      } else if (CAMPOS_LINK.has(k)) {
        if (typeof v !== "string") erros.push(`${prefixo}.${k}: deve ser texto`);
        else if (!v) erros.push(`${prefixo}.${k}: nao pode ser vazio`);
        else if (v.length > MAX_URL) erros.push(`${prefixo}.${k}: excede ${MAX_URL} caracteres`);
      } else if (LIMITES_LISTA.has(k)) {
        if (!Array.isArray(v)) {
          erros.push(`${prefixo}.${k}: deve ser uma lista`);
        } else {
          const limite = LIMITES_LISTA.get(k);
          if (v.length > limite) erros.push(`${prefixo}.${k}: excede ${limite} itens`);
          v.forEach((item, j) => {
            validarTexto(erros, item, `${prefixo}.${k}[${j}]`);
            if (item === "") erros.push(`${prefixo}.${k}[${j}]: item vazio`);
          });
        }
      } else if (k === "posicao") {
        if (v !== "exata" && v !== "regiao") {
          erros.push(`${prefixo}.posicao: deve ser "exata" ou "regiao"`);
        }
      } else if (k !== "lat" && k !== "lon") {
        // CAMPOS_PUBLICOS and the schema must advance together. Otherwise a
        // newly allowlisted key would bypass all type and size checks here.
        erros.push(`${prefixo}.${k}: campo publico sem regra de esquema`);
      }

      // Arrays hold strings too. Checking only the top level would leave PII
      // hidden in a list unexamined.
      for (const valor of Array.isArray(v) ? v : [v]) {
        for (const { teste, motivo } of CHECAGENS_DE_VALOR) {
          if (teste(k, valor)) erros.push(`${prefixo}: ${motivo} no campo "${k}"`);
        }
      }
    }

    if (typeof r.grupo === "string" && !r.grupo) erros.push(`${prefixo}.grupo: nao pode ser vazio`);
    if (typeof r.regiao === "string" && !r.regiao) erros.push(`${prefixo}.regiao: nao pode ser vazio`);

    const temLat = Object.hasOwn(r, "lat");
    const temLon = Object.hasOwn(r, "lon");
    if (temLat !== temLon) {
      erros.push(`${prefixo}: lat e lon devem existir juntas`);
    }

    let parValido = false;
    if (temLat && temLon) {
      if (typeof r.lat !== "number" || typeof r.lon !== "number" ||
          !Number.isFinite(r.lat) || !Number.isFinite(r.lon)) {
        erros.push(`${prefixo}: lat e lon devem ser numeros finitos`);
      } else if (!dentroDaCaixaDoDF(r.lat, r.lon)) {
        erros.push(`${prefixo}: coordenada fora dos limites plausiveis do DF`);
      } else {
        parValido = true;
      }
    }
    if (r.posicao === "exata" && !parValido) {
      erros.push(`${prefixo}: posicao exata exige lat e lon validas`);
    }
  });

  return erros;
}

function executar() {
  let doc;
  try {
    doc = JSON.parse(readFileSync(PATH, "utf8"));
  } catch (e) {
    console.error("data/snapshot.json invalido ou ausente:", e.message);
    process.exitCode = 1;
    return;
  }

  const erros = validarSnapshot(doc);
  if (erros.length) {
    console.error("SNAPSHOT REPROVADO:\n- " + erros.join("\n- "));
    process.exitCode = 1;
    return;
  }
  console.log(`Snapshot aprovado: ${doc.registros.length} registro(s), nenhum dado privado detectado.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) executar();

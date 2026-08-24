/**
 * movimenta7 — traz os cadastros aprovados da planilha para o repositório.
 *
 * Fecha o passo manual: hoje o dono copia 13 campos à mão por cadastro. Aqui ele
 * marca a caixinha APROVADO na planilha e o pin aparece sozinho.
 *
 * COMO O DADO VIAJA (e por que é seguro):
 *   planilha PRIVADA (respostas + nome/WhatsApp pessoais)
 *     -> aba PUBLICAR, só as colunas públicas
 *       -> segunda planilha "movimenta7 — público", publicada na web como CSV
 *         -> este script -> moderacao/aprovados.json -> publicar_snapshot.mjs
 *
 * O isolamento em DUAS planilhas é o que importa: a tela "Publicar na web" do
 * Google tem "Documento inteiro" como padrão, e um clique errado serviria TODAS
 * as abas — inclusive nome e WhatsApp pessoais — numa URL sem login. Como as
 * colunas privadas não existem no segundo arquivo, o pior caso vira publicar o
 * que já era público.
 *
 * Rede de segurança aqui: coluna inesperada no CSV ABORTA. Se o documento errado
 * for publicado, as colunas privadas aparecem, o script para e nada é gravado.
 *
 * Uso:  PLANILHA_CSV_URL="https://docs.google.com/.../pub?output=csv" node scripts/ingerir_csv.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CAMPOS_PUBLICOS } from "./denylist.mjs";

const OUT = new URL("../moderacao/aprovados.json", import.meta.url);
const URL_CSV = process.env.PLANILHA_CSV_URL?.trim();

const fail = (msg) => { console.error("INGESTAO ABORTADA: " + msg); process.exit(1); };

/** Colunas que o CSV precisa ter, com este nome exato. */
const COLUNAS = [
  "grupo", "organizacao", "regiao", "modalidades", "dias", "horario",
  "local", "contato", "orientacao_profissional", "custo", "publico",
];
/** Colunas de controle: existem no CSV, mas não viram campo público. */
const CONTROLE = ["aprovado", "remover"];
/** Campos que chegam como lista separada por vírgula. */
const LISTAS = new Set(["modalidades", "dias", "publico"]);

/**
 * Parser CSV de verdade (RFC 4180): aspas, vírgulas e quebras de linha DENTRO de
 * um campo. Um split(",") ingênuo deixaria forjar, pelo texto de um campo, uma
 * linha inteira com APROVADO=TRUE que nunca existiu na planilha.
 */
export function parseCSV(texto) {
  const linhas = [];
  let campo = "", linha = [], aspas = false;
  const t = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } // "" = aspa literal
        else aspas = false;
      } else campo += c;
    } else if (c === '"') {
      aspas = true;
    } else if (c === ",") {
      linha.push(campo); campo = "";
    } else if (c === "\n") {
      linha.push(campo); linhas.push(linha); campo = ""; linha = [];
    } else campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/\s+/g, " ").trim();

const ehVerdadeiro = (v) => ["true", "verdadeiro", "sim", "x", "1"].includes(norm(v));

/** Converte o CSV inteiro na lista de registros aprovados. */
export function registrosAprovados(texto) {
  const linhas = parseCSV(texto);
  if (linhas.length === 0) fail("o CSV veio vazio — a planilha publicou alguma coisa?");

  const cabecalho = linhas[0].map(norm);

  // Coluna inesperada = documento errado publicado. Fail-closed, e a mensagem
  // NUNCA imprime o conteúdo da célula: o log do Actions é público.
  const esperadas = new Set([...COLUNAS, ...CONTROLE]);
  const intrusas = cabecalho.filter((c) => c && !esperadas.has(c));
  if (intrusas.length) {
    fail(`o CSV tem coluna(s) que nao deveriam existir: ${intrusas.join(", ")}.\n` +
      `  Provavel causa: a planilha foi publicada como "Documento inteiro" em vez de so a aba PUBLICAR.\n` +
      `  Va em Arquivo > Compartilhar > Publicar na web e escolha SO a aba PUBLICAR.`);
  }
  const faltando = COLUNAS.filter((c) => !cabecalho.includes(c));
  if (faltando.length) fail(`faltam colunas no CSV: ${faltando.join(", ")}`);

  const em = (linha, coluna) => (linha[cabecalho.indexOf(coluna)] ?? "").trim();

  const registros = [];
  linhas.slice(1).forEach((linha, i) => {
    if (!ehVerdadeiro(em(linha, "aprovado"))) return;   // só o que o dono marcou
    if (ehVerdadeiro(em(linha, "remover"))) return;     // pedido de remoção sai do ar

    const rec = {};
    for (const coluna of COLUNAS) {
      const valor = em(linha, coluna);
      if (!valor) continue;
      rec[coluna] = LISTAS.has(coluna)
        ? valor.split(",").map((s) => s.trim()).filter(Boolean)
        : valor;
    }
    // Redundante com publicar_snapshot.mjs de propósito: nenhum campo fora da
    // allowlist pode ser montado aqui, nem por engano de mapeamento.
    for (const k of Object.keys(rec)) {
      if (!CAMPOS_PUBLICOS.has(k)) fail(`linha ${i + 2}: campo "${k}" nao e publico`);
    }
    if (!rec.grupo) { console.warn(`AVISO: linha ${i + 2} aprovada sem nome de grupo — ignorada`); return; }
    if (!rec.regiao) { console.warn(`AVISO: linha ${i + 2} ("${rec.grupo}") sem regiao — ignorada`); return; }
    registros.push(rec);
  });
  return registros;
}

// ---------- execução ----------

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!URL_CSV) {
    // Ainda não configurado: não é erro, é o estado de hoje. Dito alto no log
    // para não virar silêncio confortável.
    console.log(
      "PLANILHA_CSV_URL nao esta definida — nada a ingerir.\n" +
      "  Para ligar: GitHub > Settings > Secrets and variables > Actions > Variables\n" +
      "  > New repository variable, nome PLANILHA_CSV_URL, valor = a URL do CSV publicado.\n" +
      "  Passo a passo em portugues: moderacao/COMO_LIGAR_A_PLANILHA.md",
    );
    process.exit(0);
  }

  const resp = await fetch(URL_CSV, { redirect: "follow" });
  if (!resp.ok) fail(`a planilha respondeu ${resp.status}. A URL ainda esta publicada na web?`);
  const texto = await resp.text();
  if (texto.trimStart().startsWith("<")) {
    fail("a URL devolveu uma pagina HTML, nao um CSV — confira se termina com output=csv");
  }

  const registros = registrosAprovados(texto);
  writeFileSync(OUT, JSON.stringify(registros, null, 2) + "\n", { encoding: "utf-8" });
  console.log(`moderacao/aprovados.json atualizado: ${registros.length} cadastro(s) aprovado(s).`);
}

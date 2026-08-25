/**
 * movimenta7 — traz os cadastros da planilha para o site, SEM fila de aprovação.
 *
 * Desde ADR-0006 (25/08/2026) o dono não aprova cadastro a cadastro: quem
 * preenche o formulário entra no mapa na próxima rodada do CI (~10 min). O que
 * sobrou de controle é o contrário disto — a coluna `remover`, que tira do ar.
 *
 * COMO O DADO VIAJA:
 *   formulário -> planilha de respostas
 *     -> aba PUBLICAR, só as colunas públicas
 *       -> publicada na web como CSV
 *         -> este script -> moderacao/aprovados.json -> publicar_snapshot.mjs
 *
 * O formulário deixou de coletar dado pessoal (nem nome, nem telefone), então
 * não existe mais coluna privada para vazar. Sobrou o risco de publicar a ABA
 * errada — a de respostas cruas, com carimbo de data/hora — e é isso que a
 * trava de coluna inesperada pega: ela ABORTA e nada é gravado.
 *
 * DUAS CLASSES DE ERRO, de propósito:
 *   - estrutural (CSV vazio, coluna inesperada, coluna faltando) -> ABORTA tudo.
 *     São sinais de que a planilha errada foi publicada.
 *   - de UM cadastro (dado pessoal digitado num campo, sem região, link fora da
 *     lista) -> pula SÓ aquele cadastro e segue. Sem revisão humana, abortar o
 *     build por causa de uma linha ruim entregaria a qualquer pessoa o poder de
 *     congelar o site inteiro preenchendo o formulário com lixo.
 *
 * Uso:  PLANILHA_CSV_URL="https://docs.google.com/.../pub?output=csv" node scripts/ingerir_csv.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CAMPOS_PUBLICOS, CHECAGENS_DE_VALOR, isPrivateKey } from "./denylist.mjs";
import { linkMapa, linkRedeSocial, MAX_RECORDS } from "../js/util.js";

const OUT = new URL("../moderacao/aprovados.json", import.meta.url);
const URL_CSV = process.env.PLANILHA_CSV_URL?.trim();

const fail = (msg) => { console.error("INGESTAO ABORTADA: " + msg); process.exit(1); };

/** Colunas que o CSV precisa ter, com este nome exato. */
const COLUNAS = [
  "grupo", "organizacao", "regiao", "modalidades", "dias", "horario",
  "local", "rede_social", "mapa", "orientacao_profissional", "custo", "publico",
];
/**
 * Colunas de controle: existem no CSV, mas não viram campo público.
 * `aprovado` continua ACEITA e é ignorada — quem já montou a aba PUBLICAR no
 * desenho antigo não precisa refazê-la para o site voltar a atualizar.
 */
const CONTROLE = ["remover", "aprovado"];
/** Campos que chegam como lista separada por vírgula. */
const LISTAS = new Set(["modalidades", "dias", "publico"]);
/** Campos de link: normalizados contra a allowlist de destinos (js/util.js). */
const NORMALIZADORES = {
  rede_social: (v) => linkRedeSocial(v).url,
  mapa: (v) => linkMapa(v),
};

/**
 * Parser CSV de verdade (RFC 4180): aspas, vírgulas e quebras de linha DENTRO de
 * um campo. Um split(",") ingênuo deixaria forjar, pelo texto de um campo, uma
 * linha inteira que nunca existiu na planilha — hoje isso significaria inventar
 * cadastros a partir do nome de um grupo.
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

/**
 * As 36 regiões que data/regioes.json sabe transformar em pin.
 *
 * A checagem mora AQUI, e não em publicar_snapshot.mjs, porque aqui é a
 * fronteira com o público: uma região desconhecida vira um cadastro pulado com
 * aviso, em vez de um build vermelho que tira o site inteiro do ar. Lá adiante
 * o mesmo erro continua abortando — se chegar até lá, o bug é nosso.
 */
const REGIOES = new Set(
  (JSON.parse(readFileSync(new URL("../data/regioes.json", import.meta.url), "utf8")).regioes || [])
    .map((r) => norm(r.rotulo)),
);

/**
 * Converte o CSV inteiro na lista de registros que vão para o site.
 *
 * Devolve também o que ficou de fora, para o log: sem revisão humana, um
 * cadastro descartado em silêncio é um cadastro que ninguém nunca conserta.
 */
export function registrosPublicaveis(texto) {
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
  const descartes = [];
  const vistos = new Set();

  linhas.slice(1).forEach((linha, i) => {
    const nLinha = i + 2; // 1 = cabeçalho, e o Sheets conta a partir de 1
    if (ehVerdadeiro(em(linha, "remover"))) return; // saída pedida: não é descarte

    const rec = {};
    for (const coluna of COLUNAS) {
      const valor = em(linha, coluna);
      if (!valor) continue;
      // Link normalizado ANTES de ser gravado: o que sobra em rede_social/mapa
      // é sempre uma URL de destino permitido, nunca o texto cru que a pessoa
      // digitou. É isso que impede um telefone escrito no campo do Instagram de
      // ficar guardado em moderacao/aprovados.json, que é público.
      if (NORMALIZADORES[coluna]) {
        const url = NORMALIZADORES[coluna](valor);
        if (!url) {
          descartes.push(`linha ${nLinha}: "${coluna}" nao e um endereco aceito — ` +
            `o grupo entra no mapa, so que sem esse link`);
          continue;
        }
        rec[coluna] = url;
        continue;
      }
      rec[coluna] = LISTAS.has(coluna)
        ? valor.split(",").map((s) => s.trim()).filter(Boolean)
        : valor;
    }
    // Redundante com publicar_snapshot.mjs de propósito: nenhum campo fora da
    // allowlist pode ser montado aqui, nem por engano de mapeamento. Continua
    // ABORTANDO porque só um erro em COLUNAS chega aqui — é bug nosso.
    for (const k of Object.keys(rec)) {
      if (!CAMPOS_PUBLICOS.has(k)) fail(`linha ${nLinha}: campo "${k}" nao e publico`);
    }

    if (!rec.grupo) { descartes.push(`linha ${nLinha}: sem nome de grupo`); return; }
    if (!rec.regiao) { descartes.push(`linha ${nLinha}: sem regiao administrativa`); return; }
    if (!REGIOES.has(norm(rec.regiao))) {
      descartes.push(`linha ${nLinha}: regiao "${rec.regiao}" nao existe em data/regioes.json — ` +
        `corrija na planilha ou acrescente a regiao la`);
      return;
    }

    // Quarentena de privacidade, cadastro a cadastro. A mensagem diz a LINHA e o
    // CAMPO e nunca o conteúdo: o log do Actions é público, e imprimir o valor
    // reprovado publicaria justamente o dado que acabamos de barrar.
    const motivos = [];
    for (const [k, v] of Object.entries(rec)) {
      if (isPrivateKey(k)) motivos.push(`o campo "${k}" tem nome de dado privado`);
      for (const valor of Array.isArray(v) ? v : [v]) {
        for (const { teste, motivo } of CHECAGENS_DE_VALOR) {
          if (teste(k, valor)) motivos.push(`${motivo} no campo "${k}"`);
        }
      }
    }
    if (motivos.length) {
      descartes.push(`linha ${nLinha}: NAO publicada — ${[...new Set(motivos)].join("; ")}`);
      return;
    }

    // Formulário aberto: gente clica em "enviar" duas vezes. Mesmo grupo, mesma
    // região e mesmo local entram uma vez só.
    const chave = [norm(rec.grupo), norm(rec.regiao), norm(rec.local || "")].join("|");
    if (vistos.has(chave)) {
      descartes.push(`linha ${nLinha}: repetida (mesmo grupo, regiao e local) — publicada uma vez so`);
      return;
    }
    vistos.add(chave);

    registros.push(rec);
  });

  descartes.forEach((d) => console.warn("AVISO: " + d));

  // Teto anti-enxurrada. Cortar aqui, com aviso, em vez de deixar o gate
  // reprovar lá na frente: passar de MAX_RECORDS reprovaria o build e
  // congelaria o site inteiro — que é exatamente o que um enxurrada quer.
  if (registros.length > MAX_RECORDS) {
    console.warn(`AVISO: chegaram ${registros.length} cadastros e o site desenha ${MAX_RECORDS}. ` +
      `Os ${registros.length - MAX_RECORDS} ultimos ficaram de fora — olhe a planilha.`);
    return registros.slice(0, MAX_RECORDS);
  }
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

  // Aconteceu de verdade em 25/08: o valor colado na variável foi o texto do
  // guia ("Value = o endereço"), não a URL. Sem esta checagem, o new URL() logo
  // abaixo estoura um TypeError cru — um build vermelho a cada 10 minutos cuja
  // mensagem não diz a ninguém o que fazer. O erro é do dono, mas a mensagem
  // ilegível era nossa.
  if (!/^https?:\/\//i.test(URL_CSV)) {
    fail("PLANILHA_CSV_URL nao e um endereco de internet.\n" +
      "  Parece que foi colado o texto do passo a passo em vez da URL.\n" +
      "  O valor certo comeca com https://docs.google.com/ e sai de:\n" +
      "  planilha > Arquivo > Compartilhar > Publicar na web > aba PUBLICAR > .csv > Publicar.\n" +
      "  Troque em: Settings > Secrets and variables > Actions > Variables.");
  }

  // A URL publicada do Google é servida de um cache de ~5 minutos. Sem furar
  // esse cache, um pedido de REMOÇÃO pode falhar em silêncio: a rodada leria a
  // versão velha da planilha, republicaria o grupo que acabou de sair e o CI
  // ficaria verde. Um parâmetro que muda a cada rodada torna cada pedido único.
  const alvo = new URL(URL_CSV);
  alvo.searchParams.set("_", String(Date.now()));

  const resp = await fetch(alvo, {
    redirect: "follow",
    headers: { "cache-control": "no-cache", pragma: "no-cache" },
  });
  if (!resp.ok) fail(`a planilha respondeu ${resp.status}. A URL ainda esta publicada na web?`);
  const texto = await resp.text();
  if (texto.trimStart().startsWith("<")) {
    fail("a URL devolveu uma pagina HTML, nao um CSV — confira se termina com output=csv");
  }

  const registros = registrosPublicaveis(texto);
  writeFileSync(OUT, JSON.stringify(registros, null, 2) + "\n", { encoding: "utf-8" });
  console.log(`moderacao/aprovados.json atualizado: ${registros.length} cadastro(s).`);
}

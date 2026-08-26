/**
 * movimenta7 — traz os cadastros da planilha para o site, SEM fila de aprovação.
 *
 * Desde ADR-0006 (25/08/2026) o dono não aprova cadastro a cadastro: quem
 * preenche o formulário dispara o CI imediatamente (normalmente 1–2 min até a
 * página perceber). O cron é só o fallback; `remover` tira a linha do ar.
 *
 * COMO O DADO VIAJA:
 *   formulário -> planilha PRIVADA de respostas
 *     -> Apps Script projeta somente as colunas de cadastro num feed autenticado
 *       -> este script -> moderacao/aprovados.json -> publicar_snapshot.mjs
 *
 * O formulário não pede dado pessoal, mas campo livre continua hostil. Por isso
 * a planilha fica privada: o Apps Script projeta uma allowlist antes de o CI
 * receber qualquer célula. A trava de schema confere essa projeção de novo.
 *
 * DUAS CLASSES DE ERRO, de propósito:
 *   - estrutural (feed vazio, coluna inesperada, coluna faltando) -> ABORTA tudo.
 *     São sinais de endpoint errado, contrato antigo ou configuração quebrada.
 *   - de UM cadastro (dado pessoal digitado num campo, sem região, link fora da
 *     lista) -> pula SÓ aquele cadastro e segue. Sem revisão humana, abortar o
 *     build por causa de uma linha ruim entregaria a qualquer pessoa o poder de
 *     congelar o site inteiro preenchendo o formulário com lixo.
 *
 * Uso: PLANILHA_FEED_URL="https://script.google.com/macros/s/.../exec"
 *      PLANILHA_FEED_TOKEN="segredo" node scripts/ingerir_csv.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CAMPOS_PUBLICOS, CHECAGENS_DE_VALOR, isPrivateKey } from "./denylist.mjs";
import { cleanField, linkMapa, linkRedeSocial, MAX_RECORDS, MAX_URL } from "../js/util.js";
import {
  coordenadaDeUrl, geocodificarLocalPublico, resolverCoordenada,
  resolverCompartilhamentoGoogle,
} from "./coordenadas.mjs";

const OUT = new URL("../moderacao/aprovados.json", import.meta.url);
const URL_FEED = process.env.PLANILHA_FEED_URL?.trim();
const TOKEN_FEED = process.env.PLANILHA_FEED_TOKEN?.trim();
const CACHE_PATH = process.env.MOV7_GEOCACHE_PATH?.trim() ||
  fileURLToPath(new URL("../.cache/geocache.json", import.meta.url));

const fail = (msg) => { console.error("INGESTAO ABORTADA: " + msg); process.exit(1); };

/** Colunas que o envelope privado precisa ter, com este nome exato. */
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

/** Converte o envelope privado do Apps Script no mesmo CSV RFC-4180 do parser. */
export function feedParaCSV(doc) {
  if (!doc || doc.ok !== true || doc.schema_version !== 1) {
    throw new Error("o feed privado nao confirmou o contrato schema_version=1");
  }
  if (!Array.isArray(doc.colunas) || !Array.isArray(doc.linhas)) {
    throw new Error("o feed privado nao trouxe colunas e linhas");
  }
  if (doc.colunas.length > 32 || doc.linhas.length > 5000) {
    throw new Error("o feed privado excedeu o limite estrutural");
  }
  const largura = doc.colunas.length;
  if (!doc.linhas.every((l) => Array.isArray(l) && l.length === largura)) {
    throw new Error("uma linha do feed privado tem largura diferente do cabecalho");
  }
  const celula = (v) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [doc.colunas, ...doc.linhas]
    .map((linha) => linha.map(celula).join(","))
    .join("\n") + "\n";
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
  if (linhas.length === 0) fail("o feed veio vazio ou ilegivel");

  const cabecalho = linhas[0].map(norm);

  // Coluna inesperada = documento errado publicado. Fail-closed, e a mensagem
  // NUNCA imprime o conteúdo da célula: o log do Actions é público.
  const esperadas = new Set([...COLUNAS, ...CONTROLE]);
  const intrusas = cabecalho.filter((c) => c && !esperadas.has(c));
  if (intrusas.length) {
    fail(`o feed tem ${intrusas.length} coluna(s) que nao deveriam existir.\n` +
      `  Atualize e reimplante scripts/criar_form.gs. Nunca publique a planilha na web.`);
  }
  const faltando = COLUNAS.filter((c) => !cabecalho.includes(c));
  if (faltando.length) fail(`faltam colunas no feed: ${faltando.join(", ")}`);

  const em = (linha, coluna) => (linha[cabecalho.indexOf(coluna)] ?? "").trim();

  const registros = [];
  const descartes = [];
  const vistos = new Set();

  linhas.slice(1).forEach((linha, i) => {
    const nLinha = i + 2; // 1 = cabeçalho, e o Sheets conta a partir de 1
    if (ehVerdadeiro(em(linha, "remover"))) return; // saída pedida: não é descarte

    const rec = {};
    const linksInvalidos = [];
    for (const coluna of COLUNAS) {
      const valor = em(linha, coluna);
      if (!valor) continue;
      // Link normalizado ANTES de ser gravado: o que sobra em rede_social/mapa
      // é sempre uma URL de destino permitido, nunca o texto cru que a pessoa
      // digitou. É isso que impede um telefone escrito no campo do Instagram de
      // ficar guardado em moderacao/aprovados.json, que é público.
      if (NORMALIZADORES[coluna]) {
        const url = NORMALIZADORES[coluna](valor.slice(0, MAX_URL + 1));
        if (!url) {
          linksInvalidos.push(coluna);
          continue;
        }
        rec[coluna] = url;
        continue;
      }
      rec[coluna] = LISTAS.has(coluna)
        ? valor.split(",").map(cleanField).filter(Boolean)
        : cleanField(valor);
    }
    // Redundante com publicar_snapshot.mjs de propósito: nenhum campo fora da
    // allowlist pode ser montado aqui, nem por engano de mapeamento. Continua
    // ABORTANDO porque só um erro em COLUNAS chega aqui — é bug nosso.
    for (const k of Object.keys(rec)) {
      if (!CAMPOS_PUBLICOS.has(k)) fail(`linha ${nLinha}: campo "${k}" nao e publico`);
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

    // Rede social e rota são o produto: sem uma delas o visitante não consegue
    // conhecer o grupo ou chegar ao encontro. O Form exige ambas, e esta segunda
    // barreira cobre respostas antigas, importações manuais e links adulterados.
    for (const obrigatorio of ["rede_social", "mapa"]) {
      if (!rec[obrigatorio] && !linksInvalidos.includes(obrigatorio)) linksInvalidos.push(obrigatorio);
    }
    if (linksInvalidos.length) {
      descartes.push(`linha ${nLinha}: NAO publicada — link obrigatorio ausente ou invalido em ` +
        [...new Set(linksInvalidos)].map((k) => `"${k}"`).join(" e "));
      return;
    }

    if (!rec.grupo) { descartes.push(`linha ${nLinha}: sem nome de grupo`); return; }
    if (!rec.regiao) { descartes.push(`linha ${nLinha}: sem regiao administrativa`); return; }
    if (!REGIOES.has(norm(rec.regiao))) {
      // Never echo the value: the rejected cell may itself be the sensitive
      // text the pipeline is quarantining, while Actions logs are public.
      descartes.push(`linha ${nLinha}: regiao administrativa desconhecida — corrija na planilha`);
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

    /**
     * The pin's real position, when the pasted link already carries one.
     *
     * Reading it here rather than at publication time is deliberate: this is the
     * only step that ever sees what the person actually typed. Nothing is
     * fetched — a full google.com/maps/place/... URL names its coordinate in the
     * URL itself, so this costs one regular expression and no network at all.
     *
     * A short maps.app.goo.gl link — what Compartilhar normally produces — has
     * no coordinate here. `completarCoordenadas` follows it after every row has
     * passed the privacy gates, with timeout, per-run ceiling and private cache.
     *
     * Whatever comes out is still checked at publication: outside the DF is
     * refused, and a region that disagrees with the coordinate is corrected to
     * match it.
     */
    if (rec.mapa) {
      const pos = coordenadaDeUrl(rec.mapa);
      if (pos) { rec.lat = pos.lat; rec.lon = pos.lon; }
    }

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

// ---------- short Google Maps links ----------

const CACHE_VERSION = 3;
const MAX_RESOLUCOES_POR_RODADA = 25;
const CACHE_NEGATIVO_MS = 6 * 60 * 60 * 1000;

function chaveDoLink(url) {
  return createHash("sha256").update(String(url || "")).digest("hex");
}

function linkCurtoDoMapa(url) {
  try {
    const p = new URL(String(url || ""));
    return p.hostname === "share.google" || p.hostname === "maps.app.goo.gl" ||
      (p.hostname === "goo.gl" && p.pathname.startsWith("/maps/"));
  } catch (e) { return false; }
}

function ehShareGoogle(url) {
  try { return new URL(String(url || "")).hostname === "share.google"; }
  catch (e) { return false; }
}

function cacheVazio() {
  return { versao: CACHE_VERSION, itens: {} };
}

export function lerCacheCoordenadas(path = CACHE_PATH) {
  try {
    const doc = JSON.parse(readFileSync(path, "utf8"));
    if (doc?.versao === CACHE_VERSION && doc.itens && typeof doc.itens === "object") return doc;
  } catch (e) { /* cache ausente/corrompido: a origem continua sendo o link */ }
  return cacheVazio();
}

/**
 * Resolves each opaque Maps share link at most once.
 *
 * The cache deliberately stores only a SHA-256 of the link plus its public
 * coordinate and, for share.google, the canonical Maps destination proved by
 * the redirect chain. It lives in the private Actions cache, never in Git
 * history and never in the Pages artifact. A negative result cools down for six
 * hours, then is retried. The per-run cap prevents form spam from causing
 * hundreds of requests.
 */
export async function completarCoordenadas(registros, {
  cache = cacheVazio(), buscar = fetch, limite = MAX_RESOLUCOES_POR_RODADA,
  agora = () => new Date().toISOString(),
  relogio = () => Date.now(),
  pausar = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  if (!cache.itens || typeof cache.itens !== "object") cache = cacheVazio();
  let consultas = 0;
  let alterado = false;
  let pendentes = 0;
  const recusadosShare = new Set();
  let ultimaConsultaNominatim = -Infinity;

  const geocodificarComLimite = async (consulta, regiao) => {
    const decorrido = relogio() - ultimaConsultaNominatim;
    if (Number.isFinite(decorrido) && decorrido < 1000) await pausar(1000 - decorrido);
    ultimaConsultaNominatim = relogio();
    return geocodificarLocalPublico(consulta, regiao, { buscar });
  };

  for (const rec of registros) {
    if (Number.isFinite(rec?.lat) && Number.isFinite(rec?.lon)) continue;
    if (!linkCurtoDoMapa(rec?.mapa)) continue;

    const chave = chaveDoLink(rec.mapa);
    const shareGoogle = ehShareGoogle(rec.mapa);
    const salvo = cache.itens[chave];
    if (salvo) {
      if (shareGoogle && typeof salvo.mapa === "string" && salvo.mapa) {
        rec.mapa = salvo.mapa;
        if (Number.isFinite(salvo.lat) && Number.isFinite(salvo.lon)) {
          rec.lat = salvo.lat;
          rec.lon = salvo.lon;
          continue;
        }
        const idade = Date.parse(agora()) - Date.parse(salvo.verificado_em);
        if (Number.isFinite(idade) && idade >= 0 && idade < CACHE_NEGATIVO_MS) continue;
        if (salvo.consulta && consultas < limite) {
          consultas++;
          const pos = await geocodificarComLimite(salvo.consulta, rec.regiao);
          salvo.lat = pos?.lat ?? null;
          salvo.lon = pos?.lon ?? null;
          salvo.verificado_em = agora();
          alterado = true;
          if (pos) { rec.lat = pos.lat; rec.lon = pos.lon; }
        }
        continue;
      }
      if (Number.isFinite(salvo.lat) && Number.isFinite(salvo.lon)) {
        rec.lat = salvo.lat;
        rec.lon = salvo.lon;
        continue;
      }
      const idade = Date.parse(agora()) - Date.parse(salvo.verificado_em);
      if (Number.isFinite(idade) && idade >= 0 && idade < CACHE_NEGATIVO_MS) {
        if (shareGoogle) recusadosShare.add(rec);
        continue;
      }
    }

    if (consultas >= limite) {
      pendentes++;
      // share.google is a general shortener. Until its destination is proven to
      // be a place, fail closed instead of publishing a possible arbitrary URL.
      if (shareGoogle) recusadosShare.add(rec);
      continue;
    }
    consultas++;
    const resolvido = shareGoogle
      ? await resolverCompartilhamentoGoogle(rec.mapa, { buscar })
      : await resolverCoordenada(rec.mapa, { buscar });
    if (shareGoogle) {
      if (resolvido?.consulta &&
          (!Number.isFinite(resolvido.lat) || !Number.isFinite(resolvido.lon))) {
        const pos = await geocodificarComLimite(resolvido.consulta, rec.regiao);
        if (pos) { resolvido.lat = pos.lat; resolvido.lon = pos.lon; }
      }
      cache.itens[chave] = resolvido
        ? {
            mapa: resolvido.mapa,
            consulta: resolvido.consulta || null,
            lat: Number.isFinite(resolvido.lat) ? resolvido.lat : null,
            lon: Number.isFinite(resolvido.lon) ? resolvido.lon : null,
            verificado_em: agora(),
          }
        : { mapa: null, lat: null, lon: null, verificado_em: agora() };
      if (resolvido) {
        rec.mapa = resolvido.mapa;
        if (Number.isFinite(resolvido.lat) && Number.isFinite(resolvido.lon)) {
          rec.lat = resolvido.lat;
          rec.lon = resolvido.lon;
        }
      } else recusadosShare.add(rec);
    } else {
      cache.itens[chave] = resolvido
        ? { lat: resolvido.lat, lon: resolvido.lon, verificado_em: agora() }
        : { lat: null, lon: null, verificado_em: agora() };
      if (resolvido) { rec.lat = resolvido.lat; rec.lon = resolvido.lon; }
    }
    alterado = true;
  }

  if (recusadosShare.size) {
    for (let i = registros.length - 1; i >= 0; i--) {
      if (recusadosShare.has(registros[i])) registros.splice(i, 1);
    }
    console.warn(`AVISO: ${recusadosShare.size} cadastro(s) com share.google ficaram de fora ` +
      `porque o destino nao comprovou ser um local do Google.`);
  }

  if (pendentes) {
    console.warn(`AVISO: ${pendentes} link(s) curto(s) aguardam a proxima rodada; ` +
      `o limite seguro e ${limite} resolucoes novas por execucao.`);
  }
  return { registros, cache, alterado, consultas, pendentes };
}

function gravarCacheCoordenadas(cache, path = CACHE_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cache, null, 2) + "\n", { encoding: "utf-8" });
  writeFileSync(path + ".changed", "changed\n", { encoding: "utf-8" });
}

/**
 * Reads a fetch response with a real UTF-8 byte ceiling.
 *
 * `texto.length` counts UTF-16 code units, not network bytes, and checking it
 * after `response.text()` has already allowed an unbounded response into RAM.
 * The feed is tiny; two megabytes is a structural alarm, so stop the stream as
 * soon as the ceiling is crossed and never include its contents in the error.
 */
export async function lerTextoLimitado(resp, limiteBytes = 2_000_000) {
  if (!Number.isSafeInteger(limiteBytes) || limiteBytes < 1) {
    throw new TypeError("limite de bytes invalido");
  }

  const declarado = Number(resp?.headers?.get?.("content-length"));
  if (Number.isFinite(declarado) && declarado > limiteBytes) {
    throw new Error("o feed privado passou do limite de bytes");
  }

  const reader = resp?.body?.getReader?.();
  if (!reader) {
    const bytes = new Uint8Array(await resp.arrayBuffer());
    if (bytes.byteLength > limiteBytes) throw new Error("o feed privado passou do limite de bytes");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  const partes = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const parte = value instanceof Uint8Array ? value : new Uint8Array(value);
    total += parte.byteLength;
    if (total > limiteBytes) {
      try { await reader.cancel(); } catch (e) { /* best effort */ }
      throw new Error("o feed privado passou do limite de bytes");
    }
    partes.push(parte);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const parte of partes) { bytes.set(parte, offset); offset += parte.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

// ---------- execução ----------

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!URL_FEED || !TOKEN_FEED) fail(
    "faltam PLANILHA_FEED_URL e/ou PLANILHA_FEED_TOKEN.\n" +
    "  A origem e obrigatoria: seguir com o arquivo versionado poderia publicar um mapa vazio.\n" +
    "  Configure os dois como Environment secrets em GitHub > Settings > Environments > " +
    "github-pages. Nao use Repository secrets nem Variables."
  );

  let alvo;
  try { alvo = new URL(URL_FEED); } catch (e) {
    fail("PLANILHA_FEED_URL nao e um endereco de internet valido.");
  }
  if (alvo.protocol !== "https:" || alvo.hostname !== "script.google.com" ||
      !/^\/macros\/s\/[^/]+\/exec$/.test(alvo.pathname)) {
    fail("PLANILHA_FEED_URL precisa ser a URL /exec do Web App em script.google.com.");
  }
  alvo.searchParams.set("_", String(Date.now()));

  const resp = await fetch(alvo, {
    method: "POST",
    redirect: "follow",
    headers: {
      "cache-control": "no-cache",
      pragma: "no-cache",
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams({ acao: "feed", token: TOKEN_FEED }),
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) fail(`o feed privado respondeu ${resp.status}`);
  let texto;
  try { texto = await lerTextoLimitado(resp); }
  catch (e) { fail("o feed privado passou de 2 MB ou nao era UTF-8 valido — origem recusada"); }
  let envelope;
  try { envelope = JSON.parse(texto); } catch (e) {
    fail("o Web App nao devolveu JSON — confira a implantacao /exec e o acesso");
  }
  let csv;
  try { csv = feedParaCSV(envelope); } catch (e) { fail(e.message); }

  const registros = registrosPublicaveis(csv);
  const resolucao = await completarCoordenadas(registros, {
    cache: lerCacheCoordenadas(CACHE_PATH),
  });
  if (resolucao.alterado) gravarCacheCoordenadas(resolucao.cache, CACHE_PATH);
  writeFileSync(OUT, JSON.stringify(registros, null, 2) + "\n", { encoding: "utf-8" });
  console.log(`moderacao/aprovados.json atualizado: ${registros.length} cadastro(s); ` +
    `${resolucao.consultas} link(s) curto(s) consultado(s) nesta rodada.`);
}

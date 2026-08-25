/**
 * Runs scripts/criar_form.gs against a stub of the Google Apps Script API and
 * checks the spreadsheet it builds.
 *
 * Why this exists: that file runs once, inside the owner's Google account, on
 * launch day, and nobody here can debug it while it runs. Its whole job is to
 * produce a PUBLICAR tab whose header row ingerir_csv.mjs accepts and whose
 * MATCH() strings hit real columns — and both contracts are strings compared
 * across two files that no compiler ever reads together. A drift of one
 * character shows up as #REF! in a tab nobody opens, or as an aborted
 * ingestion, hours later, in a public log.
 *
 * So the last stage is checked for real: the header row this produces is turned
 * into a CSV and fed to the actual ingestion.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { registrosPublicaveis } from "../scripts/ingerir_csv.mjs";

const FONTE = readFileSync(new URL("../scripts/criar_form.gs", import.meta.url), "utf8");

/** Name Google gives the response tab in a pt-BR account — spaces included. */
const ABA_RESPOSTAS = "Respostas ao formulário 1";

/**
 * Names of the Script Properties the owner creates by hand, spelled out here
 * instead of read from the source: these three strings are a contract between a
 * file in this repository and three boxes typed into a Google account, and
 * renaming one in the code would otherwise leave the owner's working setup
 * pointing at a property nobody reads any more.
 */
const PROP = { token: "GITHUB_TOKEN", csv: "PLANILHA_CSV_URL", repo: "GITHUB_REPO" };

/** The group whose registration the instant-publication tests simulate. */
const GRUPO_NOVO = "Vôlei da IASD Taguatinga";

/**
 * Minimal fake of the two Apps Script services the file touches. It models the
 * one behaviour that matters and is easy to get wrong: the response sheet does
 * not exist until setDestination() is called, and it arrives with a timestamp
 * column followed by every question title, in creation order.
 */
function ambienteFalso() {
  const titulos = [];
  const registro = { formula: null, notas: [], validacoes: [], paginas: [], formsCriados: 0 };

  const item = () => {
    const self = {
      setTitle: (t) => { titulos.push(t); return self; },
      setRequired: () => self,
      setChoiceValues: () => self,
      setHelpText: () => self,
      setChoices: () => self,
      setGoToPage: () => self,
      createChoice: () => ({}),
    };
    return self;
  };
  // A page break is not a question, so it never becomes a column. It DOES need
  // an identity, though: the old stub threw both the title and the navigation
  // away, so the form could send every new registrant to the removal page and
  // the suite stayed green. It did exactly that, in production, on 25/08.
  const quebraDePagina = () => {
    const pagina = { titulo: null };
    registro.paginas.push(pagina);
    const self = {
      setTitle: (t) => { pagina.titulo = t; return self; },
      setGoToPage: (destino) => { pagina.destino = destino; return self; },
    };
    return self;
  };

  function planilhaFalsa(nome) {
    const abas = [folha("Página1", [])];
    const ss = {
      getId: () => "ID_FALSO",
      getUrl: () => "https://docs.google.com/spreadsheets/d/ID_FALSO/edit",
      getName: () => nome,
      getSheets: () => abas.slice(),
      getSheetByName: (n) => abas.find((a) => a.getSheetName() === n) || null,
      insertSheet: (n) => { const a = folha(n, []); abas.push(a); return a; },
      _receberRespostas: () => abas.push(folha(ABA_RESPOSTAS, ["Carimbo de data/hora", ...titulos])),
    };
    return ss;
  }

  function folha(nome, cabecalho) {
    const celulas = [cabecalho.slice()]; // celulas[0] = linha 1
    const escrever = (linha, coluna, valor) => {
      while (celulas.length < linha) celulas.push([]);
      celulas[linha - 1][coluna - 1] = valor;
    };
    const self = {
      getSheetName: () => nome,
      getMaxRows: () => 1000,
      getLastColumn: () => Math.max(...celulas.map((l) => l.length), 0),
      setFrozenRows: () => self,
      _linha: (n) => (celulas[n - 1] || []).slice(),
      getRange: (a, b, _c, _d) => {
        // A1 notation ("A2") or (row, column, [rows], [cols]).
        const linha = typeof a === "string" ? Number(a.slice(1)) : a;
        const coluna = typeof a === "string" ? a.charCodeAt(0) - 64 : b;
        return {
          // Returns a rows x cols block, like the real getValues(). The first
          // version of this stub ignored the width and handed back a single
          // cell, so acharAbaDeRespostas() never matched a header and reached
          // the response tab only through its own fallback — the header-matching
          // path this file is supposed to be covering was never once executed.
          getValues: () => {
            const nLinhas = _c ?? 1, nColunas = _d ?? 1;
            const bloco = [];
            for (let r = 0; r < nLinhas; r++) {
              const l = celulas[linha - 1 + r] || [];
              bloco.push(l.slice(coluna - 1, coluna - 1 + nColunas));
            }
            return bloco;
          },
          setValue: (v) => escrever(linha, coluna, v),
          setValues: (m) => m[0].forEach((v, i) => escrever(linha, coluna + i, v)),
          setFormula: (f) => { registro.formula = f; },
          setNote: (n) => registro.notas.push(n),
          setDataValidation: (v) => registro.validacoes.push({ coluna, regra: v }),
        };
      },
    };
    return self;
  }

  let planilha = null;
  const FormApp = {
    DestinationType: { SPREADSHEET: "SPREADSHEET" },
    PageNavigationType: { SUBMIT: "SUBMIT" },
    create: () => {
      registro.formsCriados++;
      const form = {
        setDescription: () => form,
        setCollectEmail: () => form,
        setLimitOneResponsePerUser: () => form,
        addMultipleChoiceItem: item,
        addTextItem: item,
        addListItem: item,
        addCheckboxItem: item,
        addParagraphTextItem: item,
        addPageBreakItem: quebraDePagina,
        setDestination: () => planilha._receberRespostas(),
        getEditUrl: () => "https://forms/edit",
        getPublishedUrl: () => "https://forms/viewform",
      };
      return form;
    },
  };
  const SpreadsheetApp = {
    create: (nome) => { planilha = planilhaFalsa(nome); return planilha; },
    openById: () => planilha,
    getActive: () => planilha, // o que consertarAbaPublicar usa: a planilha aberta
    flush: () => {},
    newDataValidation: () => ({ requireCheckbox: () => ({ build: () => "CHECKBOX" }) }),
  };

  /* ---------- stubs for the instant-publication path (25/08/2026) ----------
     Only what the code can actually get wrong is modelled: the status GitHub
     answers with, the fact that Script Properties hand back exactly what was
     pasted into the box, and that a trigger already installed must not be
     installed a second time. */

  const propriedades = new Map([
    // The surrounding whitespace is deliberate. Pasting a token into that box
    // brings a trailing newline often enough to be a scar in this owner's
    // notes, and "Bearer tok\n" is a 401 whose message mentions no such thing.
    [PROP.token, " tok_de_teste\n"],
    [PROP.csv, "https://docs.google.com/spreadsheets/d/e/XYZ/pub?output=csv"],
  ]);
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (k) => (propriedades.has(k) ? propriedades.get(k) : null),
    }),
  };

  const rede = {
    chamadas: [],
    esperas: [],
    /** Default: GitHub accepts, and the published CSV already shows the group. */
    responder: (url) => (url.includes("api.github.com")
      ? { codigo: 204, texto: "" }
      : { codigo: 200, texto: `grupo\n${GRUPO_NOVO}\n` }),
  };
  const UrlFetchApp = {
    fetch: (url, opcoes) => {
      rede.chamadas.push({ url, opcoes: opcoes || {} });
      const r = rede.responder(url, opcoes || {});
      return { getResponseCode: () => r.codigo, getContentText: () => r.texto };
    },
  };
  // Recorded, never actually slept: the waiting logic is worth testing, the
  // two minutes it can spend are not worth adding to every CI run.
  const Utilities = { sleep: (ms) => rede.esperas.push(ms) };

  const gatilhos = [];
  const ScriptApp = {
    newTrigger: (funcao) => {
      const t = { funcao, tipo: null, planilha: null };
      const construtor = {
        forSpreadsheet: (ss) => { t.planilha = ss.getName(); return construtor; },
        onFormSubmit: () => { t.tipo = "onFormSubmit"; return construtor; },
        create: () => { gatilhos.push(t); return t; },
      };
      return construtor;
    },
    getProjectTriggers: () => gatilhos.map((t) => ({ getHandlerFunction: () => t.funcao })),
  };

  const contexto = vm.createContext({
    FormApp, SpreadsheetApp, PropertiesService, UrlFetchApp, Utilities, ScriptApp,
    Logger: { log: () => {} },
  });
  vm.runInContext(FONTE + "\ncriarFormMovimenta7();", contexto);
  return { contexto, planilha: () => planilha, registro, titulos, rede, gatilhos, propriedades };
}

const ambiente = ambienteFalso();
const publicar = ambiente.planilha().getSheetByName("PUBLICAR");
const respostas = ambiente.planilha().getSheetByName(ABA_RESPOSTAS);
const cabecalhoPublicar = publicar._linha(1);
const cabecalhoRespostas = respostas._linha(1);

/**
 * The bug this freezes cost the launch an afternoon and left no error behind.
 *
 * setGoToPage governs the page BEFORE the break it is called on. Calling it on
 * the registration break said "after the consent page, submit" — overridden by
 * the branching choice, so nothing looked broken — while the registration page
 * kept its default linear progression into the removal page. Everyone who
 * described their group was then asked to justify removing it, and abandoned.
 * Empty map, green CI, no failure anywhere: nothing HAD failed.
 */
test("finishing the registration page submits, instead of asking to remove the group", () => {
  const remocao = ambiente.registro.paginas.find((p) => /remo/i.test(p.titulo || ""));
  const cadastro = ambiente.registro.paginas.find((p) => /Dados da atividade/i.test(p.titulo || ""));
  assert.ok(remocao && cadastro, "as duas paginas precisam existir");
  assert.equal(remocao.destino, "SUBMIT",
    "a quebra que SEGUE o cadastro e quem faz a pagina de cadastro enviar");
  assert.notEqual(cadastro.destino, "SUBMIT",
    "SUBMIT na quebra do cadastro governa a pagina de consentimento, nao a de cadastro");
});

test("the script builds the PUBLICAR tab, so the owner pastes no formula", () => {
  assert.ok(publicar, "aba PUBLICAR nao foi criada");
  assert.equal(cabecalhoPublicar.length, 13);
  assert.equal(cabecalhoPublicar[0], "grupo");
  assert.equal(cabecalhoPublicar.at(-1), "remover");
});

test("the `remover` brake is added to the response sheet, as a checkbox", () => {
  assert.ok(cabecalhoRespostas.includes("remover"), "coluna remover nao foi criada");
  assert.equal(ambiente.registro.validacoes.length, 1);
  assert.equal(ambiente.registro.validacoes[0].regra, "CHECKBOX");
  // Placed after the last answer, never on top of one.
  assert.equal(cabecalhoRespostas.at(-1), "remover");
});

// The #REF! class of failure, closed. Every column the formula looks up has to
// be a question the same script created, or the tab silently publishes nothing.
test("every MATCH() in the formula points at a column that exists", () => {
  const procurados = [...ambiente.registro.formula.matchAll(/MATCH\("([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(procurados).size, 13);
  const existentes = new Set(cabecalhoRespostas);
  const orfaos = [...new Set(procurados)].filter((t) => !existentes.has(t));
  assert.deepEqual(orfaos, [], `a formula procura colunas que nao existem: ${orfaos.join(" | ")}`);
});

// The response sheet's name is locale-dependent and contains spaces. An
// unquoted reference is a parse error; the wrong name is a #REF!.
test("the formula quotes the real response sheet name", () => {
  assert.match(ambiente.registro.formula, /'Respostas ao formulário 1'!/);
  assert.ok(!ambiente.registro.formula.includes("Respostas!$A"), "nome de aba fixado no codigo");
});

/**
 * THE BUG THAT EMPTIED THE MAP, frozen so it cannot come back.
 *
 * The formula used to read $A$2:$ZZ, which is correct for exactly as long as
 * nobody answers the form. Google Forms delivers a response by INSERTING a row,
 * and an insert at row N pushes every absolute reference at or below N one row
 * down — so $A$2 became $A$3 after the first registration and $A$4 after the
 * second, always one row below the newest answer, matching NOTHING.
 *
 * Measured on the owner's live sheet on 25/08/2026: two registrations, PUBLICAR
 * empty, published CSV with only its header, zero pins — and a green CI
 * throughout, because no file in this repository was misbehaving.
 *
 * The fix is the RANGE, not a corrected row number: $A$2 retyped by hand would
 * drift again on the very next registration. A whole-column reference has no
 * row number left to shift.
 */
test("no reference into the answers can be pushed down by a new response", () => {
  const formula = ambiente.registro.formula;
  const ancorados = [...formula.matchAll(/INDEX\('[^']+'!\$A\$(\d+)/g)].map((m) => m[1]);
  assert.deepEqual(ancorados, [],
    `INDEX ancorado na linha ${ancorados.join(", ")} — vai derivar a cada cadastro`);
  assert.ok(formula.includes("$A:$ZZ"), "a leitura precisa ser de coluna inteira");
});

// The only row-anchored range left is the header row MATCH() searches. That one
// is safe for the same reason the others were not: Forms inserts at row 2 or
// below, so row 1 is the single row in the sheet that never moves.
test("the only row still pinned by number is the header row", () => {
  const faixas = [...ambiente.registro.formula.matchAll(/\$A\$\d+:\$ZZ\$\d+/g)].map((m) => m[0]);
  assert.ok(faixas.length > 0, "MATCH precisa procurar na linha de cabecalho");
  assert.deepEqual([...new Set(faixas)], ["$A$1:$ZZ$1"]);
});

// Reading whole columns means the header row now arrives INSIDE the data, and
// it survives "Nome do grupo" <> "" — so it is excluded by name instead. Drop
// this condition and the question titles publish themselves as a phantom group.
test("the header row is excluded by name, since the range no longer skips it", () => {
  assert.ok(ambiente.registro.formula.includes('<>"Nome do grupo"'),
    "sem esta condicao o cabecalho vira um cadastro fantasma no mapa");
});

// Regression: headers stacked over FILTER in one array literal is an
// ARRAY_LITERAL error while there are no responses, and the published CSV
// becomes the error text — a red build every 10 minutes until someone
// registers. Headers are values in row 1; the formula sits in A2.
test("the empty spreadsheet still publishes a valid header-only CSV", () => {
  const csv = cabecalhoPublicar.join(",") + "\n";
  assert.deepEqual(registrosPublicaveis(csv), []);
});

// The contract that actually matters: the ingestion has to accept this header
// row as-is. It aborts the whole build on a column it does not know.
test("the ingestion accepts a CSV with exactly these columns", () => {
  const linha = {
    grupo: "Corredores da IASD Águas Claras",
    organizacao: "IASD Águas Claras",
    regiao: "Águas Claras",
    modalidades: "Corrida, Caminhada",
    dias: "Domingo, Quarta",
    horario: "06h30",
    local: "Parque Águas Claras, portão principal",
    rede_social: "@iasd.aguasclaras",
    mapa: "https://maps.app.goo.gl/exemplo123",
    orientacao_profissional: "Encontro social de prática livre",
    custo: "Gratuito",
    publico: "Iniciantes bem-vindos",
    remover: "",
  };
  const csv = cabecalhoPublicar.join(",") + "\n" +
    cabecalhoPublicar.map((c) => `"${linha[c]}"`).join(",") + "\n";

  const registros = registrosPublicaveis(csv);
  assert.equal(registros.length, 1);
  assert.equal(registros[0].grupo, linha.grupo);
  assert.deepEqual(registros[0].modalidades, ["Corrida", "Caminhada"]);
  assert.equal(registros[0].rede_social, "https://www.instagram.com/iasd.aguasclaras");
  assert.equal(registros[0].mapa, linha.mapa);
});

// The brake has to work end to end, not just exist as a column.
test("ticking `remover` takes the group off the map", () => {
  const csv = cabecalhoPublicar.join(",") + "\n" +
    cabecalhoPublicar.map((c) => (c === "remover" ? '"TRUE"' : '"x"')).join(",") + "\n";
  assert.deepEqual(registrosPublicaveis(csv), []);
});

/**
 * The repair path, which is the one that actually ran on 25/08/2026.
 *
 * criarFormMovimenta7() always builds a NEW form and a NEW spreadsheet, so once
 * the form link has been shared it is the wrong tool: the owner would end up
 * with two forms and the wrong one in everybody's hands. consertarAbaPublicar()
 * rebuilds only the tab, on the sheet it is run from — and this test exists
 * because that distinction is invisible until it has already happened.
 */
test("consertarAbaPublicar rewrites the tab without creating a second form", () => {
  const antes = ambiente.registro.formsCriados;
  // Whatever is in the cell today — including the drifted formula from the
  // owner's sheet — has to be replaced, not merged with.
  ambiente.registro.formula = `=IFERROR(FILTER(INDEX('Form Responses 1'!$A$4:$ZZ,0,1)),"")`;

  vm.runInContext("consertarAbaPublicar();", ambiente.contexto);

  assert.equal(ambiente.registro.formsCriados, antes, "criou um formulario novo — nao pode");
  assert.ok(!ambiente.registro.formula.includes("$A$4"), "a formula velha ficou na celula");
  assert.ok(ambiente.registro.formula.includes("$A:$ZZ"), "nao remontou a formula");
  // The failure the guard in consertarAbaPublicar exists for: PUBLICAR is 13
  // columns wide, so acharAbaDeRespostas()'s "any wide tab" fallback can hand it
  // back as its own source — a circular reference that publishes nothing.
  assert.ok(ambiente.registro.formula.includes(`'${ABA_RESPOSTAS}'!`),
    "a formula tem que ler a aba de RESPOSTAS");
  assert.ok(!ambiente.registro.formula.includes("PUBLICAR!"),
    "a aba PUBLICAR virou fonte dela mesma");
  // And the tab it leaves behind still has to be the one the ingestion accepts.
  assert.deepEqual(registrosPublicaveis(publicar._linha(1).join(",") + "\n"), []);
});

/**
 * scripts/PUBLICAR_A2.txt is the formula the owner pastes by hand to repair a
 * sheet that is already live. It is a COPY of what montarAbaPublicar() builds,
 * and a stale copy fails in the worst way available: a wrong MATCH() string
 * makes the whole FILTER return #N/A, IFERROR turns that into "", and the tab
 * goes quietly empty — the very failure this file exists to prevent. So the
 * copy is compared against the generator on every run.
 *
 * The two differ only in the response tab's name (the file targets an en-US
 * account, the stub a pt-BR one), so that is normalised away before comparing.
 */
test("the paste-by-hand formula still matches the one the script generates", () => {
  const arquivo = readFileSync(new URL("../scripts/PUBLICAR_A2.txt", import.meta.url), "utf8");
  // indexOf + slice, sem regex: a formula e a ultima coisa do arquivo, e
  // escapar quebra de linha aqui ja custou tres tentativas.
  const doArquivo = arquivo.slice(arquivo.indexOf("=IFERROR(")).trim();
  assert.ok(doArquivo, "nao achei a formula em scripts/PUBLICAR_A2.txt");

  const semNomeDeAba = (f) => f.replace(/'[^']+'!/g, "'ABA'!");
  assert.equal(semNomeDeAba(doArquivo.trim()), semNomeDeAba(ambiente.registro.formula),
    "PUBLICAR_A2.txt ficou desatualizado: gere de novo antes de mandar o dono colar");
});

/* ===========================================================================
 * INSTANT PUBLICATION — the trigger that replaces waiting for the cron
 * ===========================================================================
 *
 * Everything below runs inside the owner's Google account, against GitHub's API,
 * on a schedule nobody here controls. When it breaks it breaks THERE, in an
 * execution log only he can open, and nothing in this repository goes red — the
 * same shape of failure that emptied the map on 25/08. So every contract it
 * leans on is pinned from this side, where a mistake costs a red build instead
 * of a week of a site that quietly feels slow again.
 */

const REDE_PADRAO = ambiente.rede.responder;
const limparRede = () => {
  ambiente.rede.responder = REDE_PADRAO;
  ambiente.rede.chamadas.length = 0;
  ambiente.rede.esperas.length = 0;
};
const doGitHub = () => ambiente.rede.chamadas.filter((c) => c.url.includes("api.github.com"));
const doCsv = () => ambiente.rede.chamadas.filter((c) => !c.url.includes("api.github.com"));

/** One registration arriving, shaped the way Apps Script delivers it. */
const CADASTRO_CHEGOU = "aoEnviarFormulario({ namedValues: { " +
  JSON.stringify(ambiente.contexto.TITULOS.grupo) + ": [" + JSON.stringify(GRUPO_NOVO) + "] } });";

test("the property names in the code are the ones the guide tells the owner to type", () => {
  assert.equal(ambiente.contexto.PROP_TOKEN, PROP.token);
  assert.equal(ambiente.contexto.PROP_CSV, PROP.csv);
  assert.equal(ambiente.contexto.PROP_REPO, PROP.repo);
  const guia = readFileSync(new URL("../moderacao/COMO_LIGAR_A_PLANILHA.md", import.meta.url), "utf8");
  for (const nome of Object.values(PROP)) {
    assert.ok(guia.includes(nome),
      `o guia do dono nao cita ${nome} — ele nao tem como saber que precisa criar essa propriedade`);
  }
});

/**
 * The cross-file contract that fails INVISIBLY.
 *
 * The trigger asks GitHub to run a workflow BY FILE NAME, and GitHub answers 422
 * if that file does not offer workflow_dispatch. Rename ci.yml, or drop that one
 * line from its `on:` block, and the only symptom is a failure inside the
 * owner's Apps Script log — the site simply goes back to updating within the
 * hour, which is indistinguishable from a quiet week.
 */
test("the workflow the trigger calls exists and accepts being dispatched", () => {
  const nome = ambiente.contexto.WORKFLOW;
  const yml = readFileSync(new URL(`../.github/workflows/${nome}`, import.meta.url), "utf8");
  const bloco = yml.slice(yml.indexOf("\non:"), yml.indexOf("\njobs:"));
  assert.ok(bloco, "nao achei o bloco on: do workflow");
  assert.match(bloco, /^\s{2}workflow_dispatch:\s*$/m,
    `sem workflow_dispatch em ${nome}, o gatilho do formulario so recebe 422`);
  assert.ok(bloco.includes(`[${ambiente.contexto.BRANCH}]`),
    `o gatilho pede o branch "${ambiente.contexto.BRANCH}", que nao e o que o workflow publica`);
});

/**
 * The permission choice, frozen.
 *
 * repository_dispatch (POST /repos/{owner}/{repo}/dispatches) needs Contents:
 * write on a fine-grained token — permission to PUSH COMMITS. On this project
 * the repository IS the website, so a token like that, leaked from a Google
 * account, publishes anything it likes to the map. workflow_dispatch needs only
 * Actions: write, which can start a workflow and nothing else. The two URLs
 * differ by four path segments and one word in a guide; this test is what keeps
 * a future edit from swapping the safe one for the convenient one.
 */
test("it publishes through the narrow API, never the one that can push commits", () => {
  limparRede();
  vm.runInContext(CADASTRO_CHEGOU, ambiente.contexto);

  const pedido = doGitHub()[0];
  assert.ok(pedido, "nenhum pedido de publicacao foi feito ao GitHub");
  assert.match(pedido.url, /\/actions\/workflows\/ci\.yml\/dispatches$/);
  assert.ok(!/\/repos\/[^/]+\/[^/]+\/dispatches$/.test(pedido.url),
    "repository_dispatch exige Contents: write — um token que empurra commit no site");
  assert.equal(pedido.opcoes.method, "post");
  assert.equal(JSON.parse(pedido.opcoes.payload).ref, ambiente.contexto.BRANCH);
  assert.equal(pedido.opcoes.headers.Authorization, "Bearer tok_de_teste",
    "o token foi usado sem trim: a quebra de linha que vem colada junto vira um 401");
  limparRede();
});

/**
 * Why the trigger waits at all, and why the wait has to END EARLY.
 *
 * The site does not read the spreadsheet — it reads the CSV Google republishes
 * from the PUBLICAR tab, and that republication is not instantaneous. Firing the
 * workflow the millisecond a response lands would often publish a map WITHOUT
 * the group that just registered, and since the run already happened, that
 * person would then wait a full cron round anyway, having watched the site
 * update and leave them out. Slower AND more confusing than not being instant.
 */
test("it waits for the published CSV to show the group, then publishes", () => {
  limparRede();
  let tentativas = 0;
  ambiente.rede.responder = (url) => {
    if (url.includes("api.github.com")) return { codigo: 204, texto: "" };
    tentativas++;
    return { codigo: 200, texto: tentativas >= 3 ? `grupo\n${GRUPO_NOVO}\n` : "grupo\n" };
  };

  vm.runInContext(CADASTRO_CHEGOU, ambiente.contexto);

  const ordem = ambiente.rede.chamadas.map((c) => (c.url.includes("api.github.com") ? "github" : "csv"));
  assert.deepEqual(ordem, ["csv", "csv", "csv", "github"],
    "publicou antes de o cadastro aparecer no CSV, ou continuou esperando depois de aparecer");
  assert.ok(ambiente.rede.esperas.length >= 3, "nao esperou entre as tentativas");
  // Without a parameter that changes, the ~5 min cache in front of the published
  // URL would hand back the same pre-registration answer every single time, and
  // the loop would always run to the end.
  doCsv().forEach((c) => assert.match(c.url, /[?&]_=\d+/,
    "sem parametro variavel a leitura sai do cache e a espera nunca termina cedo"));
  limparRede();
});

test("if the CSV never shows the group, it publishes anyway instead of giving up", () => {
  limparRede();
  ambiente.rede.responder = (url) => (url.includes("api.github.com")
    ? { codigo: 204, texto: "" }
    : { codigo: 200, texto: "grupo\n" });

  vm.runInContext(CADASTRO_CHEGOU, ambiente.contexto);

  assert.equal(doCsv().length, ambiente.contexto.ESPERA_TENTATIVAS, "desistiu antes da hora");
  assert.equal(doGitHub().length, 1,
    "desistiu de publicar — uma rodada talvez cedo demais ainda e melhor que uma hora de espera");
  limparRede();
});

test("a network that is down does not stop the publication", () => {
  limparRede();
  ambiente.rede.responder = (url) => {
    if (url.includes("api.github.com")) return { codigo: 204, texto: "" };
    throw new Error("rede caiu");
  };
  vm.runInContext(CADASTRO_CHEGOU, ambiente.contexto);
  assert.equal(doGitHub().length, 1, "a leitura do CSV derrubou o disparo junto");
  limparRede();
});

/**
 * A group name arriving as a bare string instead of a list.
 *
 * v[0] on a string is its first LETTER, and searching the published CSV for "V"
 * matches instantly, every time — the wait would always pass on the first try,
 * which looks precisely like a working wait and is the bug the wait exists to
 * prevent.
 */
test("the group name is read whole, even if it does not arrive as a list", () => {
  limparRede();
  const lidos = [];
  ambiente.rede.responder = (url) => {
    if (url.includes("api.github.com")) return { codigo: 204, texto: "" };
    lidos.push(url);
    return { codigo: 200, texto: `grupo\n${GRUPO_NOVO}\n` };
  };
  vm.runInContext("aoEnviarFormulario({ namedValues: { " +
    JSON.stringify(ambiente.contexto.TITULOS.grupo) + ": " + JSON.stringify(GRUPO_NOVO) + " } });",
  ambiente.contexto);
  assert.equal(doGitHub().length, 1);
  assert.equal(lidos.length, 1, "leu o CSV mais de uma vez: o nome do grupo saiu truncado");
  limparRede();
});

// ---------- as mensagens de erro, que só o dono vai ler ----------

test("a token without permission says WHICH permission, in Portuguese", () => {
  limparRede();
  ambiente.rede.responder = () => ({ codigo: 403, texto: "" });
  assert.throws(() => vm.runInContext("publicarAgora();", ambiente.contexto), (e) => {
    assert.match(e.message, /Actions/, "a mensagem nao diz qual permissao falta");
    assert.match(e.message, /permissao/i);
    return true;
  });
  limparRede();
});

test("no failure message ever prints the token", () => {
  for (const codigo of [401, 403, 404, 422, 500]) {
    limparRede();
    ambiente.rede.responder = () => ({ codigo, texto: "segredo=tok_de_teste" });
    assert.throws(() => vm.runInContext("publicarAgora();", ambiente.contexto), (e) => {
      assert.ok(!e.message.includes("tok_de_teste"),
        `a mensagem do ${codigo} vaza o token, e o dono cola esse log no chat`);
      return true;
    });
  }
  limparRede();
});

test("with no token stored, the error says exactly where to put one", () => {
  limparRede();
  ambiente.propriedades.set(PROP.token, "   "); // só espaços: o mesmo que nada
  assert.throws(() => vm.runInContext("publicarAgora();", ambiente.contexto), (e) => {
    assert.match(e.message, /Propriedades do script/);
    assert.match(e.message, new RegExp(PROP.token));
    return true;
  });
  assert.equal(doGitHub().length, 0, "chamou o GitHub sem token");
  ambiente.propriedades.set(PROP.token, " tok_de_teste\n");
  limparRede();
});

// ---------- a instalação, que o dono roda uma vez ----------

test("installing the trigger twice does not create a second one", () => {
  limparRede();
  vm.runInContext("instalarGatilhoDePublicacao();", ambiente.contexto);
  vm.runInContext("instalarGatilhoDePublicacao();", ambiente.contexto);

  assert.equal(ambiente.gatilhos.length, 1,
    "dois gatilhos = duas publicacoes por cadastro, para sempre");
  assert.equal(ambiente.gatilhos[0].tipo, "onFormSubmit");
  // A typo here creates a trigger that fires forever and fails every time.
  assert.equal(ambiente.gatilhos[0].funcao, ambiente.contexto.FUNCAO_DO_GATILHO);
  assert.equal(typeof ambiente.contexto[ambiente.contexto.FUNCAO_DO_GATILHO], "function",
    "o gatilho aponta para uma funcao que nao existe neste arquivo");
  limparRede();
});

/**
 * The install ends by publishing for real, and that is the point of it: a wrong
 * token fails HERE, in front of the owner, with a sentence telling him what to
 * fix — instead of failing weeks later at a stranger's registration, where the
 * only symptom is that the site feels slow again.
 */
test("installing proves the token works right then, not weeks later", () => {
  limparRede();
  let bateu = false;
  ambiente.rede.responder = (url) => {
    if (url.includes("api.github.com")) { bateu = true; return { codigo: 401, texto: "" }; }
    return { codigo: 200, texto: "" };
  };
  assert.throws(() => vm.runInContext("instalarGatilhoDePublicacao();", ambiente.contexto), (e) => {
    assert.match(e.message, /401|token/i);
    return true;
  });
  assert.ok(bateu, "instalou o gatilho sem nunca testar o token");
  limparRede();
});

/**
 * Rule 11 of CLAUDE.md, enforced instead of remembered: this repository is
 * public, and this is now the one file in it whose whole job is to hold a
 * credential — somewhere else.
 */
test("no GitHub token was ever pasted into this repository", () => {
  const parecemToken = /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/;
  assert.ok(!parecemToken.test(FONTE),
    "tem coisa com cara de token do GitHub em scripts/criar_form.gs — o repositorio e publico");
  assert.ok(FONTE.includes("PropertiesService"),
    "o token tem que vir das Propriedades do Script, nunca do codigo");
});

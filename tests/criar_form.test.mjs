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

  const contexto = vm.createContext({ FormApp, SpreadsheetApp, Logger: { log: () => {} } });
  vm.runInContext(FONTE + "\ncriarFormMovimenta7();", contexto);
  return { contexto, planilha: () => planilha, registro, titulos };
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

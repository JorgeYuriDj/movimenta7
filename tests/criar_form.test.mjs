/**
 * Contract tests for the Google Apps Script that owns the registration form,
 * its private spreadsheet feed and the two publication triggers.
 *
 * The real script runs inside the owner's Google account. These stubs keep the
 * security-sensitive cross-service contracts executable in the repository:
 * no public spreadsheet, no private columns in the feed, and no broad GitHub
 * token permission just to ask for a deployment.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const FONTE = readFileSync(new URL("../scripts/criar_form.gs", import.meta.url), "utf8");
const ABA_RESPOSTAS = "Respostas ao formulario 1";
const PROP = {
  githubToken: "GITHUB_TOKEN",
  githubRepo: "GITHUB_REPO",
  spreadsheetId: "MOV7_SPREADSHEET_ID",
  feedToken: "MOV7_FEED_TOKEN",
  ownerEmail: "MOV7_OWNER_EMAIL",
  lastDispatch: "MOV7_LAST_DISPATCH_AT",
  dispatchPending: "MOV7_DISPATCH_PENDING",
  lastAlert: "MOV7_LAST_REMOVAL_ALERT_AT",
  alertDay: "MOV7_REMOVAL_ALERT_DAY",
  alertAttempts: "MOV7_REMOVAL_ALERT_ATTEMPTS",
  alertError: "MOV7_LAST_REMOVAL_ALERT_ERROR",
};
const SEGREDO_FEED = "feed_token_de_teste_com_mais_de_32_caracteres";

function ambienteFalso() {
  const titulos = [];
  const registro = {
    confirmacao: "",
    descricao: "",
    emails: [],
    formsCriados: 0,
    itens: [],
    locks: [],
    logs: [],
    paginas: [],
    validacoes: [],
  };

  const novoItem = (tipo) => {
    const estado = { tipo, titulo: "", obrigatorio: false, escolhas: [], ajuda: "" };
    registro.itens.push(estado);
    const self = {
      setTitle(titulo) {
        estado.titulo = titulo;
        titulos.push(titulo);
        return self;
      },
      setRequired(valor = true) { estado.obrigatorio = Boolean(valor); return self; },
      setChoiceValues(valores) { estado.escolhas = Array.from(valores); return self; },
      setHelpText(texto) { estado.ajuda = texto; return self; },
      setChoices(escolhas) { estado.escolhas = Array.from(escolhas); return self; },
      createChoice(rotulo, destino) { return { rotulo, destino }; },
      getTitle() { return estado.titulo; },
      asMultipleChoiceItem() { return self; },
      asParagraphTextItem() { return self; },
      asTextItem() { return self; },
      _estado: estado,
    };
    estado.api = self;
    return self;
  };

  const novaPagina = () => {
    const pagina = { titulo: "", destino: null };
    registro.paginas.push(pagina);
    const api = {
      setTitle(titulo) { pagina.titulo = titulo; return this; },
      setGoToPage(destino) { pagina.destino = destino; return this; },
      getTitle: () => pagina.titulo,
      asPageBreakItem() { return api; },
    };
    pagina.api = api;
    return api;
  };

  function folha(nome, cabecalho) {
    const celulas = [cabecalho.slice()];
    const escrever = (linha, coluna, valor) => {
      while (celulas.length < linha) celulas.push([]);
      celulas[linha - 1][coluna - 1] = valor;
    };
    const bloco = (linha, coluna, nLinhas, nColunas, exibir) => {
      const saida = [];
      for (let r = 0; r < nLinhas; r++) {
        const atual = celulas[linha - 1 + r] || [];
        const valores = [];
        for (let c = 0; c < nColunas; c++) {
          const valor = atual[coluna - 1 + c] ?? "";
          valores.push(exibir ? String(valor) : valor);
        }
        saida.push(valores);
      }
      return saida;
    };
    const self = {
      getSheetName: () => nome,
      getMaxRows: () => 1000,
      getLastColumn: () => Math.max(0, ...celulas.map((linha) => linha.length)),
      getLastRow: () => celulas.reduce((ultima, linha, i) =>
        (linha.some((valor) => valor !== "" && valor !== null && valor !== undefined) ? i + 1 : ultima), 0),
      getRange(a, b, c = 1, d = 1) {
        if (typeof a === "string") throw new Error(`A1 nao implementado no stub: ${a}`);
        const linha = a;
        const coluna = b;
        return {
          getValues: () => bloco(linha, coluna, c, d, false),
          getDisplayValues: () => bloco(linha, coluna, c, d, true),
          getDisplayValue: () => bloco(linha, coluna, 1, 1, true)[0][0],
          setValue(valor) { escrever(linha, coluna, valor); return this; },
          setValues(matriz) {
            matriz.forEach((valores, r) => valores.forEach((valor, i) => escrever(linha + r, coluna + i, valor)));
            return this;
          },
          setNote: () => this,
          setDataValidation(regra) {
            registro.validacoes.push({ coluna, regra });
            return this;
          },
          getRow: () => linha,
          getColumn: () => coluna,
          getSheet: () => self,
        };
      },
      _linha: (numero) => (celulas[numero - 1] || []).slice(),
      _adicionar(objeto) {
        const cab = celulas[0];
        celulas.push(cab.map((titulo) => objeto[titulo] ?? ""));
      },
    };
    return self;
  }

  function planilhaFalsa(nome) {
    const abas = [folha("Pagina1", [])];
    return {
      getId: () => "ID_PLANILHA_PRIVADA",
      getUrl: () => "https://docs.google.com/spreadsheets/d/ID_PLANILHA_PRIVADA/edit",
      getName: () => nome,
      getFormUrl: () => "https://docs.google.com/forms/d/FORM_ID/edit",
      getSheets: () => abas.slice(),
      getSheetByName: (procurado) => abas.find((aba) => aba.getSheetName() === procurado) || null,
      _receberRespostas: () => abas.push(folha(ABA_RESPOSTAS, ["Carimbo de data/hora", ...titulos])),
    };
  }

  let planilha = null;
  let formAtual = null;
  let planilhaAtiva = true;
  const FormApp = {
    DestinationType: { SPREADSHEET: "SPREADSHEET" },
    PageNavigationType: { CONTINUE: "CONTINUE", SUBMIT: "SUBMIT" },
    ItemType: {
      MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
      PAGE_BREAK: "PAGE_BREAK",
      PARAGRAPH_TEXT: "PARAGRAPH",
      TEXT: "TEXT",
    },
    create() {
      registro.formsCriados++;
      const form = {
        setDescription(texto) { registro.descricao = texto; return form; },
        setCollectEmail(valor) { registro.coletaEmail = valor; return form; },
        setLimitOneResponsePerUser(valor) { registro.limitaUmaResposta = valor; return form; },
        setPublished(valor) { registro.publicado = valor; return form; },
        setConfirmationMessage(texto) { registro.confirmacao = texto; return form; },
        addMultipleChoiceItem: () => novoItem("MULTIPLE_CHOICE"),
        addTextItem: () => novoItem("TEXT"),
        addListItem: () => novoItem("LIST"),
        addCheckboxItem: () => novoItem("CHECKBOX"),
        addParagraphTextItem: () => novoItem("PARAGRAPH"),
        addPageBreakItem: novaPagina,
        setDestination: () => planilha._receberRespostas(),
        getEditUrl: () => "https://docs.google.com/forms/d/FORM_ID/edit",
        getPublishedUrl: () => "https://docs.google.com/forms/d/FORM_ID/viewform",
        getItems(tipo) {
          if (tipo === FormApp.ItemType.PAGE_BREAK) return registro.paginas.map((pagina) => pagina.api);
          return registro.itens
            .filter((estado) => !tipo || estado.tipo === tipo)
            .map((estado) => estado.api);
        },
      };
      formAtual = form;
      return form;
    },
    openByUrl: () => formAtual,
  };

  const SpreadsheetApp = {
    create(nome) { planilha = planilhaFalsa(nome); return planilha; },
    openById(id) {
      if (id !== planilha.getId()) throw new Error("planilha errada");
      return planilha;
    },
    getActive: () => (planilhaAtiva ? planilha : null),
    flush: () => {},
    newDataValidation: () => ({ requireCheckbox: () => ({ build: () => "CHECKBOX" }) }),
  };

  const propriedades = new Map([
    [PROP.githubToken, " token_github_de_teste\n"],
    [PROP.feedToken, SEGREDO_FEED],
  ]);
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (chave) => (propriedades.has(chave) ? propriedades.get(chave) : null),
      setProperty(chave, valor) { propriedades.set(chave, String(valor)); return this; },
    }),
  };

  const rede = { chamadas: [], responder: () => ({ codigo: 204, texto: "" }) };
  const UrlFetchApp = {
    fetch(url, opcoes = {}) {
      rede.chamadas.push({ url, opcoes });
      const resultado = rede.responder(url, opcoes);
      return {
        getResponseCode: () => resultado.codigo,
        getContentText: () => resultado.texto,
      };
    },
  };

  const gatilhos = [];
  let proximoGatilho = 0;
  const adicionarGatilho = ({ funcao, tipo, planilha: origem = null, atraso = null }) => {
    const gatilho = { id: `TRIGGER_${++proximoGatilho}`, funcao, tipo, planilha: origem, atraso };
    gatilhos.push(gatilho);
    return gatilho;
  };
  const apiGatilho = (gatilho) => ({
    getEventType: () => gatilho.tipo,
    getHandlerFunction: () => gatilho.funcao,
    getTriggerSourceId: () => gatilho.planilha,
    getUniqueId: () => gatilho.id,
    _gatilho: gatilho,
  });
  const ScriptApp = {
    EventType: { ON_FORM_SUBMIT: "onFormSubmit", ON_EDIT: "onEdit", CLOCK: "clock" },
    newTrigger(funcao) {
      const gatilho = { funcao, tipo: null, planilha: null, atraso: null };
      const construtor = {
        forSpreadsheet(ss) { gatilho.planilha = ss.getId(); return construtor; },
        onFormSubmit() { gatilho.tipo = "onFormSubmit"; return construtor; },
        onEdit() { gatilho.tipo = "onEdit"; return construtor; },
        timeBased() { gatilho.tipo = "clock"; return construtor; },
        after(ms) { gatilho.atraso = ms; return construtor; },
        create() { return apiGatilho(adicionarGatilho(gatilho)); },
      };
      return construtor;
    },
    getProjectTriggers: () => gatilhos.map(apiGatilho),
    deleteTrigger(gatilhoApi) {
      const id = gatilhoApi.getUniqueId();
      const indice = gatilhos.findIndex((gatilho) => gatilho.id === id);
      if (indice >= 0) gatilhos.splice(indice, 1);
    },
    getService: () => ({ getUrl: () => "https://script.google.com/macros/s/DEPLOYMENT_ID/exec" }),
  };

  const LockService = {
    getScriptLock() {
      const estado = { esperou: false, liberou: false };
      registro.locks.push(estado);
      return {
        waitLock(ms) { estado.esperou = ms; },
        releaseLock() { estado.liberou = true; },
      };
    },
  };

  const correio = { consultas: 0, falha: null, restante: 100 };
  const MailApp = {
    getRemainingDailyQuota() { correio.consultas++; return correio.restante; },
    sendEmail(mensagem) {
      if (correio.falha) throw correio.falha;
      registro.emails.push({ ...mensagem });
      correio.restante--;
    },
  };

  const Session = {
    getEffectiveUser: () => ({ getEmail: () => "dono.efetivo@example.test" }),
  };

  const ContentService = {
    MimeType: { JSON: "application/json" },
    createTextOutput(texto) {
      return {
        text: texto,
        mimeType: "",
        setMimeType(tipo) { this.mimeType = tipo; return this; },
      };
    },
  };

  const contexto = vm.createContext({
    ContentService,
    FormApp,
    LockService,
    Logger: { log: (mensagem) => registro.logs.push(String(mensagem)) },
    MailApp,
    PropertiesService,
    ScriptApp,
    Session,
    SpreadsheetApp,
    UrlFetchApp,
  });
  vm.runInContext(`${FONTE}\ncriarFormMovimenta7();`, contexto);

  return {
    contexto,
    adicionarGatilho,
    correio,
    gatilhos,
    planilha: () => planilha,
    propriedades,
    rede,
    registro,
    respostas: () => planilha.getSheetByName(ABA_RESPOSTAS),
    setPlanilhaAtiva: (valor) => { planilhaAtiva = valor; },
    setAgora(valor) {
      contexto.__agoraTeste = valor;
      vm.runInContext("agoraMs_ = function () { return __agoraTeste; };", contexto);
    },
  };
}

const ambiente = ambienteFalso();
const executarEm = (alvo, codigo) => vm.runInContext(codigo, alvo.contexto);
const executar = (codigo) => executarEm(ambiente, codigo);
const resposta = (codigo) => JSON.parse(executar(codigo).text);
const limparRedeDe = (alvo) => {
  alvo.rede.chamadas.length = 0;
  alvo.rede.responder = () => ({ codigo: 204, texto: "" });
};
const limparRede = () => limparRedeDe(ambiente);

test("the registration page submits instead of falling into the removal page", () => {
  const remocao = ambiente.registro.paginas.find((pagina) => /remo/i.test(pagina.titulo));
  const cadastro = ambiente.registro.paginas.find((pagina) => /Dados da atividade/i.test(pagina.titulo));
  assert.ok(remocao && cadastro);
  assert.equal(remocao.destino, "SUBMIT");
  assert.notEqual(cadastro.destino, "SUBMIT");
});

test("Google Maps and social profile are mandatory and confirmation sends the user back to the map", () => {
  const mapa = ambiente.registro.itens.find((item) => item.titulo === ambiente.contexto.TITULOS.mapa);
  const redeSocial = ambiente.registro.itens.find(
    (item) => item.titulo === ambiente.contexto.TITULOS.rede_social,
  );
  assert.ok(mapa, "pergunta do Google Maps ausente");
  assert.ok(redeSocial, "pergunta de rede social ausente");
  assert.equal(mapa.obrigatorio, true);
  assert.equal(redeSocial.obrigatorio, true);
  assert.match(ambiente.registro.confirmacao, /autom.tic/i);
  assert.match(ambiente.registro.confirmacao, /privad/i);
  assert.match(ambiente.registro.confirmacao, /#secao-mapa/);
});

test("privacy copy says what is not requested or published without claiming nothing is collected", () => {
  const texto = `${ambiente.registro.descricao}\n${ambiente.registro.confirmacao}\n${FONTE}`;
  assert.match(ambiente.registro.descricao, /NÃO SOLICITAMOS DADOS PESSOAIS/);
  assert.match(ambiente.registro.descricao, /NÃO PUBLICAMOS/);
  assert.doesNotMatch(texto, /NO PERSONAL DATA IS COLLECTED AT ALL/i);
  assert.doesNotMatch(texto, /N[aã]o coletamos dados de menores/i);
  assert.doesNotMatch(texto, /Atendemos em at[eé] 24 horas/i);
});

test("the private response sheet gets one reversible removal checkbox", () => {
  const cabecalho = ambiente.respostas()._linha(1);
  assert.equal(cabecalho.at(-1), "remover");
  assert.equal(cabecalho.filter((valor) => valor === "remover").length, 1);
  assert.deepEqual(ambiente.registro.validacoes, [{ coluna: cabecalho.length, regra: "CHECKBOX" }]);
});

test("a newly created spreadsheet has no PUBLICAR tab or instruction to publish on the web", () => {
  assert.equal(ambiente.planilha().getSheetByName("PUBLICAR"), null);
  assert.ok(!ambiente.registro.logs.some((linha) => /Publicar na web/i.test(linha)));
  assert.ok(!FONTE.includes("montarAbaPublicar"));
  assert.ok(!FONTE.includes("consertarAbaPublicar"));
});

test("the public GET health check contains no spreadsheet data", () => {
  const doc = resposta("doGet();");
  assert.deepEqual(doc, { ok: true, servico: "movimenta7-feed", schema_version: 1 });
  assert.equal("linhas" in doc, false);
  assert.equal("colunas" in doc, false);
});

test("the private feed rejects missing, short and wrong tokens", () => {
  for (const evento of [
    "{}",
    "{ parameter: { acao: 'feed', token: 'curto' } }",
    "{ parameter: { acao: 'outra', token: " + JSON.stringify(SEGREDO_FEED) + " } }",
    "{ parameter: { acao: 'feed', token: 'x'.repeat(80) } }",
  ]) {
    assert.deepEqual(resposta(`doPost(${evento});`), { ok: false, erro: "acesso negado" });
  }
});

test("the authenticated feed projects only public columns and skips removal-only answers", () => {
  const titulos = ambiente.contexto.TITULOS;
  ambiente.respostas()._adicionar({
    [titulos.grupo]: "Corredores do Lago",
    [titulos.organizacao]: "IASD Lago Norte",
    [titulos.regiao]: "Lago Norte",
    [titulos.modalidades]: "Corrida, Caminhada",
    [titulos.dias]: "Domingo",
    [titulos.horario]: "06h30",
    [titulos.local]: "Parque Vivencial",
    [titulos.rede_social]: "@corredoresdolago",
    [titulos.mapa]: "https://maps.app.goo.gl/exemplo123",
    [titulos.orientacao_profissional]: "Encontro social de pratica livre",
    [titulos.custo]: "Gratuito",
    [titulos.publico]: "Iniciantes bem-vindos",
    remover: "",
    "O que precisa ser corrigido ou removido?": "SEGREDO_QUE_NAO_PODE_SAIR",
  });
  ambiente.respostas()._adicionar({
    "Qual grupo sai ou muda? (nome exato como aparece no mapa)": "Outro grupo",
    "O que precisa ser corrigido ou removido?": "remover agora",
  });

  ambiente.setPlanilhaAtiva(false);
  const doc = resposta(`doPost({ parameter: { acao: 'feed', token: ${JSON.stringify(SEGREDO_FEED)} } });`);
  ambiente.setPlanilhaAtiva(true);

  assert.deepEqual(doc.colunas, [
    "grupo", "organizacao", "regiao", "modalidades", "dias", "horario",
    "local", "rede_social", "mapa", "orientacao_profissional", "custo", "publico", "remover",
  ]);
  assert.equal(doc.linhas.length, 1, "o ramo de remocao nao pode virar cadastro");
  assert.equal(doc.linhas[0][0], "Corredores do Lago");
  assert.equal(doc.linhas[0].length, doc.colunas.length);
  assert.ok(!JSON.stringify(doc).includes("SEGREDO_QUE_NAO_PODE_SAIR"));
});

test("feed setup requires a strong secret and migrates the existing form copy idempotently", () => {
  const local = ambienteFalso();
  local.propriedades.delete(PROP.feedToken);
  local.setPlanilhaAtiva(false); // same standalone project that created the form

  assert.throws(() => executarEm(local, "configurarFeedPrivado();"), /pelo menos 32 caracteres/);
  assert.equal(local.propriedades.has(PROP.feedToken), false, "o script inventou um segredo");

  local.propriedades.set(PROP.feedToken, "curto");
  assert.throws(() => executarEm(local, "configurarFeedPrivado();"), /pelo menos 32 caracteres/);

  local.propriedades.set(PROP.feedToken, SEGREDO_FEED);
  local.registro.descricao = "NÃO PEDIMOS NENHUM DADO; tudo é público. Não coletamos dados de menores.";
  local.registro.confirmacao = "Cadastro recebido em até 24 horas.";
  local.registro.coletaEmail = true;
  local.registro.limitaUmaResposta = true;
  local.registro.publicado = false;
  const grupo = local.registro.itens.find((item) => item.titulo === local.contexto.TITULOS.grupo);
  grupo.ajuda = "NAO_MEXER_EM_CAMPO_NAO_ALVO";
  const paginaCadastro = local.registro.paginas.find(
    (pagina) => pagina.titulo === local.contexto.TITULO_PAGINA_CADASTRO,
  );
  const paginaRemocao = local.registro.paginas.find(
    (pagina) => pagina.titulo === local.contexto.TITULO_PAGINA_REMOCAO,
  );
  paginaCadastro.destino = "SUBMIT"; // bug da versão publicada em 25/08
  paginaRemocao.destino = null;
  for (const item of local.registro.itens) {
    if ([local.contexto.TITULOS.mapa, local.contexto.TITULOS.rede_social].includes(item.titulo)) {
      item.obrigatorio = false; // simula um formulário antigo
    }
    if (item.titulo === local.contexto.TITULOS.rede_social) {
      item.ajuda = "Deixe em branco se o grupo não tiver perfil.";
    }
    if (item.titulo === local.contexto.TITULOS.mapa) item.ajuda = "Ajuda antiga do mapa.";
    if (item.titulo === local.contexto.TITULO_CONSENTIMENTO) {
      item.escolhas = ["LI e CONCORDO: tudo o que eu preencher aqui é público"];
    }
    if (item.titulo === local.contexto.TITULO_PEDIDO_PRIVADO) {
      item.ajuda = "Atendemos em até 24 horas.";
    }
  }
  executarEm(local, "configurarFeedPrivado();");
  executarEm(local, "configurarFeedPrivado();");

  assert.equal(local.propriedades.get(PROP.feedToken), SEGREDO_FEED, "rerun trocou o segredo existente");
  assert.equal(local.propriedades.get(PROP.spreadsheetId), local.planilha().getId());
  for (const titulo of [local.contexto.TITULOS.mapa, local.contexto.TITULOS.rede_social]) {
    assert.equal(local.registro.itens.find((item) => item.titulo === titulo).obrigatorio, true);
  }
  assert.equal(local.registro.descricao, executarEm(local, "descricaoDoFormulario_();"));
  assert.equal(local.registro.confirmacao, executarEm(local, "confirmacaoDoFormulario_();"));
  assert.equal(local.registro.coletaEmail, false, "a migracao nao pode coletar e-mail");
  assert.equal(local.registro.limitaUmaResposta, false, "o cadastro nao pode exigir login por limite de resposta");
  assert.equal(local.registro.publicado, true, "o link publico do formulario deve continuar publicado");
  assert.equal(
    local.registro.itens.find((item) => item.titulo === local.contexto.TITULOS.rede_social).ajuda,
    local.contexto.AJUDA_REDE_SOCIAL,
  );
  assert.equal(
    local.registro.itens.find((item) => item.titulo === local.contexto.TITULOS.mapa).ajuda,
    local.contexto.AJUDA_MAPA,
  );
  assert.deepEqual(
    local.registro.itens.find((item) => item.titulo === local.contexto.TITULO_CONSENTIMENTO).escolhas,
    [local.contexto.TEXTO_CONSENTIMENTO],
  );
  assert.equal(
    local.registro.itens.find((item) => item.titulo === local.contexto.TITULO_PEDIDO_PRIVADO).ajuda,
    local.contexto.AJUDA_PEDIDO_PRIVADO,
  );
  assert.equal(grupo.ajuda, "NAO_MEXER_EM_CAMPO_NAO_ALVO");
  assert.equal(paginaCadastro.destino, "CONTINUE");
  assert.equal(paginaRemocao.destino, "SUBMIT");
  assert.doesNotMatch(
    JSON.stringify({
      descricao: local.registro.descricao,
      confirmacao: local.registro.confirmacao,
      itens: local.registro.itens.map(({ ajuda, escolhas }) => ({ ajuda, escolhas })),
    }),
    /Atendemos em até 24 horas|Não coletamos dados de menores|Deixe em branco/i,
  );
  assert.ok(!local.registro.logs.some((linha) => linha.includes(SEGREDO_FEED)));
  assert.ok(!FONTE.includes("Utilities.getUuid"));
});

test("the Apps Script property names and workflow secret names stay aligned", () => {
  assert.equal(ambiente.contexto.PROP_TOKEN, PROP.githubToken);
  assert.equal(ambiente.contexto.PROP_REPO, PROP.githubRepo);
  assert.equal(ambiente.contexto.PROP_PLANILHA_ID, PROP.spreadsheetId);
  assert.equal(ambiente.contexto.PROP_FEED_TOKEN, PROP.feedToken);
  assert.equal(ambiente.contexto.PROP_OWNER_EMAIL, PROP.ownerEmail);
  assert.equal(ambiente.contexto.PROP_ULTIMO_DISPARO, PROP.lastDispatch);
  assert.equal(ambiente.contexto.PROP_PUBLICACAO_PENDENTE, PROP.dispatchPending);
  assert.equal(ambiente.contexto.PROP_ULTIMO_ALERTA, PROP.lastAlert);
  assert.equal(ambiente.contexto.PROP_DIA_ALERTA, PROP.alertDay);
  assert.equal(ambiente.contexto.PROP_TENTATIVAS_ALERTA, PROP.alertAttempts);
  assert.equal(ambiente.contexto.PROP_ERRO_ALERTA, PROP.alertError);

  const yml = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.match(yml, /PLANILHA_FEED_URL:\s*\$\{\{ secrets\.PLANILHA_FEED_URL \}\}/);
  assert.match(yml, /PLANILHA_FEED_TOKEN:\s*\$\{\{ secrets\.PLANILHA_FEED_TOKEN \}\}/);
  assert.ok(!yml.includes("PLANILHA_CSV_URL"));
});

test("a registration event calls workflow_dispatch immediately and never fetches a spreadsheet", () => {
  const local = ambienteFalso();
  local.setAgora(1_000_000);
  limparRedeDe(local);
  local.contexto.eventoTeste = {
    namedValues: { [local.contexto.TITULO_ACAO]: [local.contexto.ACAO_CADASTRAR] },
  };
  executarEm(local, "aoEnviarFormulario(eventoTeste);");
  assert.equal(local.rede.chamadas.length, 1);
  const pedido = local.rede.chamadas[0];
  assert.match(pedido.url, /\/actions\/workflows\/ci\.yml\/dispatches$/);
  assert.equal(pedido.opcoes.method, "post");
  assert.equal(JSON.parse(pedido.opcoes.payload).ref, "main");
  assert.equal(pedido.opcoes.headers.Authorization, "Bearer token_github_de_teste");
});

test("only editing a data cell under `remover` requests publication", () => {
  const local = ambienteFalso();
  local.setAgora(1_000_000);
  const respostas = local.respostas();
  const colunaRemover = respostas._linha(1).indexOf("remover") + 1;

  limparRedeDe(local);
  local.contexto.eventoTeste = { range: respostas.getRange(1, colunaRemover) };
  executarEm(local, "aoEditarPlanilha(eventoTeste);");
  assert.equal(local.rede.chamadas.length, 0, "cabecalho nao e remocao");

  local.contexto.eventoTeste = { range: respostas.getRange(2, colunaRemover - 1) };
  executarEm(local, "aoEditarPlanilha(eventoTeste);");
  assert.equal(local.rede.chamadas.length, 0, "outra coluna nao e remocao");

  local.contexto.eventoTeste = { range: respostas.getRange(2, colunaRemover) };
  executarEm(local, "aoEditarPlanilha(eventoTeste);");
  assert.equal(local.rede.chamadas.length, 1);
});

test("automatic publication is limited to once a minute with one trailing trigger", () => {
  const local = ambienteFalso();
  const evento = {
    namedValues: { [local.contexto.TITULO_ACAO]: [local.contexto.ACAO_CADASTRAR] },
  };
  local.contexto.eventoTeste = evento;
  limparRedeDe(local);

  local.setAgora(1_000_000);
  executarEm(local, "aoEnviarFormulario(eventoTeste);");
  assert.equal(local.rede.chamadas.length, 1);

  local.setAgora(1_010_000);
  executarEm(local, "aoEnviarFormulario(eventoTeste);");
  local.setAgora(1_020_000);
  executarEm(local, "aoEnviarFormulario(eventoTeste);");
  assert.equal(local.rede.chamadas.length, 1, "a rajada abriu mais de um workflow");
  assert.equal(
    local.gatilhos.filter((g) => g.funcao === "publicarPendente_" && g.tipo === "clock").length,
    1,
    "a rajada criou mais de um gatilho trailing",
  );

  local.setAgora(1_059_999);
  executarEm(local, "publicarPendente_();");
  assert.equal(local.rede.chamadas.length, 1, "gatilho antecipado furou a janela de um minuto");
  assert.equal(local.gatilhos.filter((g) => g.funcao === "publicarPendente_").length, 1);

  local.setAgora(1_060_000);
  executarEm(local, "publicarPendente_();");
  assert.equal(local.rede.chamadas.length, 2);
  assert.equal(local.gatilhos.filter((g) => g.funcao === "publicarPendente_").length, 0);
  assert.equal(local.propriedades.get(PROP.dispatchPending), "0");

  local.setAgora(1_060_001);
  executarEm(local, "aoEnviarFormulario(eventoTeste);");
  assert.equal(local.gatilhos.filter((g) => g.funcao === "publicarPendente_").length, 1);
  executarEm(local, "publicarAgora();");
  assert.equal(local.rede.chamadas.length, 3, "publicarAgora deixou de ser imediato");
  assert.equal(local.gatilhos.filter((g) => g.funcao === "publicarPendente_").length, 0);
  assert.ok(local.registro.locks.every((lock) => lock.esperou === 10000 && lock.liberou));
});

test("correction and removal submissions skip CI and send only a coalesced private sheet link", () => {
  const local = ambienteFalso();
  const segredoSubmetido = "telefone 61999999999 e detalhe privado";
  local.contexto.eventoTeste = {
    namedValues: {
      [local.contexto.TITULO_ACAO]: [local.contexto.ACAO_CORRIGIR_REMOVER],
      "Qual grupo sai ou muda? (nome exato como aparece no mapa)": ["Grupo sigiloso"],
      "O que precisa ser corrigido ou removido?": [segredoSubmetido],
    },
  };
  limparRedeDe(local);

  local.setAgora(2_000_000);
  executarEm(local, "aoEnviarFormulario(eventoTeste);");
  assert.equal(local.rede.chamadas.length, 0, "pedido privado disparou CI inutil");
  assert.equal(local.registro.emails.length, 1);
  assert.equal(local.registro.emails[0].to, "dono.efetivo@example.test");
  assert.equal(local.registro.emails[0].body, local.planilha().getUrl());
  assert.ok(!JSON.stringify(local.registro.emails).includes(segredoSubmetido));
  assert.ok(!JSON.stringify(local.registro.logs).includes(segredoSubmetido));

  local.setAgora(2_001_000);
  executarEm(local, "aoEnviarFormulario(eventoTeste);");
  assert.equal(local.registro.emails.length, 1, "rajada de pedidos virou spam");
  assert.equal(local.rede.chamadas.length, 0);

  local.propriedades.set(PROP.ownerEmail, "responsavel@example.test");
  local.setAgora(2_600_001);
  executarEm(local, "aoEnviarFormulario(eventoTeste);");
  assert.equal(local.registro.emails.length, 2);
  assert.equal(local.registro.emails[1].to, "responsavel@example.test");
  assert.equal(local.registro.emails[1].body, local.planilha().getUrl());
  assert.equal(local.propriedades.get(PROP.alertAttempts), "2");
  assert.equal(local.propriedades.get(PROP.alertError), "");
  assert.equal(local.correio.consultas, 2);
});

test("private alerts stay inside a conservative per-day MailApp budget", () => {
  const local = ambienteFalso();
  local.contexto.eventoTeste = {
    namedValues: {
      [local.contexto.TITULO_ACAO]: [local.contexto.ACAO_CORRIGIR_REMOVER],
      [local.contexto.TITULO_PEDIDO_PRIVADO]: ["conteudo que nao pode sair"],
    },
  };
  const inicio = Date.UTC(2026, 7, 25, 12, 0, 0);
  for (let i = 0; i < 30; i++) {
    local.setAgora(inicio + i * 600_001);
    executarEm(local, "aoEnviarFormulario(eventoTeste);");
  }

  assert.equal(local.contexto.LIMITE_TENTATIVAS_ALERTA_DIA, 24);
  assert.equal(local.registro.emails.length, 24);
  assert.equal(local.correio.consultas, 24);
  assert.equal(local.correio.restante, 76);
  assert.equal(local.propriedades.get(PROP.alertAttempts), "24");
  assert.equal(local.propriedades.get(PROP.alertError), "limite_diario_local");
  assert.ok(local.registro.logs.some((linha) => /continua na planilha.*limite_diario_local/i.test(linha)));
  assert.ok(!JSON.stringify(local.registro.logs).includes("conteudo que nao pode sair"));
});

test("reserved quota and MailApp failures keep the private queue diagnostic without retry storms", () => {
  const reservado = ambienteFalso();
  reservado.contexto.eventoTeste = {
    namedValues: {
      [reservado.contexto.TITULO_ACAO]: [reservado.contexto.ACAO_CORRIGIR_REMOVER],
      [reservado.contexto.TITULO_PEDIDO_PRIVADO]: ["pedido reservado sigiloso"],
    },
  };
  reservado.correio.restante = reservado.contexto.RESERVA_EMAIL_DIARIA;
  reservado.setAgora(Date.UTC(2026, 7, 25, 12, 0, 0));
  assert.doesNotThrow(() => executarEm(reservado, "aoEnviarFormulario(eventoTeste);"));
  assert.equal(reservado.registro.emails.length, 0);
  assert.equal(reservado.propriedades.get(PROP.alertError), "quota_reservada");
  assert.equal(reservado.propriedades.get(PROP.alertAttempts), "1");
  assert.match(reservado.registro.logs.at(-1), /continua na planilha.*quota_reservada/i);

  reservado.setAgora(Date.UTC(2026, 7, 25, 12, 1, 0));
  executarEm(reservado, "aoEnviarFormulario(eventoTeste);");
  assert.equal(reservado.correio.consultas, 1, "pedido agrupado consultou MailApp outra vez");
  assert.ok(!JSON.stringify(reservado.registro.logs).includes("pedido reservado sigiloso"));

  const falho = ambienteFalso();
  const textoPrivado = "SEGREDO_DA_FILA_61999999999";
  falho.respostas()._adicionar({ [falho.contexto.TITULO_PEDIDO_PRIVADO]: textoPrivado });
  const linhaAntes = falho.respostas()._linha(2);
  falho.contexto.eventoTeste = {
    namedValues: {
      [falho.contexto.TITULO_ACAO]: [falho.contexto.ACAO_CORRIGIR_REMOVER],
      [falho.contexto.TITULO_PEDIDO_PRIVADO]: [textoPrivado],
    },
  };
  falho.correio.falha = new Error(`provedor repetiu ${textoPrivado} e dono@example.test`);
  falho.setAgora(Date.UTC(2026, 7, 25, 13, 0, 0));
  assert.doesNotThrow(() => executarEm(falho, "aoEnviarFormulario(eventoTeste);"));
  assert.deepEqual(falho.respostas()._linha(2), linhaAntes, "falha de e-mail alterou a fila privada");
  assert.equal(falho.registro.emails.length, 0);
  assert.equal(falho.propriedades.get(PROP.alertError), "falha_envio");
  assert.equal(falho.propriedades.get(PROP.alertAttempts), "1");
  assert.match(falho.registro.logs.at(-1), /continua na planilha.*falha_envio/i);
  assert.ok(!JSON.stringify(falho.registro.logs).includes(textoPrivado));

  falho.setAgora(Date.UTC(2026, 7, 25, 13, 1, 0));
  executarEm(falho, "aoEnviarFormulario(eventoTeste);");
  assert.equal(falho.correio.consultas, 1, "falha entrou em tempestade de novas tentativas");
});

test("the workflow called by Apps Script exists and remains dispatchable", () => {
  const nome = ambiente.contexto.WORKFLOW;
  const yml = readFileSync(new URL(`../.github/workflows/${nome}`, import.meta.url), "utf8");
  const bloco = yml.slice(yml.indexOf("\non:"), yml.indexOf("\njobs:"));
  assert.match(bloco, /^\s{2}workflow_dispatch:\s*$/m);
  assert.ok(bloco.includes(`[${ambiente.contexto.BRANCH}]`));
});

test("the GitHub call uses Actions write, never repository_dispatch", () => {
  const local = ambienteFalso();
  limparRedeDe(local);
  executarEm(local, "publicarAgora();");
  const pedido = local.rede.chamadas[0];
  assert.match(pedido.url, /\/actions\/workflows\/ci\.yml\/dispatches$/);
  assert.ok(!/\/repos\/[^/]+\/[^/]+\/dispatches$/.test(pedido.url));
});

test("installing twice leaves exactly one form trigger and one edit trigger", () => {
  const local = ambienteFalso();
  limparRedeDe(local);
  executarEm(local, "instalarGatilhoDePublicacao();");
  executarEm(local, "instalarGatilhoDePublicacao();");
  assert.deepEqual(
    local.gatilhos.map(({ funcao, tipo }) => ({ funcao, tipo })),
    [
      { funcao: "aoEnviarFormulario", tipo: "onFormSubmit" },
      { funcao: "aoEditarPlanilha", tipo: "onEdit" },
    ],
  );
  assert.equal(local.rede.chamadas.length, 2, "cada instalacao valida o token uma vez");
});

test("trigger deduplication uses handler, event type and spreadsheet source id", () => {
  const local = ambienteFalso();
  const id = local.planilha().getId();
  const exatoEnvio = { funcao: "aoEnviarFormulario", tipo: "onFormSubmit", planilha: id };
  const exatoEdicao = { funcao: "aoEditarPlanilha", tipo: "onEdit", planilha: id };
  local.adicionarGatilho(exatoEnvio);
  local.adicionarGatilho(exatoEnvio);
  local.adicionarGatilho(exatoEdicao);
  local.adicionarGatilho(exatoEdicao);
  local.adicionarGatilho({ ...exatoEnvio, planilha: "OUTRA_PLANILHA" });
  local.adicionarGatilho({ ...exatoEnvio, tipo: "onEdit" });
  limparRedeDe(local);

  executarEm(local, "instalarGatilhoDePublicacao();");
  executarEm(local, "instalarGatilhoDePublicacao();");

  const identidade = (g, funcao, tipo, planilha) =>
    g.funcao === funcao && g.tipo === tipo && g.planilha === planilha;
  assert.equal(local.gatilhos.filter((g) => identidade(g, "aoEnviarFormulario", "onFormSubmit", id)).length, 1);
  assert.equal(local.gatilhos.filter((g) => identidade(g, "aoEditarPlanilha", "onEdit", id)).length, 1);
  assert.equal(local.gatilhos.filter((g) => identidade(g, "aoEnviarFormulario", "onFormSubmit", "OUTRA_PLANILHA")).length, 1);
  assert.equal(local.gatilhos.filter((g) => identidade(g, "aoEnviarFormulario", "onEdit", id)).length, 1);
  assert.equal(local.rede.chamadas.length, 2, "instalacao deixou de validar imediatamente");
});

test("GitHub failures explain the fix without exposing a credential", () => {
  for (const codigo of [401, 403, 404, 422, 500]) {
    limparRede();
    ambiente.rede.responder = () => ({ codigo, texto: `segredo=${SEGREDO_FEED}` });
    assert.throws(() => executar("publicarAgora();"), (erro) => {
      assert.ok(!erro.message.includes(SEGREDO_FEED));
      if (codigo === 403) assert.match(erro.message, /Actions|permissao/i);
      return true;
    });
  }
  limparRede();
});

test("missing GitHub token fails before any network call", () => {
  ambiente.propriedades.set(PROP.githubToken, "   ");
  limparRede();
  assert.throws(() => executar("publicarAgora();"), /Propriedades do script/);
  assert.equal(ambiente.rede.chamadas.length, 0);
  ambiente.propriedades.set(PROP.githubToken, " token_github_de_teste\n");
});

test("no credential-shaped value is committed in the Apps Script source", () => {
  const pareceGitHub = /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/;
  assert.ok(!pareceGitHub.test(FONTE));
  assert.ok(FONTE.includes("PropertiesService"));
});

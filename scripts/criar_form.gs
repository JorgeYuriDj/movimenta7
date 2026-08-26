/**
 * movimenta7 — creates the activity registration Google Form and its private,
 * linked response spreadsheet.
 * Run once in script.google.com (function: criarFormMovimenta7). Owner: Jorge Yuri.
 * All user-facing strings are pt-BR; code is English (project convention).
 *
 * ADR-0006 (25/08/2026) rewrote this form around two owner decisions:
 *
 * 1. PERSONAL DATA IS NOT REQUESTED OR PUBLISHED. The old form asked for the
 *    submitter's name and WhatsApp "privately", plus the name of the physical
 *    education professional. All three questions are gone. Free-text answers
 *    can still contain data a person types against the warning, so the form is
 *    honest about what it asks and the publication pipeline independently
 *    blocks personal data before anything reaches the map.
 *
 * 2. THE FORM BRANCHES INTO TWO PAGES, and that is a safety mechanism, not a
 *    convenience. Publication is automatic now, so a removal request typed into
 *    the registration fields would come back as a NEW pin. Removal requests
 *    live on their own page, in their own columns, which the private feed never
 *    serializes. A removal literally cannot become a registration.
 *
 * The two link questions replace the old free "contato": a link is the one
 * answer that can send a visitor somewhere harmful, and nobody reviews it
 * before it goes live, so it is restricted to social profiles and map links —
 * enforced by the host allowlist in js/util.js, not by this form.
 *
 * 3. THE RESPONSE SHEET STAYS PRIVATE. GitHub Actions reads a narrow projection
 *    through the authenticated Web App endpoint below. No spreadsheet tab needs
 *    to be published on the web, and private correction/removal text never
 *    crosses that endpoint.
 *
 * Running this function again creates a NEW form and a NEW spreadsheet and
 * never touches the previous ones (REGRA ZERO — nothing is ever deleted).
 */

/**
 * Question title -> column name in moderacao/aprovados.json.
 * Single source of truth: the questions and the private feed projection are
 * generated from this object. The column names must stay equal to COLUNAS in
 * scripts/ingerir_csv.mjs, which aborts on any column it does not recognise.
 */
var TITULOS = {
  grupo: 'Nome do grupo',
  organizacao: 'Igreja ou organização responsável',
  regiao: 'Região administrativa (DF)',
  modalidades: 'Modalidade(s)',
  dias: 'Dia(s) da semana',
  horario: 'Horário de início (ex.: 06h30)',
  local: 'Local do encontro (ponto público — parque, quadra, portão da igreja)',
  rede_social: '@ do Instagram ou link da rede social da igreja/grupo',
  mapa: 'Link do Google Maps do local do encontro',
  orientacao_profissional: 'Tipo de atividade',
  custo: 'Custo',
  publico: 'Aberta a quem?',
};

/** Public feed column order. Same order as ingerir_csv.mjs. */
var COLUNAS = [
  'grupo', 'organizacao', 'regiao', 'modalidades', 'dias', 'horario',
  'local', 'rede_social', 'mapa', 'orientacao_profissional', 'custo', 'publico',
];

/**
 * Shortcuts for the most common activities. The native "Other" option stays
 * enabled separately, so the list never becomes a catalogue that excludes a
 * sport: the responder can write Jiu-jítsu, Muay Thai, Tênis, Xadrez etc. and
 * that exact public activity name travels through the same sanitised field.
 */
var MODALIDADES_COMUNS = [
  'Corrida', 'Caminhada', 'Ciclismo', 'Vôlei', 'Futebol', 'Futsal',
  'Basquete', 'Handebol', 'Funcional', 'Musculação', 'Dança',
  'Lutas / artes marciais', 'Trilhas', 'Natação', 'Skate / patins', 'Yoga',
];

var COL_REMOVER = 'remover';
var TITULO_CONSENTIMENTO = 'Consentimento (LGPD)';
var TITULO_ACAO = 'O que você quer fazer?';
var ACAO_CADASTRAR = 'Cadastrar uma atividade nova';
var ACAO_CORRIGIR_REMOVER = 'Corrigir ou REMOVER um cadastro que já está no mapa';
var TITULO_PAGINA_CADASTRO = 'Dados da atividade';
var TITULO_PAGINA_REMOCAO = 'Pedido de correção ou remoção';
var TITULO_PEDIDO_PRIVADO = 'O que precisa ser corrigido ou removido?';
var TEXTO_CONSENTIMENTO =
  'LI e CONCORDO: o cadastro da atividade pode ser publicado; pedidos de correção ou remoção ficam privados';
var AJUDA_REDE_SOCIAL =
  'Ex.: @iasd.aguasclaras — ou o endereço do perfil no Instagram, Facebook, ' +
  'YouTube ou Strava. NÃO coloque telefone nem link de grupo de WhatsApp: o site recusa. ' +
  'Informe um perfil público da igreja ou do grupo.';
var AJUDA_MAPA =
  'No app do Google Maps: procure o lugar, toque em Compartilhar e cole o ' +
  'endereço aqui (pode começar com maps.app.goo.gl/ ou share.google/). Use o local do ENCONTRO ou o da ' +
  'igreja — nunca a casa de alguém. Este link é obrigatório para publicar o ponto certo.';
var AJUDA_PEDIDO_PRIVADO = 'Se for correção, escreva o dado certo. O pedido fica privado.';

function descricaoDoFormulario_() {
  return 'Cadastre a atividade física do seu grupo/igreja no movimenta7 — a rede de atividades ' +
    'da comunidade adventista do DF, aberta a toda Brasília. Leva ~2 minutos.\n\n' +
    'ATENÇÃO: os dados do ramo CADASTRO vão para o mapa público automaticamente, normalmente ' +
    'em cerca de 1 minuto. Pedidos de correção ou remoção ficam privados: NÃO PUBLICAMOS ' +
    'essas respostas.\n\n' +
    'NÃO SOLICITAMOS DADOS PESSOAIS (LGPD): nem seu nome, nem telefone, nem e-mail. ' +
    'O cadastro público é sobre a ATIVIDADE e sobre a IGREJA/ORGANIZAÇÃO. NÃO escreva ' +
    'telefone, endereço de casa nem o nome de ninguém em nenhum campo. A checagem automática ' +
    'bloqueia telefone, e-mail, CPF/CNPJ e links estranhos antes da publicação; um cadastro ' +
    'recusado simplesmente não aparece no mapa. Não solicite nem informe dados de menores de ' +
    'idade. Para corrigir ou remover, volte a este mesmo formulário e escolha a segunda opção. ' +
    'Base legal: consentimento (art. 7º, I, LGPD). Agente de pequeno porte — Res. CD/ANPD 2/2022.';
}

function confirmacaoDoFormulario_() {
  return 'Resposta recebida. Cadastros válidos entram no mapa automaticamente; pedidos de ' +
    'correção ou remoção ficam privados. Acompanhe o mapa: ' +
    'https://jorgeyuridj.github.io/movimenta7/#secao-mapa';
}

function configurarModalidades_(item) {
  return item.setRequired(true)
    .setChoiceValues(MODALIDADES_COMUNS)
    .showOtherOption(true);
}

function criarFormMovimenta7() {
  var form = FormApp.create('movimenta7 — Cadastro de atividade física');
  form.setDescription(descricaoDoFormulario_());
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setConfirmationMessage(confirmacaoDoFormulario_());

  form.addMultipleChoiceItem().setTitle(TITULO_CONSENTIMENTO).setRequired(true)
    .setChoiceValues([TEXTO_CONSENTIMENTO]);

  // Comes last on page 1 so the branch is decided right before the page turns.
  var acao = form.addMultipleChoiceItem().setTitle(TITULO_ACAO).setRequired(true);

  // ---------- página 2: cadastro (as colunas que viram pin) ----------
  var pgCadastro = form.addPageBreakItem().setTitle(TITULO_PAGINA_CADASTRO);

  form.addTextItem().setTitle(TITULOS.grupo).setRequired(true)
    .setHelpText('Ex.: Corredores da IASD Águas Claras. Nome do GRUPO, não o seu.');
  form.addTextItem().setTitle(TITULOS.organizacao).setRequired(true);

  form.addListItem().setTitle(TITULOS.regiao).setRequired(true).setChoiceValues([
    'Águas Claras','Arniqueira','Brazlândia','Candangolândia','Ceilândia','Cruzeiro',
    'Fercal','Gama','Guará','Itapoã','Jardim Botânico','Lago Norte','Lago Sul',
    'Núcleo Bandeirante','Paranoá','Park Way','Planaltina','Plano Piloto','Recanto das Emas',
    'Riacho Fundo','Riacho Fundo II','Samambaia','Santa Maria','São Sebastião','SCIA/Estrutural',
    'SIA','Sobradinho','Sobradinho II','Sol Nascente/Pôr do Sol','Sudoeste/Octogonal',
    'Taguatinga','Varjão','Vicente Pires','Arapoanga','Água Quente','Entorno (fora do DF)']);

  configurarModalidades_(form.addCheckboxItem().setTitle(TITULOS.modalidades));

  form.addCheckboxItem().setTitle(TITULOS.dias).setRequired(true).setChoiceValues([
    'Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado (após o pôr do sol)']);
  form.addTextItem().setTitle(TITULOS.horario).setRequired(true);

  form.addTextItem().setTitle(TITULOS.local)
    .setRequired(true)
    .setHelpText('Nunca informe endereço de residência.');

  // The professional's NAME and CREF number used to be asked here. Both identify
  // a person, so both are gone; what the visitor actually needs to know is
  // whether someone qualified is running the session, and that is this answer.
  form.addMultipleChoiceItem().setTitle(TITULOS.orientacao_profissional).setRequired(true).setChoiceValues([
    'Encontro social de prática livre',
    'Atividade orientada por profissional de Educação Física']);

  form.addCheckboxItem().setTitle(TITULOS.publico).setChoiceValues([
    'Aberta a toda a comunidade (não precisa ser adventista)','Iniciantes bem-vindos',
    'Famílias com crianças (acompanhadas dos responsáveis)','Acessível para PCD','Idosos']);
  form.addMultipleChoiceItem().setTitle(TITULOS.custo).setRequired(true)
    .setChoiceValues(['Gratuito','Pago']);

  form.addTextItem().setTitle(TITULOS.rede_social)
    .setRequired(true)
    .setHelpText(AJUDA_REDE_SOCIAL);
  form.addTextItem().setTitle(TITULOS.mapa)
    .setRequired(true)
    .setHelpText(AJUDA_MAPA);

  // ---------- página 3: correção/remoção (colunas que o site NUNCA lê) ----------
  var pgRemocao = form.addPageBreakItem().setTitle(TITULO_PAGINA_REMOCAO);
  form.addTextItem().setTitle('Qual grupo sai ou muda? (nome exato como aparece no mapa)')
    .setRequired(true);
  form.addTextItem().setTitle('Região administrativa desse grupo').setRequired(true);
  form.addParagraphTextItem().setTitle(TITULO_PEDIDO_PRIVADO)
    .setRequired(true)
    .setHelpText(AJUDA_PEDIDO_PRIVADO);

  // Navigation is what keeps the two paths apart. Without it the person who
  // finishes the registration page falls straight into the removal page and is
  // asked to justify removing the group they just created.
  acao.setChoices([
    acao.createChoice(ACAO_CADASTRAR, pgCadastro),
    acao.createChoice(ACAO_CORRIGIR_REMOVER, pgRemocao),
  ]);

  // ⚠️ setGoToPage governs the page BEFORE the break it is called on, not the
  // page that starts at it: "sets the type of page navigation that occurs after
  // completing the page before this page break" (Apps Script reference,
  // PageBreakItem). So the line that makes the REGISTRATION page submit has to
  // hang on pgRemocao — the break that follows it.
  //
  // This was wrong in the form the owner published on 25/08: it read
  // pgCadastro.setGoToPage(SUBMIT), which set "after the consent page, submit"
  // — harmless only because the branching choice overrides it. The registration
  // page kept its default linear progression and dumped every person who had
  // just described their group onto the removal page, where three required
  // questions asked them to justify taking it back down. He filled the form,
  // met that page, and the response was never recorded: the map stayed empty
  // with no error anywhere, because nothing had failed.
  pgRemocao.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  var ss = SpreadsheetApp.create('movimenta7 — respostas');
  PropertiesService.getScriptProperties().setProperty(PROP_PLANILHA_ID, ss.getId());
  var abaPadrao = ss.getSheets()[0].getSheetName();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // setDestination writes the response sheet through another service, so the
  // handle we already hold does not see it yet. Without flush + reopen,
  // getSheets() below returns only the empty tab the file was born with.
  SpreadsheetApp.flush();
  ss = SpreadsheetApp.openById(ss.getId());

  var respostas = acharAbaDeRespostas(ss, abaPadrao);
  if (respostas) {
    acrescentarColunaRemover(respostas);
  }

  Logger.log('Form (editar): ' + form.getEditUrl());
  Logger.log('Form (link para compartilhar): ' + form.getPublishedUrl());
  Logger.log('Planilha de respostas: ' + ss.getUrl());
  if (respostas) {
    Logger.log('OK: aba de respostas encontrada ("' + respostas.getSheetName() + '")');
    Logger.log('OK: coluna "remover" criada; a planilha continua privada.');
    Logger.log('AGORA: rode `configurarFeedPrivado`, implante o App da Web e depois rode');
    Logger.log('       `instalarGatilhoDePublicacao` para automatizar cadastro e remocao.');
  } else {
    Logger.log('ATENCAO: nao achei a aba de respostas e a coluna "remover" nao foi criada.');
    Logger.log('         Rode esta mesma funcao de novo — nada e apagado. Se falhar duas vezes, me avise.');
  }
}

/**
 * The response sheet is found by its CONTENT, not by its name: Google names it
 * after the account's locale ("Respostas ao formulário 1" / "Form Responses 1")
 * and appends a number when one file receives more than one form. The header row
 * is the one thing we control, so that is what we look for.
 */
function acharAbaDeRespostas(ss, nomeDaAbaPadrao) {
  var abas = ss.getSheets();
  for (var i = 0; i < abas.length; i++) {
    var largura = abas[i].getLastColumn();
    if (largura < 1) continue;
    var cabecalho = abas[i].getRange(1, 1, 1, largura).getValues()[0];
    for (var c = 0; c < cabecalho.length; c++) {
      if (String(cabecalho[c]).trim() === TITULOS.grupo) return abas[i];
    }
  }
  // Fallback: any tab that is not the empty one the file was born with — but it
  // must already have a header row, or `remover` would land in column 1 and
  // overwrite an answer.
  for (var j = 0; j < abas.length; j++) {
    if (abas[j].getSheetName() !== nomeDaAbaPadrao && abas[j].getLastColumn() > 1) return abas[j];
  }
  return null;
}

/**
 * The owner's emergency brake: tick the box and the group leaves the map on the
 * next successful publication. ADR-0006 removed the approval queue, so this is the only
 * control left — it has to exist before the first registration arrives, not
 * after the first problem.
 */
function acrescentarColunaRemover(aba) {
  var largura = aba.getLastColumn();
  var cabecalho = aba.getRange(1, 1, 1, largura).getValues()[0];
  for (var i = 0; i < cabecalho.length; i++) {
    if (String(cabecalho[i]).trim() === COL_REMOVER) return; // já existe: nada a fazer
  }
  var col = largura + 1;
  aba.getRange(1, col).setValue(COL_REMOVER);
  aba.getRange(1, col).setNote(
    'Marque para tirar este grupo do mapa. A publicação é pedida imediatamente; o cron é o plano B.\n' +
    'Desmarque para ele voltar. Nada é apagado da planilha.');
  // requireCheckbox() only VALIDATES the cell. insertCheckboxes() would stamp
  // FALSE into every empty row — a thousand rows of noise in the one file the
  // owner has to be able to read at a glance.
  var linhas = Math.max(aba.getMaxRows() - 1, 1);
  aba.getRange(2, col, linhas, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireCheckbox().build());
}

/* ===========================================================================
 * INSTANT PUBLICATION — the trigger that takes the cron's queue out of the loop
 * ===========================================================================
 *
 * Without this, the site only learns about a registration when GitHub's cron
 * fires. That cron ASKS for every 10 minutes and GitHub delivers something else
 * entirely: measured on 25/08/2026, four consecutive rounds took 40, 47, 43 and
 * 55 minutes, because scheduled runs on a public repository sit in a
 * low-priority queue. A manual run the same afternoon put the pin on the map in
 * 40 seconds — so the wait is the queue's, not ours, and no amount of tuning on
 * this side shortens it. The form has to speak up instead of the site polling.
 *
 * WHY workflow_dispatch AND NOT repository_dispatch. Both APIs start the same
 * workflow, but a fine-grained token needs very different permissions for them
 * (checked against GitHub's "Permissions required for fine-grained personal
 * access tokens", 25/08/2026):
 *     repository_dispatch -> Contents: WRITE
 *     workflow_dispatch   -> Actions: WRITE
 * Contents: write is permission to PUSH COMMITS, and on this project the
 * repository IS the website — a leaked token of that kind publishes arbitrary
 * repository content. Actions: write is narrower, but it is still powerful: it
 * can dispatch workflows on refs and manage workflows, runs, logs, artifacts and
 * caches. This repository reduces that impact by publishing only main and by
 * putting deployment behind the github-pages Environment; neither control makes
 * a leaked token harmless. The narrower door was already open: ci.yml has
 * carried `workflow_dispatch:` since the beginning, so nothing in the workflow
 * had to be widened to make this work.
 *
 * WHERE THE TOKEN LIVES: in Script Properties (Apps Script > Configurações do
 * projeto > Propriedades do script), inside the owner's Google account. NEVER in
 * the repository, which is public (CLAUDE.md, rule 11). That rule is about keys
 * in the repo and in the visitor's browser; a secret held in the owner's own
 * account, which only he opens, is exactly where this one belongs.
 *
 * THE CRON STAYS ON, DELIBERATELY. Google disables triggers that fail too often,
 * a fine-grained token expires on its due date, and both happen quietly. If the
 * trigger dies, the scheduled workflow remains a fallback. GitHub may delay or
 * drop scheduled runs and gives no maximum publication time, so this is graceful
 * degradation rather than a delivery guarantee. Belt and braces, not redundancy
 * for its own sake.
 */

/** The site's repository. Only changes if the project moves accounts. */
var REPO_PADRAO = 'JorgeYuriDj/movimenta7';
/** Workflow file that publishes the site (.github/workflows/ci.yml). */
var WORKFLOW = 'ci.yml';
/** Branch GitHub Pages publishes from. */
var BRANCH = 'main';
/** Trigger handlers; names are also used to identify and deduplicate triggers. */
var FUNCAO_DO_GATILHO = 'aoEnviarFormulario';
var FUNCAO_GATILHO_EDICAO = 'aoEditarPlanilha';
var FUNCAO_GATILHO_PENDENTE = 'publicarPendente_';

var PROP_TOKEN = 'GITHUB_TOKEN';
var PROP_REPO = 'GITHUB_REPO';
var PROP_PLANILHA_ID = 'MOV7_SPREADSHEET_ID';
var PROP_FEED_TOKEN = 'MOV7_FEED_TOKEN';
var PROP_OWNER_EMAIL = 'MOV7_OWNER_EMAIL';
var PROP_ULTIMO_DISPARO = 'MOV7_LAST_DISPATCH_AT';
var PROP_PUBLICACAO_PENDENTE = 'MOV7_DISPATCH_PENDING';
var PROP_ULTIMO_ALERTA = 'MOV7_LAST_REMOVAL_ALERT_AT';
var PROP_DIA_ALERTA = 'MOV7_REMOVAL_ALERT_DAY';
var PROP_TENTATIVAS_ALERTA = 'MOV7_REMOVAL_ALERT_ATTEMPTS';
var PROP_ERRO_ALERTA = 'MOV7_LAST_REMOVAL_ALERT_ERROR';
var JANELA_DISPARO_MS = 60 * 1000;
var JANELA_ALERTA_MS = 10 * 60 * 1000;
var LIMITE_TENTATIVAS_ALERTA_DIA = 24;
var RESERVA_EMAIL_DIARIA = 20;
var FEED_SCHEMA_VERSION = 1;

/**
 * Reads a Script Property, trimmed.
 *
 * The trim is not cosmetic: pasting a token into that box carries a trailing
 * newline often enough that it is a known scar in this owner's notes, and a
 * token with "\n" on the end produces a 401 whose message says nothing about
 * whitespace.
 */
function propriedade_(nome, padrao) {
  var v = PropertiesService.getScriptProperties().getProperty(nome);
  v = v ? String(v).trim() : '';
  return v || padrao || '';
}

/* ===========================================================================
 * PRIVATE FEED — the response spreadsheet never has to be "published on web"
 * ===========================================================================
 *
 * GitHub reads this Web App with a secret in the POST body. The endpoint
 * projects columns BY QUESTION TITLE from the private response sheet; removal
 * requests and any future private column are never serialized. Community data
 * still goes through the Node allowlist/PII gates before it reaches Pages.
 */

function respostaJson_(doc) {
  return ContentService.createTextOutput(JSON.stringify(doc))
    .setMimeType(ContentService.MimeType.JSON);
}

function tokenIgual_(recebido, esperado) {
  recebido = String(recebido || '');
  esperado = String(esperado || '');
  var diferenca = recebido.length ^ esperado.length;
  var maior = Math.max(recebido.length, esperado.length);
  for (var i = 0; i < maior; i++) {
    diferenca |= (recebido.charCodeAt(i) || 0) ^ (esperado.charCodeAt(i) || 0);
  }
  return diferenca === 0 && esperado.length >= 32;
}

function planilhaConfigurada_() {
  var ativa = SpreadsheetApp.getActive();
  if (ativa) return ativa;
  var id = propriedade_(PROP_PLANILHA_ID, '');
  if (!id) throw new Error('Falta a propriedade ' + PROP_PLANILHA_ID + '. Rode configurarFeedPrivado.');
  return SpreadsheetApp.openById(id);
}

function acharAbaDeRespostasEstrita_(ss) {
  var abas = ss.getSheets();
  for (var i = 0; i < abas.length; i++) {
    var largura = abas[i].getLastColumn();
    if (largura < 1) continue;
    var cabecalho = abas[i].getRange(1, 1, 1, largura).getDisplayValues()[0];
    for (var c = 0; c < cabecalho.length; c++) {
      if (String(cabecalho[c]).trim() === TITULOS.grupo) return abas[i];
    }
  }
  return null;
}

function montarFeedPrivado_() {
  var ss = planilhaConfigurada_();
  var respostas = acharAbaDeRespostasEstrita_(ss);
  if (!respostas) throw new Error('Nao achei a aba de respostas pelo cabecalho do grupo.');

  var largura = respostas.getLastColumn();
  var cabecalho = respostas.getRange(1, 1, 1, largura).getDisplayValues()[0];
  var indice = {};
  for (var i = 0; i < cabecalho.length; i++) indice[String(cabecalho[i]).trim()] = i;

  var nomes = COLUNAS.concat([COL_REMOVER]);
  var titulos = [];
  for (var n = 0; n < COLUNAS.length; n++) titulos.push(TITULOS[COLUNAS[n]]);
  titulos.push(COL_REMOVER);
  for (var t = 0; t < titulos.length; t++) {
    if (indice[titulos[t]] === undefined) {
      throw new Error('Falta a coluna obrigatoria "' + titulos[t] + '" na planilha.');
    }
  }

  var ultima = respostas.getLastRow();
  var linhas = [];
  if (ultima > 1) {
    var valores = respostas.getRange(2, 1, ultima - 1, largura).getDisplayValues();
    var colGrupo = indice[TITULOS.grupo];
    for (var r = 0; r < valores.length; r++) {
      if (!String(valores[r][colGrupo] || '').trim()) continue; // ramo corrigir/remover
      var saida = [];
      for (var j = 0; j < titulos.length; j++) saida.push(valores[r][indice[titulos[j]]] || '');
      linhas.push(saida);
      if (linhas.length > 5000) throw new Error('Mais de 5000 cadastros na origem — revise a planilha.');
    }
  }
  return {
    ok: true,
    schema_version: FEED_SCHEMA_VERSION,
    gerado_em: new Date().toISOString(),
    colunas: nomes,
    linhas: linhas,
  };
}

/** Public health check: intentionally contains no spreadsheet data. */
function doGet() {
  return respostaJson_({ ok: true, servico: 'movimenta7-feed', schema_version: FEED_SCHEMA_VERSION });
}

/** Authenticated endpoint used only by GitHub Actions. */
function doPost(e) {
  try {
    var p = e && e.parameter ? e.parameter : {};
    if (p.acao !== 'feed' || !tokenIgual_(p.token, propriedade_(PROP_FEED_TOKEN, ''))) {
      return respostaJson_({ ok: false, erro: 'acesso negado' });
    }
    return respostaJson_(montarFeedPrivado_());
  } catch (err) {
    // Never echo a cell or secret. GitHub's public log only needs the class.
    return respostaJson_({ ok: false, erro: 'feed indisponivel' });
  }
}

/**
 * Migrates the already-published form by stable question title and item type.
 * Exact matching avoids rewriting an unrelated field that happens to contain
 * words such as "mapa", "social" or "remover" in its help text.
 */
function migrarCopyDoFormulario_(form) {
  form.setDescription(descricaoDoFormulario_());
  form.setConfirmationMessage(confirmacaoDoFormulario_());
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  // New Forms expose this switch separately from accepting responses. Keep the
  // public responder link published, without reopening a form the owner may
  // have intentionally paused.
  if (typeof form.setPublished === 'function') form.setPublished(true);

  var textos = form.getItems(FormApp.ItemType.TEXT);
  for (var i = 0; i < textos.length; i++) {
    var tituloTexto = textos[i].getTitle();
    if (tituloTexto === TITULOS.rede_social) {
      textos[i].asTextItem().setRequired(true).setHelpText(AJUDA_REDE_SOCIAL);
    } else if (tituloTexto === TITULOS.mapa) {
      textos[i].asTextItem().setRequired(true).setHelpText(AJUDA_MAPA);
    }
  }

  var escolhas = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE);
  for (var j = 0; j < escolhas.length; j++) {
    if (escolhas[j].getTitle() === TITULO_CONSENTIMENTO) {
      escolhas[j].asMultipleChoiceItem().setRequired(true)
        .setChoiceValues([TEXTO_CONSENTIMENTO]);
    }
  }

  var caixas = form.getItems(FormApp.ItemType.CHECKBOX);
  for (var c = 0; c < caixas.length; c++) {
    if (caixas[c].getTitle() === TITULOS.modalidades) {
      configurarModalidades_(caixas[c].asCheckboxItem());
    }
  }

  var paragrafos = form.getItems(FormApp.ItemType.PARAGRAPH_TEXT);
  for (var p = 0; p < paragrafos.length; p++) {
    if (paragrafos[p].getTitle() === TITULO_PEDIDO_PRIVADO) {
      paragrafos[p].asParagraphTextItem().setRequired(true)
        .setHelpText(AJUDA_PEDIDO_PRIVADO);
    }
  }

  // Require both known sections before changing navigation. This repairs the
  // old form where SUBMIT was attached to the cadastro break (the break BEFORE
  // the registration page) and the registration page fell into removal.
  var paginas = form.getItems(FormApp.ItemType.PAGE_BREAK);
  var paginaCadastro = null;
  var paginaRemocao = null;
  for (var b = 0; b < paginas.length; b++) {
    if (paginas[b].getTitle() === TITULO_PAGINA_CADASTRO) paginaCadastro = paginas[b].asPageBreakItem();
    if (paginas[b].getTitle() === TITULO_PAGINA_REMOCAO) paginaRemocao = paginas[b].asPageBreakItem();
  }
  if (paginaCadastro && paginaRemocao) {
    paginaCadastro.setGoToPage(FormApp.PageNavigationType.CONTINUE);
    paginaRemocao.setGoToPage(FormApp.PageNavigationType.SUBMIT);
  }
}

/** One-time setup. Safe to run again: existing secrets are never replaced. */
function configurarFeedPrivado() {
  var token = propriedade_(PROP_FEED_TOKEN, '');
  if (token.length < 32) {
    throw new Error(
      'Antes de configurar o feed, crie a propriedade ' + PROP_FEED_TOKEN +
      ' com um segredo de pelo menos 32 caracteres. O script nao gera nem exibe esse valor.');
  }

  // Works both in a bound script (active spreadsheet) and in the standalone
  // project that created the form (stored spreadsheet id).
  var ss = planilhaConfigurada_();
  var props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_PLANILHA_ID, ss.getId());
  var respostas = acharAbaDeRespostasEstrita_(ss);
  if (!respostas) throw new Error('Nao achei a aba de respostas pelo cabecalho do grupo.');
  acrescentarColunaRemover(respostas);

  var formUrl = ss.getFormUrl();
  if (formUrl) {
    var form = FormApp.openByUrl(formUrl);
    migrarCopyDoFormulario_(form);
  }

  Logger.log('OK: planilha privada configurada; mapa e rede social agora sao obrigatorios.');
  Logger.log('OK: ' + PROP_FEED_TOKEN + ' ja esta configurado; o valor nao sera exibido.');
  var url = ScriptApp.getService().getUrl();
  if (url) Logger.log('URL do App da Web (configure como PLANILHA_FEED_URL no GitHub): ' + url);
  else Logger.log('AGORA: Implantar > Nova implantacao > App da Web > executar como voce > qualquer pessoa.');
}

/**
 * Asks GitHub to run the publication workflow now. Returns true, or throws with
 * a message written for someone who is not a programmer.
 *
 * 204 (No Content) is this endpoint's success: it accepts the request and
 * answers with an empty body. Treating "no body" as failure would make every
 * successful publication look broken.
 *
 * No message below ever prints the token or the response body. The body of a
 * GitHub error can echo request headers, and this text ends up in a log the
 * owner may well paste into a chat.
 */
function dispararPublicacao_() {
  var token = propriedade_(PROP_TOKEN, '');
  if (!token) {
    throw new Error(
      'Falta o token do GitHub. Va em Apps Script > Configuracoes do projeto > ' +
      'Propriedades do script > Adicionar propriedade, com o nome ' + PROP_TOKEN +
      ' e o valor sendo o token que voce criou no GitHub. ' +
      'Passo a passo em portugues: moderacao/COMO_LIGAR_A_PLANILHA.md, Parte 4.');
  }
  var repo = propriedade_(PROP_REPO, REPO_PADRAO);
  var resp = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + repo + '/actions/workflows/' + WORKFLOW + '/dispatches',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      payload: JSON.stringify({ ref: BRANCH }),
      muteHttpExceptions: true,
    });

  var codigo = resp.getResponseCode();
  if (codigo === 204) return true;
  throw new Error(explicarFalha_(codigo, repo));
}

/**
 * Turns an HTTP status into the one sentence that tells the owner what to fix.
 *
 * This exists because the alternative — "Exception: request failed with 403" in
 * an Apps Script execution log — is a dead end for someone who is not a
 * programmer, and the person who has to read it is exactly that person.
 */
function explicarFalha_(codigo, repo) {
  if (codigo === 401) {
    return 'O GitHub recusou o token (401). Ele expirou, foi apagado, ou foi colado ' +
      'incompleto. Crie outro e troque o valor de ' + PROP_TOKEN + ' nas Propriedades do script.';
  }
  if (codigo === 403) {
    return 'O token existe mas nao tem permissao (403). Ele precisa de "Actions: ' +
      'Read and write" no repositorio ' + repo + '. Refaca o token com essa permissao.';
  }
  if (codigo === 404) {
    return 'O GitHub nao achou o repositorio "' + repo + '" ou o arquivo ' + WORKFLOW +
      ' (404). Confira o nome na propriedade ' + PROP_REPO + ' — e confirme que o token ' +
      'foi criado COM ACESSO a esse repositorio (sem acesso, o GitHub responde 404, nao 403).';
  }
  if (codigo === 422) {
    return 'O GitHub achou o repositorio mas recusou o pedido (422). Quase sempre e o ' +
      'branch: o site publica de "' + BRANCH + '". Se alguem removeu "workflow_dispatch" ' +
      'do arquivo .github/workflows/' + WORKFLOW + ', tambem da 422.';
  }
  return 'O GitHub respondeu ' + codigo + ' e a publicacao nao foi pedida. ' +
    'O cron continua como plano B, mas o GitHub nao garante o horario dessa rodada.';
}

/**
 * THE TRIGGER ITSELF. Google calls this each time a response reaches the sheet.
 *
 * It is allowed to throw: a failure here sends the owner Google's "your script
 * failed" e-mail, and in a project whose worst failure mode is silence that
 * e-mail is a feature. Nothing the person who filled the form sees depends on
 * it — the answer is already recorded in the sheet before this runs, and the
 * cron publishes it either way.
 */
function valorNomeado_(e, titulo) {
  if (!e || !e.namedValues || !Object.prototype.hasOwnProperty.call(e.namedValues, titulo)) return '';
  var valor = e.namedValues[titulo];
  if (Object.prototype.toString.call(valor) === '[object Array]') valor = valor[0];
  return String(valor || '').trim();
}

/** The private branch must alert the owner, but must never start a site build. */
function ehPedidoCorrecaoRemocao_(e) {
  return valorNomeado_(e, TITULO_ACAO) === ACAO_CORRIGIR_REMOVER;
}

function emailDoProprietario_() {
  var configurado = propriedade_(PROP_OWNER_EMAIL, '');
  if (configurado) return configurado;
  var usuario = Session.getEffectiveUser();
  return usuario ? String(usuario.getEmail() || '').trim() : '';
}

/**
 * Sends a sanitized correction/removal alert within a conservative daily
 * budget. The response already lives in the private sheet before this runs.
 * Every failure therefore becomes a safe diagnostic property and a cooldown,
 * never an exception storm that could disable the form trigger. The only value
 * copied into the body is the private spreadsheet URL; submitted text is never
 * read here, let alone forwarded by e-mail.
 */
function alertarPedidoPrivado_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var agora = agoraMs_();
    var ultimo = Number(propriedade_(PROP_ULTIMO_ALERTA, '0')) || 0;
    if (ultimo && Math.max(0, agora - ultimo) < JANELA_ALERTA_MS) return 'agrupado';

    var props = PropertiesService.getScriptProperties();
    // Written before touching MailApp: missing authorization, quota exhaustion
    // and transient service failures all receive the same anti-storm cooldown.
    props.setProperty(PROP_ULTIMO_ALERTA, String(agora));

    var dia = new Date(agora).toISOString().slice(0, 10);
    var diaAnterior = propriedade_(PROP_DIA_ALERTA, '');
    var tentativas = Number(propriedade_(PROP_TENTATIVAS_ALERTA, '0')) || 0;
    if (diaAnterior !== dia) {
      tentativas = 0;
      props.setProperty(PROP_DIA_ALERTA, dia);
      props.setProperty(PROP_TENTATIVAS_ALERTA, '0');
    }
    if (tentativas >= LIMITE_TENTATIVAS_ALERTA_DIA) {
      props.setProperty(PROP_ERRO_ALERTA, 'limite_diario_local');
      return 'limite_diario_local';
    }
    tentativas++;
    props.setProperty(PROP_TENTATIVAS_ALERTA, String(tentativas));

    try {
      var destinatario = emailDoProprietario_();
      if (!destinatario) {
        props.setProperty(PROP_ERRO_ALERTA, 'sem_destinatario');
        return 'sem_destinatario';
      }
      var url = planilhaConfigurada_().getUrl();
      var restante = Number(MailApp.getRemainingDailyQuota());
      if (!isFinite(restante) || restante <= RESERVA_EMAIL_DIARIA) {
        props.setProperty(PROP_ERRO_ALERTA, 'quota_reservada');
        return 'quota_reservada';
      }
      MailApp.sendEmail({
        to: destinatario,
        subject: 'movimenta7: pedido privado de correcao ou remocao',
        body: url,
      });
      props.setProperty(PROP_ERRO_ALERTA, '');
      return 'enviado';
    } catch (err) {
      // Do not persist or log the provider's message: it can contain addresses.
      props.setProperty(PROP_ERRO_ALERTA, 'falha_envio');
      return 'falha_envio';
    }
  } finally {
    lock.releaseLock();
  }
}

function origemDoGatilho_(gatilho) {
  try {
    return String(gatilho.getTriggerSourceId() || '');
  } catch (err) {
    return '';
  }
}

/** Trigger identity is handler + event type + source id, never just its name. */
function gatilhoCorresponde_(gatilho, funcao, tipo, origem) {
  return gatilho.getHandlerFunction() === funcao &&
    gatilho.getEventType() === tipo &&
    origemDoGatilho_(gatilho) === String(origem || '');
}

/** Keeps the first exact trigger and deletes only exact duplicates. */
function deduplicarGatilho_(funcao, tipo, origem) {
  var gatilhos = ScriptApp.getProjectTriggers();
  var primeiro = null;
  for (var i = 0; i < gatilhos.length; i++) {
    if (!gatilhoCorresponde_(gatilhos[i], funcao, tipo, origem)) continue;
    if (!primeiro) primeiro = gatilhos[i];
    else ScriptApp.deleteTrigger(gatilhos[i]);
  }
  return primeiro;
}

function removerGatilhosPendentes_() {
  var gatilhos = ScriptApp.getProjectTriggers();
  for (var i = 0; i < gatilhos.length; i++) {
    if (gatilhoCorresponde_(
      gatilhos[i], FUNCAO_GATILHO_PENDENTE, ScriptApp.EventType.CLOCK, '')) {
      ScriptApp.deleteTrigger(gatilhos[i]);
    }
  }
}

function garantirGatilhoPendente_(atrasoMs) {
  if (deduplicarGatilho_(
    FUNCAO_GATILHO_PENDENTE, ScriptApp.EventType.CLOCK, '')) return;
  ScriptApp.newTrigger(FUNCAO_GATILHO_PENDENTE)
    .timeBased()
    .after(Math.max(Number(atrasoMs) || 0, 1000))
    .create();
}

/** Isolated for deterministic tests and to keep all rate-limit math in one clock. */
function agoraMs_() {
  return new Date().getTime();
}

function salvarDisparo_(agora) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_ULTIMO_DISPARO, String(agora));
  props.setProperty(PROP_PUBLICACAO_PENDENTE, '0');
}

/**
 * Automatic events dispatch at most once per minute. Bursts set one trailing
 * one-shot clock trigger, protected by a script lock so simultaneous form
 * submissions cannot each create a workflow run.
 */
function solicitarPublicacao_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var agora = agoraMs_();
    var ultimo = Number(propriedade_(PROP_ULTIMO_DISPARO, '0')) || 0;
    var decorrido = ultimo ? Math.max(0, agora - ultimo) : JANELA_DISPARO_MS;
    if (ultimo && decorrido < JANELA_DISPARO_MS) {
      PropertiesService.getScriptProperties().setProperty(PROP_PUBLICACAO_PENDENTE, '1');
      garantirGatilhoPendente_(JANELA_DISPARO_MS - decorrido);
      return false;
    }

    dispararPublicacao_();
    salvarDisparo_(agora);
    removerGatilhosPendentes_();
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Executes the one coalesced trailing publication, or reschedules if early. */
function publicarPendente_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    removerGatilhosPendentes_();
    if (propriedade_(PROP_PUBLICACAO_PENDENTE, '0') !== '1') return false;

    var agora = agoraMs_();
    var ultimo = Number(propriedade_(PROP_ULTIMO_DISPARO, '0')) || 0;
    var decorrido = ultimo ? Math.max(0, agora - ultimo) : JANELA_DISPARO_MS;
    if (ultimo && decorrido < JANELA_DISPARO_MS) {
      garantirGatilhoPendente_(JANELA_DISPARO_MS - decorrido);
      return false;
    }

    dispararPublicacao_();
    salvarDisparo_(agora);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Manual and installation checks deliberately bypass automatic coalescing. */
function publicarImediatamente_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    dispararPublicacao_();
    salvarDisparo_(agoraMs_());
    removerGatilhosPendentes_();
    return true;
  } finally {
    lock.releaseLock();
  }
}

function aoEnviarFormulario(e) {
  SpreadsheetApp.flush();
  if (ehPedidoCorrecaoRemocao_(e)) {
    var estadoAlerta = alertarPedidoPrivado_();
    if (estadoAlerta === 'enviado') {
      Logger.log('OK: proprietario avisado sobre pedido privado.');
    } else if (estadoAlerta === 'agrupado') {
      Logger.log('OK: pedido privado agrupado no alerta recente.');
    } else {
      Logger.log(
        'ATENCAO: pedido privado continua na planilha; alerta nao enviado (' + estadoAlerta + ').');
    }
    return;
  }
  var enviada = solicitarPublicacao_();
  Logger.log(enviada
    ? 'OK: publicacao pedida ao GitHub.'
    : 'OK: publicacao agrupada para o proximo minuto.');
}

/** The emergency checkbox is an edit, not a form submission; publish it too. */
function aoEditarPlanilha(e) {
  if (!e || !e.range || e.range.getRow() < 2) return;
  var aba = e.range.getSheet();
  var titulo = String(aba.getRange(1, e.range.getColumn()).getDisplayValue() || '').trim();
  if (titulo !== COL_REMOVER) return;
  SpreadsheetApp.flush();
  var enviada = solicitarPublicacao_();
  Logger.log(enviada
    ? 'OK: alteracao em remover publicada no GitHub.'
    : 'OK: alteracao em remover agrupada para o proximo minuto.');
}

/** Manual button: asks for a publication now, without waiting for anything. */
function publicarAgora() {
  publicarImediatamente_();
  Logger.log('OK: pedido enviado. O site termina de publicar em cerca de 40 segundos.');
  Logger.log('    Acompanhe em: https://github.com/' + propriedade_(PROP_REPO, REPO_PADRAO) + '/actions');
}

/**
 * Installs the trigger. Run once, from inside the response spreadsheet.
 *
 * It ends by publishing for real, on purpose: a token that is wrong fails HERE,
 * in front of the owner, with a sentence telling him what to fix — instead of
 * failing quietly at the first stranger's registration, weeks later, when the
 * only symptom is that the site feels slow again.
 *
 * Running it twice is safe. It preserves triggers with a different identity
 * and removes only duplicates with the same handler, event type and source id.
 */
function instalarGatilhoDePublicacao() {
  var ss = planilhaConfigurada_();
  PropertiesService.getScriptProperties().setProperty(PROP_PLANILHA_ID, ss.getId());
  if (!propriedade_(PROP_TOKEN, '')) {
    throw new Error(
      'Antes de instalar o gatilho, guarde o token do GitHub: Apps Script > ' +
      'Configuracoes do projeto > Propriedades do script > Adicionar propriedade, ' +
      'nome ' + PROP_TOKEN + '. Passo a passo: moderacao/COMO_LIGAR_A_PLANILHA.md, Parte 4.');
  }

  var id = ss.getId();
  var temEnvio = deduplicarGatilho_(
    FUNCAO_DO_GATILHO, ScriptApp.EventType.ON_FORM_SUBMIT, id);
  var temEdicao = deduplicarGatilho_(
    FUNCAO_GATILHO_EDICAO, ScriptApp.EventType.ON_EDIT, id);
  if (!temEnvio) {
    ScriptApp.newTrigger(FUNCAO_DO_GATILHO).forSpreadsheet(ss).onFormSubmit().create();
  }
  if (!temEdicao) {
    ScriptApp.newTrigger(FUNCAO_GATILHO_EDICAO).forSpreadsheet(ss).onEdit().create();
  }
  Logger.log('OK: gatilhos ativos — cadastro e caixinha remover publicam sozinhos.');

  publicarImediatamente_();
  Logger.log('OK: o GitHub aceitou um pedido de publicacao agora — o token funciona.');
  Logger.log('    Veja rodando em: https://github.com/' + propriedade_(PROP_REPO, REPO_PADRAO) + '/actions');
}

/**
 * movimenta7 — creates the activity registration Google Form, the linked Sheet,
 * and the PUBLICAR tab that the site reads.
 * Run once in script.google.com (function: criarFormMovimenta7). Owner: Jorge Yuri.
 * All user-facing strings are pt-BR; code is English (project convention).
 *
 * ADR-0006 (25/08/2026) rewrote this form around two owner decisions:
 *
 * 1. NO PERSONAL DATA IS COLLECTED AT ALL. The old form asked for the
 *    submitter's name and WhatsApp "privately", plus the name of the physical
 *    education professional. All three are gone. What is not collected cannot
 *    leak, cannot be subject to an access request, and cannot be published by
 *    a wrong click on the sharing screen — which is a stronger guarantee than
 *    any of the checks downstream, because it does not depend on us being
 *    careful.
 *
 * 2. THE FORM BRANCHES INTO TWO PAGES, and that is a safety mechanism, not a
 *    convenience. Publication is automatic now, so a removal request typed into
 *    the registration fields would come back as a NEW pin. Removal requests
 *    live on their own page, in their own columns, which the PUBLICAR tab never
 *    reads. A removal literally cannot become a registration.
 *
 * The two link questions replace the old free "contato": a link is the one
 * answer that can send a visitor somewhere harmful, and nobody reviews it
 * before it goes live, so it is restricted to social profiles and map links —
 * enforced by the host allowlist in js/util.js, not by this form.
 *
 * 3. IT ALSO BUILDS THE PUBLICAR TAB (25/08/2026), which used to be a 20-line
 *    array formula the owner pasted by hand. That paste was the most
 *    failure-prone step of the whole launch, and every reason why disappears by
 *    doing it here instead:
 *      - the response sheet's name is locale-dependent ("Respostas ao
 *        formulário 1", "Form Responses 1", plus a number when a file receives
 *        more than one form). The pasted formula hard-coded "Respostas!" and
 *        the guide asked the owner to find and fix it by hand;
 *      - a formula typed into the grid is parsed in the SPREADSHEET's locale —
 *        pt-BR separates arguments with ";", en-US with ",". setFormula() always
 *        takes the US form and the sheet converts it, so the separators cannot
 *        come out wrong here;
 *      - the MATCH() strings repeated the question titles by hand, and any drift
 *        between the two lists produced #REF! in a tab nobody looks at. Both now
 *        come from TITULOS below, so drift is impossible.
 *
 * Running it again is safe: it creates a NEW form and a NEW spreadsheet and
 * never touches the previous ones (REGRA ZERO — nothing is ever deleted). That
 * is also why it is the WRONG function once the form has been shared: to repair
 * the PUBLICAR tab of the sheet already in use, run `consertarAbaPublicar`
 * instead, from inside that spreadsheet.
 */

/**
 * Question title -> column name in moderacao/aprovados.json.
 * Single source of truth: the questions and the PUBLICAR formula are both
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

/** Column order of the PUBLICAR tab. Same order as ingerir_csv.mjs. */
var COLUNAS = [
  'grupo', 'organizacao', 'regiao', 'modalidades', 'dias', 'horario',
  'local', 'rede_social', 'mapa', 'orientacao_profissional', 'custo', 'publico',
];

var COL_REMOVER = 'remover';
var ABA_PUBLICAR = 'PUBLICAR';

function criarFormMovimenta7() {
  var form = FormApp.create('movimenta7 — Cadastro de atividade física');
  form.setDescription(
    'Cadastre a atividade física do seu grupo/igreja no movimenta7 — a rede de atividades ' +
    'da comunidade adventista do DF, aberta a toda Brasília. Leva ~2 minutos.\n\n' +
    'ATENÇÃO: o que você preencher aqui vai para o mapa público SOZINHO, em cerca de ' +
    '10 minutos. Não existe fila de aprovação.\n\n' +
    'NÃO PEDIMOS NENHUM DADO PESSOAL (LGPD): nem seu nome, nem telefone, nem e-mail. ' +
    'Este cadastro é sobre a ATIVIDADE e sobre a IGREJA/ORGANIZAÇÃO, e tudo o que você ' +
    'responder é público no site. NÃO escreva telefone, endereço de casa nem o nome de ' +
    'ninguém em nenhum campo — a checagem automática recusa cadastros com esses dados, e ' +
    'um cadastro recusado simplesmente não aparece no mapa. ' +
    'Não coletamos dados de menores de idade. Para corrigir ou remover, volte a este mesmo ' +
    'formulário e escolha a segunda opção. ' +
    'Base legal: consentimento (art. 7º, I, LGPD). Agente de pequeno porte — Res. CD/ANPD 2/2022.');
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);

  form.addMultipleChoiceItem().setTitle('Consentimento (LGPD)').setRequired(true).setChoiceValues([
    'LI e CONCORDO: o que eu preencher aqui é público e entra no mapa automaticamente']);

  // Comes last on page 1 so the branch is decided right before the page turns.
  var acao = form.addMultipleChoiceItem().setTitle('O que você quer fazer?').setRequired(true);

  // ---------- página 2: cadastro (as colunas que viram pin) ----------
  var pgCadastro = form.addPageBreakItem().setTitle('Dados da atividade');

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

  form.addCheckboxItem().setTitle(TITULOS.modalidades).setRequired(true).setChoiceValues([
    'Corrida','Caminhada','Ciclismo','Vôlei','Futebol','Funcional','Trilhas','Natação','Outra']);

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
    .setHelpText('Ex.: @iasd.aguasclaras — ou o endereço do perfil no Instagram, Facebook, ' +
      'YouTube ou Strava. NÃO coloque telefone nem link de grupo de WhatsApp: o site recusa. ' +
      'Deixe em branco se o grupo não tiver perfil.');
  form.addTextItem().setTitle(TITULOS.mapa)
    .setHelpText('No app do Google Maps: procure o lugar, toque em Compartilhar e cole o ' +
      'endereço aqui (fica parecido com maps.app.goo.gl/...). Use o local do ENCONTRO ou o da ' +
      'igreja — nunca a casa de alguém. Deixe em branco se não tiver.');

  // ---------- página 3: correção/remoção (colunas que o site NUNCA lê) ----------
  var pgRemocao = form.addPageBreakItem().setTitle('Pedido de correção ou remoção');
  form.addTextItem().setTitle('Qual grupo sai ou muda? (nome exato como aparece no mapa)')
    .setRequired(true);
  form.addTextItem().setTitle('Região administrativa desse grupo').setRequired(true);
  form.addParagraphTextItem().setTitle('O que precisa ser corrigido ou removido?')
    .setRequired(true)
    .setHelpText('Se for correção, escreva o dado certo. Atendemos em até 24 horas.');

  // Navigation is what keeps the two paths apart. Without it the person who
  // finishes the registration page falls straight into the removal page and is
  // asked to justify removing the group they just created.
  acao.setChoices([
    acao.createChoice('Cadastrar uma atividade nova', pgCadastro),
    acao.createChoice('Corrigir ou REMOVER um cadastro que já está no mapa', pgRemocao),
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
  var abaPadrao = ss.getSheets()[0].getSheetName();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // setDestination writes the response sheet through another service, so the
  // handle we already hold does not see it yet. Without flush + reopen,
  // getSheets() below returns only the empty tab the file was born with.
  SpreadsheetApp.flush();
  ss = SpreadsheetApp.openById(ss.getId());

  var respostas = acharAbaDeRespostas(ss, abaPadrao);
  var publicar = null;
  if (respostas) {
    acrescentarColunaRemover(respostas);
    publicar = montarAbaPublicar(ss, respostas);
  }

  Logger.log('Form (editar): ' + form.getEditUrl());
  Logger.log('Form (PUBLICAR ESTE): ' + form.getPublishedUrl());
  Logger.log('Planilha de respostas: ' + ss.getUrl());
  if (publicar) {
    Logger.log('OK: aba de respostas encontrada ("' + respostas.getSheetName() + '")');
    Logger.log('OK: coluna "remover" criada e aba PUBLICAR montada — nada para colar a mao.');
    Logger.log('AGORA, na planilha: Arquivo > Compartilhar > Publicar na web,');
    Logger.log('       escolha a aba PUBLICAR (NAO "Documento inteiro") e o formato .csv.');
  } else {
    Logger.log('ATENCAO: nao achei a aba de respostas, entao a aba PUBLICAR NAO foi criada.');
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
 * next run (~10 min). ADR-0006 removed the approval queue, so this is the only
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
    'Marque para tirar este grupo do mapa. Ele sai sozinho em ~10 minutos.\n' +
    'Desmarque para ele voltar. Nada é apagado da planilha.');
  // requireCheckbox() only VALIDATES the cell. insertCheckboxes() would stamp
  // FALSE into every empty row — a thousand rows of noise in the one file the
  // owner has to be able to read at a glance.
  var linhas = Math.max(aba.getMaxRows() - 1, 1);
  aba.getRange(2, col, linhas, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireCheckbox().build());
}

/**
 * Builds the tab that gets published as CSV — the site's only input.
 *
 * Two deliberate choices, both of which cost a red CI to learn:
 *
 * - HEADERS ARE PLAIN TEXT IN ROW 1 and the formula lives in A2. The obvious
 *   alternative — one array literal stacking the headers over FILTER — breaks on
 *   the very day this is set up: with zero responses FILTER returns #N/A,
 *   IFERROR turns that into a single empty cell, and a 13-column row over a
 *   1-column row is an ARRAY_LITERAL error. The published CSV would then be the
 *   error text, which ingerir_csv.mjs correctly reads as "the wrong document was
 *   published" and aborts — a red build every 10 minutes between setup and the
 *   first registration. Split this way, the empty state publishes a header-only
 *   CSV: zero pins, green CI, exactly what an empty map should look like.
 *
 * - COLUMNS ARE READ AS WHOLE COLUMNS ($A:$ZZ), WITH NO ROW ANCHOR AT ALL, and
 *   the header row is dropped by an explicit condition rather than by starting
 *   the range at row 2. This is not a style choice: $A$2 DRIFTS. Google Forms
 *   delivers each answer by INSERTING a row, and an insert at row N pushes every
 *   absolute reference at or below N one row down — so $A$2 became $A$3 after
 *   the first registration and $A$4 after the second, sitting forever exactly
 *   one row below the newest answer and therefore matching NOTHING.
 *
 *   Measured on 25/08/2026, on the owner's live sheet: two registrations in the
 *   response tab, PUBLICAR empty, published CSV containing only its header row,
 *   zero pins on the site — and a green CI the whole time, because every file in
 *   this repository was doing exactly what it was told. A full-column reference
 *   has no row number left to shift, which is why the fix is the range and not
 *   a corrected row number: $A$2 typed in by hand would break again on the very
 *   next registration.
 *
 *   INDEX(range,0,n) returns the WHOLE column, header included, and the filter
 *   keeps every row whose "Nome do grupo" is not empty — which the header row
 *   satisfies. So the header is excluded BY NAME; without that condition the
 *   question titles publish themselves as a phantom registration.
 */
function montarAbaPublicar(ss, respostas) {
  var aba = ss.getSheetByName(ABA_PUBLICAR) || ss.insertSheet(ABA_PUBLICAR);
  // A sheet name with spaces or an apostrophe has to be quoted inside a formula.
  var ref = "'" + respostas.getSheetName().replace(/'/g, "''") + "'!";
  // Columns are matched BY HEADER NAME, never by letter: inserting a question in
  // the middle of the form later would otherwise slide every answer one column
  // over, under the right heading, and nobody would notice.
  // $A$1:$ZZ$1 keeps its row anchor on purpose: Forms only ever inserts at row
  // 2 or below, so row 1 is the one row in the sheet that cannot be pushed down.
  var coluna = function (titulo) {
    return 'INDEX(' + ref + '$A:$ZZ,0,MATCH("' + titulo + '",' + ref + '$A$1:$ZZ$1,0))';
  };

  var nomes = COLUNAS.concat([COL_REMOVER]);
  var expressoes = [];
  for (var i = 0; i < COLUNAS.length; i++) expressoes.push(coluna(TITULOS[COLUNAS[i]]));
  expressoes.push(coluna(COL_REMOVER));

  var grupo = coluna(TITULOS.grupo);
  aba.getRange(1, 1, 1, nomes.length).setValues([nomes]);
  aba.getRange('A2').setFormula(
    '=IFERROR(FILTER({' + expressoes.join(',') + '},' +
    grupo + '<>"",' + grupo + '<>"' + TITULOS.grupo + '"),"")');
  aba.setFrozenRows(1);
  return aba;
}

/**
 * Repairs the PUBLICAR tab of a spreadsheet that ALREADY EXISTS — without
 * creating a second form.
 *
 * criarFormMovimenta7() is the launch-day function and it always builds a NEW
 * form and a NEW spreadsheet, so it is exactly the wrong tool once the form has
 * been shared: the owner would be left with two forms, and the one people
 * already have the link to would be the one nobody reads. This function touches
 * only the tab, on the sheet it is run from.
 *
 * HOW THE OWNER RUNS IT: open the RESPONSES SPREADSHEET > Extensões > Apps
 * Script, paste this whole file, pick `consertarAbaPublicar` in the function
 * list, Executar. Nothing is deleted: it rewrites one cell (PUBLICAR!A2) and the
 * header row, and adds the `remover` column only if it is missing.
 */
function consertarAbaPublicar() {
  var ss = SpreadsheetApp.getActive();
  if (!ss) {
    throw new Error('Rode esta funcao DE DENTRO da planilha de respostas ' +
      '(planilha > Extensoes > Apps Script), nao de um script solto.');
  }
  var respostas = acharAbaDeRespostas(ss, 'Página1');
  // acharAbaDeRespostas() falls back to "any tab wider than one column" when no
  // header matches — which is right on creation day, when PUBLICAR does not
  // exist yet, and WRONG here, where it does and is 13 columns wide. Without
  // this guard the repair could hand PUBLICAR to itself as its own source: a
  // circular reference, plus a 14th column bolted onto the published tab. So the
  // header match is made mandatory on this path.
  var cabecalho = respostas
    ? respostas.getRange(1, 1, 1, Math.max(respostas.getLastColumn(), 1)).getValues()[0]
    : [];
  var temColunaDoGrupo = false;
  for (var c = 0; c < cabecalho.length; c++) {
    if (String(cabecalho[c]).trim() === TITULOS.grupo) temColunaDoGrupo = true;
  }
  if (!temColunaDoGrupo) {
    throw new Error('Nao achei a aba de respostas nesta planilha: nenhuma aba tem a coluna "' +
      TITULOS.grupo + '" na primeira linha. Esta e a planilha ligada ao formulario?');
  }
  acrescentarColunaRemover(respostas);
  montarAbaPublicar(ss, respostas);
  Logger.log('OK: aba PUBLICAR remontada a partir de "' + respostas.getSheetName() + '".');
  Logger.log('    Os cadastros que ja estavam na planilha aparecem la agora.');
  Logger.log('    Se a aba ja estava publicada na web, nao precisa republicar.');
}

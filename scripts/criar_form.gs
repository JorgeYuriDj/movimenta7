/**
 * movimenta7 — creates the activity registration Google Form + linked Sheet.
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
 */
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

  form.addTextItem().setTitle('Nome do grupo').setRequired(true)
    .setHelpText('Ex.: Corredores da IASD Águas Claras. Nome do GRUPO, não o seu.');
  form.addTextItem().setTitle('Igreja ou organização responsável').setRequired(true);

  form.addListItem().setTitle('Região administrativa (DF)').setRequired(true).setChoiceValues([
    'Águas Claras','Arniqueira','Brazlândia','Candangolândia','Ceilândia','Cruzeiro',
    'Fercal','Gama','Guará','Itapoã','Jardim Botânico','Lago Norte','Lago Sul',
    'Núcleo Bandeirante','Paranoá','Park Way','Planaltina','Plano Piloto','Recanto das Emas',
    'Riacho Fundo','Riacho Fundo II','Samambaia','Santa Maria','São Sebastião','SCIA/Estrutural',
    'SIA','Sobradinho','Sobradinho II','Sol Nascente/Pôr do Sol','Sudoeste/Octogonal',
    'Taguatinga','Varjão','Vicente Pires','Arapoanga','Água Quente','Entorno (fora do DF)']);

  form.addCheckboxItem().setTitle('Modalidade(s)').setRequired(true).setChoiceValues([
    'Corrida','Caminhada','Ciclismo','Vôlei','Futebol','Funcional','Trilhas','Natação','Outra']);

  form.addCheckboxItem().setTitle('Dia(s) da semana').setRequired(true).setChoiceValues([
    'Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado (após o pôr do sol)']);
  form.addTextItem().setTitle('Horário de início (ex.: 06h30)').setRequired(true);

  form.addTextItem().setTitle('Local do encontro (ponto público — parque, quadra, portão da igreja)')
    .setRequired(true)
    .setHelpText('Nunca informe endereço de residência.');

  // The professional's NAME and CREF number used to be asked here. Both identify
  // a person, so both are gone; what the visitor actually needs to know is
  // whether someone qualified is running the session, and that is this answer.
  form.addMultipleChoiceItem().setTitle('Tipo de atividade').setRequired(true).setChoiceValues([
    'Encontro social de prática livre',
    'Atividade orientada por profissional de Educação Física']);

  form.addCheckboxItem().setTitle('Aberta a quem?').setChoiceValues([
    'Aberta a toda a comunidade (não precisa ser adventista)','Iniciantes bem-vindos',
    'Famílias com crianças (acompanhadas dos responsáveis)','Acessível para PCD','Idosos']);
  form.addMultipleChoiceItem().setTitle('Custo').setRequired(true)
    .setChoiceValues(['Gratuito','Pago']);

  form.addTextItem().setTitle('@ do Instagram ou link da rede social da igreja/grupo')
    .setHelpText('Ex.: @iasd.aguasclaras — ou o endereço do perfil no Instagram, Facebook, ' +
      'YouTube ou Strava. NÃO coloque telefone nem link de grupo de WhatsApp: o site recusa. ' +
      'Deixe em branco se o grupo não tiver perfil.');
  form.addTextItem().setTitle('Link do Google Maps do local do encontro')
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

  // Navigation is what keeps the two paths apart. Without this line the person
  // who finishes the registration page would fall straight into the removal
  // page and be asked to justify removing the group they just created.
  acao.setChoices([
    acao.createChoice('Cadastrar uma atividade nova', pgCadastro),
    acao.createChoice('Corrigir ou REMOVER um cadastro que já está no mapa', pgRemocao),
  ]);
  pgCadastro.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  var ss = SpreadsheetApp.create('movimenta7 — respostas');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  Logger.log('Form (editar): ' + form.getEditUrl());
  Logger.log('Form (PUBLICAR ESTE): ' + form.getPublishedUrl());
  Logger.log('Planilha de respostas: ' + ss.getUrl());
}

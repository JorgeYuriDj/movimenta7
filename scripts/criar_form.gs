/**
 * movimenta7 — creates the activity registration Google Form + linked private Sheet.
 * Run once in script.google.com (function: criarFormMovimenta7). Owner: Jorge Yuri.
 * All user-facing strings are pt-BR; code is English (project convention).
 */
function criarFormMovimenta7() {
  var form = FormApp.create('movimenta7 — Cadastro de atividade física');
  form.setDescription(
    'Cadastre a atividade física do seu grupo/igreja no movimenta7 — a rede de atividades ' +
    'da comunidade adventista do DF, aberta a toda Brasília. Leva ~3 minutos.\n\n' +
    'COMO USAMOS SEUS DADOS (LGPD): coletamos estes dados só para organizar e divulgar as ' +
    'atividades. Vira PÚBLICO no site apenas: nome do grupo, igreja/organização, modalidade, ' +
    'região, dia, horário, local público e o contato que você indicar como público. Seu nome e ' +
    'telefone pessoais ficam PRIVADOS com a moderação. Não coletamos dados de menores de idade. ' +
    'Para corrigir ou remover seu cadastro, fale com a moderação pelo WhatsApp informado no site. ' +
    'Base legal: consentimento (art. 7º, I, LGPD). Agente de pequeno porte — Res. CD/ANPD 2/2022.');
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);

  form.addTextItem().setTitle('Nome do grupo').setRequired(true)
    .setHelpText('Ex.: Corredores da IASD Águas Claras');
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

  form.addMultipleChoiceItem().setTitle('Tipo de atividade').setRequired(true).setChoiceValues([
    'Encontro social de prática livre',
    'Atividade orientada por profissional de Educação Física']);
  form.addTextItem().setTitle('Se orientada: nome público do profissional e nº do CREF')
    .setHelpText('Obrigatório apenas para atividade orientada (CREF7/DF).');

  form.addCheckboxItem().setTitle('Aberta a quem?').setChoiceValues([
    'Aberta a toda a comunidade (não precisa ser adventista)','Iniciantes bem-vindos',
    'Famílias com crianças (acompanhadas dos responsáveis)','Acessível para PCD','Idosos']);
  form.addMultipleChoiceItem().setTitle('Custo').setRequired(true)
    .setChoiceValues(['Gratuito','Pago (informe no campo de observações)']);

  form.addTextItem().setTitle('Contato PÚBLICO do grupo (link de grupo do WhatsApp ou @ do Instagram)')
    .setRequired(true)
    .setHelpText('Este contato aparece no site. Dica: link de grupo pode ser revogado se vazar.');
  form.addTextItem().setTitle('Seu nome (PRIVADO — só a moderação vê)').setRequired(true);
  form.addTextItem().setTitle('Seu WhatsApp (PRIVADO — só a moderação vê)').setRequired(true);
  form.addParagraphTextItem().setTitle('Observações (nível, equipamentos, o que mais quiser contar)');

  form.addMultipleChoiceItem().setTitle('Consentimento (LGPD)').setRequired(true).setChoiceValues([
    'LI e CONCORDO com o uso dos dados descrito no topo deste formulário']);

  var ss = SpreadsheetApp.create('movimenta7 — respostas (PRIVADA)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  Logger.log('Form (editar): ' + form.getEditUrl());
  Logger.log('Form (PUBLICAR ESTE): ' + form.getPublishedUrl());
  Logger.log('Planilha privada: ' + ss.getUrl());
}

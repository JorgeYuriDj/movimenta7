# Lançamento Fase 0 — AMANHÃ (24/08/2026)

> Objetivo do dia: **divulgar e começar os cadastros.** Sem mapa, sem lista automática.
> Landing + formulário + WhatsApp + aviso de privacidade. Só isso — e bem feito.

## Passo a passo (na ordem)

### 1. Criar o Google Form (~15 min, você faz)
1. Abra [script.google.com](https://script.google.com) logado na sua conta Google.
2. Novo projeto → apague o conteúdo → cole o arquivo `scripts/criar_form.gs` deste repo.
3. Rode a função `criarFormMovimenta7` (botão ▶). Autorize quando pedir.
4. O log mostra 2 links: **link de edição** (seu) e **link de resposta** (público, vai na landing
   e na divulgação). O form já nasce com todas as perguntas e o aviso de privacidade.
5. No Sheets vinculado (o script cria), confira que a planilha é **privada** (não compartilhar).

### 2. Landing no ar (Claude constrói; você só aprova o visual)
- 1 página em `site/` publicada no GitHub Pages: título claro + 3 bullets de valor + **1 CTA**
  ("Cadastre sua atividade") + botão "Falar no WhatsApp" + aviso de privacidade no rodapé
  + og:image 1200×630 (o preview no WhatsApp é a primeira tela do produto).
- Texto-base do herói:
  > **movimenta7** — Encontre uma atividade física perto de você, participe no seu ritmo e
  > movimente-se em comunidade. Corrida, caminhada, ciclismo, vôlei e mais, em todo o DF.
  > Organizado pela comunidade adventista e **aberto a todos**.

### 3. Divulgação (3 canais no mesmo dia)
Mensagem pronta para grupos de WhatsApp (ajuste o que quiser):

> 🏃‍♀️🚴‍♂️ Está nascendo o **movimenta7** — a rede de atividades físicas da comunidade
> adventista do DF, aberta a toda Brasília.
>
> Sua igreja tem grupo de corrida, caminhada, vôlei, ciclismo, funcional ou trilha?
> **Cadastre em 3 minutos** e apareça no mapa que vai reunir tudo isso: [LINK DO FORM]
>
> Em breve: mapa completo, agenda de treinos e a equipe da comunidade nas corridas de rua. 💚

- Canais: grupos de WhatsApp de igrejas/regionais · Instagram (stories + bio) · mensagem direta
  para líderes de ~10 igrejas (meta da semana: **15 atividades reais**).
- Link wa.me para o botão de contato: `https://wa.me/55DDDNÚMERO?text=Olá!%20Vi%20o%20movimenta7...`
  (número só dígitos com 55+DDD). Se usar grupo: gerar link `chat.whatsapp.com/...` dentro do app
  (dá para **revogar** se vazar).

### 4. Moderação (a partir das primeiras respostas)
- Abrir a planilha 2x/dia. Para cada resposta: revisar o texto → preencher a coluna
  **APROVADO = SIM** (ou NÃO). Nada aprovado = nada público. Telefone pessoal NUNCA vira público.

## Aviso de privacidade (já embutido no form pelo script)

> **Como usamos seus dados (LGPD):** o movimenta7 é uma iniciativa comunitária independente.
> Coletamos os dados deste formulário só para organizar e divulgar as atividades. **Vira público
> no site apenas:** nome do grupo, igreja/organização, modalidade, região, dia, horário, local
> público e o contato que você indicar como público. Seu nome e telefone pessoais ficam privados
> com a moderação, salvo se você autorizar a publicação. Não coletamos dados de menores de idade.
> Para corrigir ou remover seu cadastro: [WhatsApp da moderação]. Base legal: consentimento
> (art. 7º, I da LGPD). Regime de agente de pequeno porte — Res. CD/ANPD nº 2/2022.

## O que fica explicitamente para depois de amanhã
Mapa Leaflet · lista automática · agenda/.ics · selo de confirmação · provas FAtDF.
(Ver PLANO_EXECUCAO.md — Fases 1 e 2.)

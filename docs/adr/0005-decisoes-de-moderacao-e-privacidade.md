# ADR-0005 — Decisões de moderação e privacidade (pós-pesquisa)

- **Data:** 24/08/2026
- **Status:** aceito
- **Quem decidiu:** Jorge Yuri (dono)
- **Base:** `docs/pesquisa/2026-08-24_moderacao-escalavel_VEREDITO.json` — 9 agentes,
  4 frentes + 3 céticos adversariais. As quatro perguntas estão em `decisoes_para_o_dono`.
- **Relacionados:** ADR-0002 (Write-Audit-Publish), ADR-0004 (segurança/LGPD).

> **Documento histórico:** a decisão 1 continua válida. As decisões 2, 3 e 4 foram substituídas
> pelo [ADR-0006](0006-publicacao-automatica-sem-dado-pessoal.md): não se publica WhatsApp ou CREF,
> e não existe fila de aprovação. O [ADR-0007](0007-feed-privado-e-atualizacao-automatica.md)
> esclarece que respostas são processadas no runner e não são commitadas ao histórico do Git.

## Contexto

A pesquisa aprovou a espinha do desenho de moderação automatizada, mas deixou quatro
escolhas que não são técnicas — são de política, e portanto do dono. Elas foram feitas
em 24/08/2026, antes de qualquer cadastro real ser publicado.

---

## Decisão 1 — Nenhum dado da comunidade entra no histórico do Git

**Escolhido:** esperar o pipeline da Etapa 2. Nada de publicar cadastro à mão.

O repositório é público e o histórico do Git é permanente: um cadastro publicado por
commit fica gravado para sempre, mesmo depois de sair do site. Isso conflita com o
direito de exclusão da LGPD (art. 18, VI) — a remoção seria parcial e ninguém contaria
isso para a pessoa. Desfazer depois exigiria reescrever o histórico, o que a REGRA ZERO
proíbe.

Em 24/08 a janela ainda estava aberta de graça: `moderacao/aprovados.json` e
`data/snapshot.json` estavam ambos vazios. **Custo aceito:** 1 a 2 dias sem pin novo.
O formulário continua coletando normalmente nesse período — nada se perde, só espera.

**Consequência imediata:** `moderacao/aprovados.json` fica vazio até a Etapa 2 entrar.
Quando ela entrar, os dois arquivos saem do versionamento e o snapshot passa a ser gerado
no runner a partir do CSV publicado.

---

## Decisão 2 — Link de grupo de WhatsApp: sim, com consentimento extra; nunca para crianças

**Escolhido:** aceitar o link, com duas travas.

Quem entra num grupo de WhatsApp vê o telefone de **todos** os membros — tipicamente 15 a
40 pessoas identificadas, ligadas publicamente a uma igreja, a um lugar e a um horário
fixos. Nenhuma delas preencheu o formulário nem consentiu. Por outro lado, o link do grupo
é o único contato que a maioria dos grupos pequenos tem; exigir Instagram deixaria muita
gente de fora.

Travas obrigatórias:
1. O formulário passa a exigir um consentimento específico e versionado: o líder declara
   que **avisou os participantes** de que o link será público. Vem com a instrução de pôr
   o grupo em "aprovação do admin".
2. Grupo marcado **"Famílias com crianças" nunca publica link de grupo aberto** (ADR-0004:
   nenhum dado de menor).

**Risco residual assumido:** publicado o link, o site não desfaz — só o admin do grupo pode
revogá-lo.

---

## Decisão 3 — O nome do profissional de educação física NÃO é publicado

**Escolhido:** publicar apenas "com acompanhamento profissional: sim" e o número do CREF.

O nome seria o único dado do site a identificar uma pessoa específica ao lado de filiação
religiosa — e quase nunca é ela quem preenche o formulário, ou seja, é dado de terceiro sem
consentimento. O CREF entrega a mesma credibilidade de forma verificável: qualquer um
confere o número no site do conselho.

O nome do profissional **continua sendo coletado** na planilha privada (serve para a
moderação conferir) e **nunca sai dela**. `orientacao_profissional` é campo público;
qualquer campo com o nome é privado por construção (ADR-0004).

---

## Decisão 4 — Moderação apertada: combinação inédita sempre passa pela fila

**Escolhido:** o rigor alto, ao custo de 20-35 min na primeira semana.

O ataque mais barato contra este sistema não exige esperteza nenhuma: copiar do próprio
site uma igreja real e um local real, trocar o contato pelo seu, não marcar "Famílias com
crianças" — e o cadastro nasceria verde, aprovado sozinho, sem nenhum olho humano no nome
de 60 caracteres. O dropdown de igrejas, que parecia defesa, é justamente o que entrega ao
falsificador a grafia canônica da igreja verdadeira.

Portanto: **toda combinação (organização + local + dia) inédita vai para a fila vermelha**,
assim como o primeiro cadastro de cada organização e qualquer contato novo ou alterado.

Custo real, medido pela pesquisa: 20-35 min espalhados pela primeira semana de 100
cadastros; 5-8 min por 100 da terceira semana em diante; menos de 2 min por semana no
regime permanente de gotejamento.

**Alternativa recusada:** vermelho só quando o local OU a igreja forem novos (12-18 min).
Economiza uns 15 minutos uma única vez e reabre o caminho do clone para sempre.

---

## O que estas decisões obrigam a construir

| Decisão | Onde vira código |
|---|---|
| 1 | `moderacao/aprovados.json` fica vazio → tirar os 2 arquivos do versionamento (Etapa 2) |
| 2 | `scripts/criar_form.gs`: consentimento versionado + regra dura para "Famílias com crianças" |
| 3 | `scripts/criar_form.gs` + schema: CREF em `^\d{4,6}-?[GP]/DF$`, nome fora dos campos públicos |
| 4 | Triagem em ARRAYFORMULA (Etapa 3) + regras anticlone (Etapa 4) |

## Pendente de decisão do dono (não coberto aqui)

- **A frase pública do site.** `index.html` promete "Nada entra no site sem revisão humana".
  Hoje isso é verdade (moderação 100% manual). Quando a Etapa 3/4 entrar, o texto tem de
  mudar junto — nunca calado. A redação proposta está em `decisoes_para_o_dono[4]` do
  veredito.
- **`WHATSAPP_URL` da moderação** (`js/config.js`) segue vazio. É o canal pelo qual a pessoa
  pede correção ou remoção, exigido pela LGPD e prometido em `index.html`.

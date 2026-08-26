# ADR-0006 — Publicação automática e fim da coleta de dado pessoal

- **Data:** 25/08/2026
- **Status:** aceito
- **Quem decidiu:** Jorge Yuri (dono)
- **Substitui:** ADR-0005 decisões 2, 3 e 4 (WhatsApp, CREF e moderação apertada) e a parte do ADR-0002/ADR-0004 que
  fazia da revisão humana um controle obrigatório.
- **Continua valendo:** ADR-0005 decisão 1 · ADR-0001 · ADR-0003 · o resto do ADR-0004.

> **Atualização de 25/08/2026:** este ADR mantém a política atual — zero dado pessoal
> intencional e publicação sem fila —, mas o [ADR-0007](0007-feed-privado-e-atualizacao-automatica.md)
> substituiu o CSV/aba `PUBLICAR` por feed privado autenticado, adicionou disparo na edição de
> `remover`, cache para links curtos e atualização periódica do snapshot no navegador. As menções
> abaixo a CSV público, cache do CSV e ciclo de ~10 minutos descrevem a implementação anterior.
> Aqui, “fim da coleta” significa que o Form não **pede** dado pessoal. Campos livres ainda podem
> ser usados contra a instrução: o gate detecta telefone, e-mail, CPF/CNPJ e links, mas não infere
> nomes pessoais ou residências. Esses casos exigem `remover`; ver ADR-0007.

## Contexto

O dono pediu, em 25/08/2026, três mudanças de uma vez:

1. Trocar o contato público — sai o WhatsApp, entram o **@ da rede social** da igreja/grupo e o
   **link do Google Maps** do local.
2. **Todo cadastro entra no mapa sozinho**, "igual o mapa dos embaixadores", sem fila.
3. **Retirar todos os dados pessoais** e deixar só dado público. Quem quiser saber mais fala
   pela rede social, comenta no Google Maps ou vai até o local.

O pedido 2 já tinha sido levantado antes e ficado em aberto (ADR-0005 decisão 4 escolheu o
oposto: moderação apertada). Desta vez ele foi reafirmado, com prazo de publicação no mesmo dia.

O ponto que motivou este ADR: **o pedido 3 muda o caminho normal**. O formulário deixa de pedir
dado pessoal, eliminando a coleta intencional de nome, telefone, e-mail e CREF. Isso não classifica
todo texto livre: a correção posterior do ADR-0007 mantém a planilha privada e declara o limite
para nomes pessoais e residências.

## Decisão 1 — O formulário deixa de coletar dado pessoal

Saem do formulário: **seu nome**, **seu WhatsApp** e o **nome/CREF do profissional de educação
física**. Fica a pergunta "tipo de atividade", que informa se há profissional acompanhando sem
identificar ninguém.

Consequências que vão além da privacidade:

- **A planilha deixa de ter coluna desenhada para dado privado.** A conclusão inicial de que
  “Publicar na web” passaria a ser seguro estava incompleta: alguém ainda pode digitar telefone
  ou outro dado num campo livre. O ADR-0007 corrigiu isso mantendo a planilha inteira privada.
- **Some a necessidade da segunda planilha.** O isolamento em dois arquivos existia só para
  separar colunas privadas das públicas. A projeção atual é feita pelo feed autenticado, sem aba
  pública e sem outra planilha.
- A trava de **coluna inesperada continua abortando** a ingestão: ela agora protege contra
  publicar a aba errada.

## Decisão 2 — Publicação automática, com quarentena por cadastro

Não existe mais caixinha `aprovado`. Na implementação inicial, um cron a cada 10 minutos lia a
planilha; o ADR-0007 acrescentou os gatilhos imediatos. O que
sobrou de controle humano é o inverso: a coluna `remover`, que tira do ar.

**A parte que não é óbvia é o tratamento de erro.** Com revisão humana, tudo era fail-closed: um
registro ruim reprovava o build inteiro. Isso não sobrevive à publicação automática — daria a
qualquer pessoa com o link do formulário o poder de **congelar o site inteiro** mandando lixo.
Então o pipeline passou a ter duas classes de erro:

| Classe | Exemplo | O que acontece |
|---|---|---|
| **Estrutural** | coluna inesperada, CSV vazio, planilha fora do ar | **aborta tudo**, nada é gravado, o site anterior fica no ar |
| **De um cadastro** | telefone digitado no local, região inexistente, link fora da lista | **pula só aquele**, com aviso no log, e o resto publica |

`publicar_snapshot.mjs` e `valida_snapshot.mjs` continuam fail-closed de propósito: a entrada
deles é um arquivo que o nosso próprio código acabou de escrever, então um erro ali é bug nosso,
não resposta ruim de estranho.

## Decisão 3 — Link só para destino que está numa lista

Um link é a única resposta capaz de mandar o visitante para algum lugar perigoso, e agora ninguém
o lê antes de ir ao ar. `safeUrl()` aceitava qualquer endereço `http(s)` — o que bastava quando um
humano olhava primeiro, e não basta mais.

Os dois campos de link só aceitam:

- **rede social:** instagram, facebook, threads, youtube, tiktok, twitter/x, strava
- **mapa:** maps.google.com, maps.app.goo.gl, google.com/maps, goo.gl/maps, openstreetmap

Regras que valem a pena registrar porque foram erradas na primeira tentativa:

- **`maps.app.goo.gl` precisa passar.** É o que o botão "Compartilhar" do Google Maps gera, ou
  seja, o formato que a maioria vai colar. Uma primeira versão exigia `/maps` no caminho de tudo
  que terminasse em `goo.gl` e rejeitava justamente o caso mais comum.
- **`google.com` só sob `/maps`.** Sem isso, "um link do Google Maps" viraria uma forma de
  publicar qualquer página hospedada no Google, um arquivo do Drive incluído.
- **Comparação de host é exata ou por subdomínio** (`h === d || h.endsWith("." + d)`). Um
  `endsWith("instagram.com")` ingênuo aceitaria `instagram.com.exemplo-malicioso.com`.

Link recusado **custa o link, nunca o pin**: o grupo entra no mapa sem o botão. Deletar o
cadastro de um grupo real por causa de um endereço mal digitado seria pior que a doença.

Os valores são **normalizados na ingestão**, então `moderacao/aprovados.json` — que é público —
guarda sempre a URL validada, nunca o texto cru que a pessoa digitou.

## Decisão 4 — O site passa a dizer a verdade

O site prometia por escrito, em `index.html`, que "nada entra no site sem revisão humana".
Continuar publicando isso enquanto a publicação é automática seria uma declaração falsa para a
comunidade. O texto mudou junto, no mesmo commit:

- Some o passo "a moderação revisa"; entra "seu grupo entra no mapa sozinho, em ~10 minutos".
- O aviso de privacidade passa a dizer que **não pedimos dado pessoal**, que **tudo o que se
  preenche é público**, e que o conteúdo é de responsabilidade de quem cadastrou.
- Entra um **selo de atualidade** ("lista atualizada há X"). Sem fila de aprovação, uma pipeline
  quebrada é indistinguível de uma semana sem cadastros — o selo é o que separa as duas.
- Entra um caminho visível de **denúncia/remoção**, que é o próprio formulário: ele passou a
  perguntar, na primeira página, se é cadastro novo ou pedido de correção/remoção.

O formulário **ramifica em duas páginas**, e isso é mecanismo de segurança, não conveniência: um
pedido de remoção digitado nos campos de cadastro voltaria como pin novo. As duas páginas gravam
em colunas diferentes, e a aba PUBLICAR só lê as do cadastro — um pedido de remoção **não tem
como** virar publicação.

## Riscos aceitos (declarados, não resolvidos)

1. **Vandalismo e cadastro de terceiros.** Qualquer pessoa pode cadastrar uma atividade numa
   igreja real sem falar com a igreja. É o "ataque do clone" que a ADR-0005 decisão 4 fechava e
   que esta ADR reabre — é o preço direto de não ter fila. Mitigações: a coluna `remover` tira do
   ar na rodada seguinte (~10 min), o link de denúncia é visível no site, e o texto diz que o
   conteúdo é de responsabilidade de quem cadastrou. **Não há prevenção, só reação rápida.**
2. **Cache de ~5 min do Google.** Mitigado, não eliminado: a ingestão passou a furar o cache com
   um parâmetro variável por rodada. Isso importa mais agora, porque uma remoção que lê CSV velho
   republicaria o grupo que acabou de sair.
3. **Cron desligado por inatividade.** O GitHub desliga workflows agendados após 60 dias sem
   atividade no repositório. Se o mapa parar de atualizar sozinho, é o primeiro lugar a olhar.

## Alternativa considerada e recusada

**Ler a planilha direto no navegador**, como faz `mapa-embaixadores-2026`, que foi a referência
citada pelo dono. Entrega o cadastro no mapa em segundos em vez de minutos.

Recusada porque destruiria a proteção mais valiosa do projeto: com leitura no navegador, o CSV
inteiro é baixado **na máquina de cada visitante** antes de qualquer checagem nossa. Se a aba
errada fosse publicada, os dados iriam para todo mundo que abrisse o site — e a trava de coluna
inesperada, que hoje aborta antes de qualquer pessoa ver, não protegeria mais ninguém. Também
exigiria abrir a CSP para `docs.google.com`.

**O ganho é de minutos; a perda é da única barreira que funciona sem ninguém prestar atenção.**
Ficou a leitura no servidor, com o ciclo encurtado para ~10 minutos.

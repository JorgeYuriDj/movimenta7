# Como o mapa decide o que publica

Não existe fila de aprovação. A pessoa cadastra uma atividade, a checagem automática protege o
site e o grupo entra normalmente em **cerca de 1 a 2 minutos**. O único controle cotidiano é a
coluna `remover`.

## O caminho de um cadastro

1. A pessoa preenche o Google Form, que não pede nome, telefone, e-mail ou CREF.
2. A resposta fica na planilha privada. Nenhuma aba é publicada na web.
3. O Apps Script avisa o GitHub imediatamente; o cron de 10 minutos é só reserva.
4. O GitHub lê um feed privado autenticado, normaliza e verifica cada campo.
5. O snapshot sanitizado vira mapa e lista. A página procura atualizações a cada 60 segundos e
   quando volta ao foco.

O processo normal leva ~40 segundos no GitHub mais o tempo de atualização do navegador. Se o
gatilho falhar, o cron pode entrar na fila. Execuções agendadas bem-sucedidas foram medidas entre
40 e 55 minutos, mas isso não é prazo máximo: o GitHub pode atrasar ou descartar uma rodada.

## O que a checagem recusa

Um cadastro não entra — só ele; o resto do mapa continua — quando houver:

| O quê | Como é tratado |
|---|---|
| telefone, e-mail, CPF ou CNPJ | detectado após normalização, inclusive em grafia Unicode disfarçada |
| URL em campo de texto | recusada fora dos dois campos próprios de link |
| rede social ou mapa ausentes/inválidos | o cadastro inteiro fica em quarentena; os dois links são obrigatórios |
| grupo ou região ausentes | não há informação mínima para publicar |
| região desconhecida | comparada com a lista e o mapa oficiais do projeto |
| cadastro repetido | mesma combinação de grupo, região e local entra uma vez |

Espaços invisíveis são removidos, texto é normalizado e campos públicos têm limite. O log informa
linha, campo e classe do problema, mas nunca repete o conteúdo digitado.

Rede social e mapa são partes obrigatórias do cadastro. Se qualquer um dos dois estiver ausente
ou for inválido, o cadastro inteiro não vira pin nem item da lista. Os destinos permitidos são:

- **rede social:** Instagram, Facebook, Threads, YouTube, TikTok, Twitter/X e Strava; um `@`
  simples vira perfil do Instagram;
- **mapa:** Google Maps, `maps.app.goo.gl`, compartilhamentos `share.google` comprovados como local
  e OpenStreetMap nos hosts e caminhos definidos pela allowlist. Como `share.google` também encurta
  páginas comuns, o pipeline segue os redirecionamentos e só publica quando o destino é um lugar.

WhatsApp não é aceito: o telefone fica embutido na URL.

### O limite que precisa ser dito com clareza

Não existe detector confiável que separe “nome de pessoa” de “nome do grupo/igreja”, nem
“endereço de residência” de “endereço de local público”. O formulário **não pede** esses dados e
manda não escrevê-los, mas o gate não pode prometer reconhecê-los pelo texto. Se você encontrar
um nome pessoal ou residência no mapa, marque `remover` imediatamente e não copie o conteúdo
para issue ou log público.

## Como a posição é escolhida

O formulário exige o link do Google Maps. Ainda assim, “link recebido” e “coordenada exata” não
são a mesma coisa:

- se latitude e longitude aparecem na URL ou no redirecionamento de um link curto, e o ponto cai
  dentro do polígono do DF, o pin é **exato**;
- quando um `share.google` comprova um resultado de local mas não revela coordenadas, o nome
  público é consultado no OpenStreetMap/Nominatim, limitado ao DF. O resultado só é usado quando
  pelo menos dois termos conferem e o país é Brasil; consultas são identificadas, limitadas a uma
  por segundo e reaproveitadas do cache;
- se não for possível confirmar coordenadas, o pin usa um ponto representativo da região e é
  exibido como **aproximado**;
- se uma coordenada confirmada cai fora do polígono do DF, o cadastro inteiro fica em quarentena:
  não há rota, pin nem item na lista;
- se a região escolhida diverge de uma coordenada válida dentro do DF, vale o link e o rótulo da
  região é corrigido.

O robô nunca procura coordenadas no corpo da página do Google, porque medições reais mostraram
que ela devolve a mesma posição genérica para lugares diferentes. Links curtos e geocodificação
são resolvidos quando necessário e o resultado é reaproveitado do cache por hash enquanto ele
existir. Vários grupos podem usar a mesma igreja, parque ou quadra;
coordenadas repetidas são preservadas.

## O que você faz quando precisar

**Retirar:** marque `remover` na linha da resposta. A edição dispara a publicação, e o grupo sai
normalmente em cerca de 1 a 2 minutos. **Não exclua a linha.** A caixa é o controle reversível:
se foi marcada por engano, desmarque e o cadastro válido volta na próxima publicação.

**Corrigir:** marque a linha antiga como `remover` e peça um novo cadastro. Não edite
`moderacao/aprovados.json` ou `data/snapshot.json`: respostas externas não devem entrar no
histórico do Git.

**Denúncia recebida pelo formulário:** confira a referência no ramo de correção/remoção e aplique
o mesmo procedimento. Esse ramo fica fora do feed e não pode virar pin.

## O que é público

Somente dados sobre a atividade e a organização:

nome do grupo · igreja/organização · região · modalidades · dias · horário · local público ·
tipo de atividade · custo · público atendido · rede social · rota · posição exata ou aproximada

O formulário não pede dado pessoal. Telefone, e-mail, CPF/CNPJ e URL fora do lugar são barrados
antes do snapshot. Nome pessoal e residência dependem da proibição explícita no Form e da
retirada reativa descrita acima; a planilha privada evita que o texto cru vire uma fonte pública
paralela ao site.

## Erro de cadastro × erro estrutural

- **`AVISO: linha N ...`** — um cadastro foi isolado; o restante publicou.
- **`INGESTAO ABORTADA` / `PUBLICACAO ABORTADA` / `SNAPSHOT REPROVADO`** — a origem ou o contrato
  está errado; nada novo é publicado e a versão anterior continua no ar.

Para conferir localmente: `node scripts/valida_snapshot.mjs`. O mesmo gate roda antes do deploy,
junto com testes, contraste e proteção contra `innerHTML` em popup.

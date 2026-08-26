# ADR-0007 — Feed privado autenticado e atualização automática do mapa

- **Data:** 25/08/2026
- **Status:** aceito
- **Quem decidiu:** Jorge Yuri (dono)
- **Substitui:** o CSV publicado e a aba `PUBLICAR` como origem do site, descritos no
  ADR-0006; a leitura direta por `doGet` considerada no ADR-0002.
- **Mantém:** publicação sem fila do ADR-0006; minimização, allowlist, denylist e gates do
  ADR-0004; `workflow_dispatch` com privilégio mínimo; site estático do ADR-0001.

## Contexto

O produto precisa fazer uma coisa simples: a pessoa cadastra uma atividade, e o mapa se
atualiza sozinho. O visitante vê somente informação institucional e operacional — grupo,
igreja/organização, atividade, horário, local público, rede social e rota — e procura os
responsáveis fora do site.

O desenho anterior publicava uma aba da planilha como CSV. Embora o formulário não tenha
perguntas de nome, telefone ou e-mail, os campos de texto são livres: alguém ainda pode digitar
um telefone, e-mail ou endereço residencial no lugar errado. Nesse desenho, o Google entregava
o valor cru publicamente **antes** de `ingerir_csv.mjs` recusá-lo. Publicar por engano o documento
inteiro também expunha carimbo de data/hora e o texto livre de pedidos de remoção. O gate
protegia o site, mas não protegia a origem.

Também foram observados dois problemas operacionais:

- o agendamento solicitado a cada 10 minutos levou de 40 a 55 minutos nas medições de
  25/08/2026;
- links curtos do Google Maps não carregam coordenadas no texto original e precisam de uma
  resolução de rede, que não pode se repetir a cada execução.
- `share.google` é um encurtador geral do aplicativo Google: é aceito como entrada, mas só vira
  rota pública quando a cadeia permanece no Google e comprova um resultado de local; páginas e
  imagens compartilhadas pelo mesmo domínio ficam em quarentena.

## Decisão 1 — A planilha nunca é publicada na web

A planilha de respostas permanece privada. Um Web App do Apps Script é a única origem do CI:

- `GET` responde somente um estado de saúde, sem nenhuma célula;
- `POST` com ação e token válidos devolve um envelope JSON de versão 1;
- a projeção é feita por título da pergunta e inclui somente as 12 colunas públicas mais
  `remover`;
- respostas do ramo “corrigir/remover” não têm nome de grupo e não entram no feed;
- erros do endpoint são genéricos e nunca repetem célula ou segredo.

O token vai no corpo do `POST`, não na URL. Ele mora em Propriedades do Script no Google e nos
Environment secrets de `github-pages`, nunca no repositório, no navegador ou em query string.
O dono gera o valor aleatório localmente no gerenciador de senhas (mínimo 32 caracteres,
preferência 64), guarda a referência ali e cadastra manualmente o mesmo valor na Propriedade do
Script e no Environment secret. Assim, `MOV7_FEED_TOKEN` tem exatamente três localizações
autorizadas: o gerenciador de senhas, a Propriedade do Script e o Environment secret
`PLANILHA_FEED_TOKEN`; o Apps Script não gera nem registra o segredo em Logger.
Formulário, planilha e projeto Apps Script permanecem sem colaboradores editores: respondentes
recebem apenas o link público do Form. O CI aceita
somente URL HTTPS `/exec` em `script.google.com`, aplica timeout, limite de tamanho, versão de
schema, largura fixa e teto de linhas. Origem ausente, resposta vazia ou contrato incorreto são
erro estrutural: o deploy é interrompido e o site anterior continua no ar.

Durante a publicação, `moderacao/aprovados.json` e `data/snapshot.json` são reconstruídos no
runner. As respostas não são commitadas ao histórico do Git. Só o pacote mínimo do Pages —
incluindo o snapshot já sanitizado — é publicado.

“Sanitizado” tem um limite declarado. O pipeline detecta telefone, e-mail, CPF/CNPJ e links fora
do campo ou da allowlist. Ele não consegue distinguir automaticamente nome de pessoa de nome de
grupo, nem residência de local público. Esses dois casos são proibidos por instrução no Form e
tratados por remoção rápida quando identificados; não se promete um classificador que não existe.
Rede social e mapa são obrigatórios: se qualquer um estiver ausente ou for inválido, somente esse
cadastro fica em quarentena e o restante da publicação continua.

## Decisão 2 — Cadastro e remoção disparam a publicação

O Apps Script instala dois gatilhos:

- envio do formulário → `aoEnviarFormulario`;
- edição da coluna `remover` → `aoEditarPlanilha`.

Os dois chamam `workflow_dispatch`. O token GitHub é fine-grained, limitado ao repositório, com
validade curta e somente **Actions: read and write**; `repository_dispatch` continua proibido
porque exigiria permissão de conteúdo. Essa permissão é menor que `Contents: write`, mas não é
inofensiva: também permite administrar workflows, execuções, logs e caches. Um token vazado pode
despachar uma branch ou tag existente. Por isso `qa` nunca recebe segredos, enquanto `publish` só
recebe os Environment secrets de `github-pages` quando `github.ref` é exatamente
`refs/heads/main`; o mesmo job executa os gates finais e o deploy.

O CI principal expõe `workflow_call`. O cron de 10 minutos fica isolado em `refresh.yml`, nos
minutos 7, 17, 27, 37, 47 e 57, e chama o workflow principal. A separação evita o minuto zero,
onde a fila agendada é mais sujeita a atraso, e contém a regra de inatividade do GitHub: depois de
60 dias sem atividade, o fallback agendado pode ser desativado, mas `ci.yml` continua ativo para
o `workflow_dispatch` imediato. O cron continua sendo rede de segurança para token vencido,
gatilho com falha ou indisponibilidade transitória.

Na operação normal, a Action leva cerca de 40 segundos e a página procura um snapshot novo a
cada 60 segundos, além de atualizar quando volta ao foco. Assim, a expectativa comunicada é
**cerca de 1 a 2 minutos**. Execuções agendadas bem-sucedidas foram observadas entre 40 e 55
minutos, mas isso é medição, não teto nem SLA: o GitHub pode atrasar ou descartar uma rodada.
Filas do GitHub e cache do Pages são externos. O Pages está confirmado com
`build_type: workflow`; voltar ao modo `legacy`/branch quebraria a garantia de que um gate
vermelho preserva a versão anterior.

## Decisão 3 — Coordenada exata quando verificável; região quando não

O link do Google Maps é obrigatório no formulário. Latitude e longitude presentes na própria URL
ou em uma URL de redirecionamento continuam sendo a fonte preferida. O corpo HTML do Google nunca
é lido: testes reais devolveram a mesma coordenada genérica para lugares diferentes.

Quando um `share.google` comprova um resultado de **local**, mas a cadeia não contém coordenadas,
o nome público desse lugar é pesquisado server-side no endpoint fixo do OpenStreetMap/Nominatim.
A consulta é limitada ao DF e ao Brasil; exige pelo menos dois termos coincidentes no resultado;
usa `User-Agent` identificável; roda no máximo uma vez por segundo; e fica no cache privado por
hash. Isso não é autocomplete nem busca oferecida ao visitante. A atribuição OpenStreetMap já
permanece visível no mapa.

Links curtos são resolvidos com limite de redirecionamentos e tempo. O resultado fica em cache do
GitHub Actions, indexado pelo hash SHA-256 do link; a URL crua não é gravada no cache. Falha de
rede ou ausência de correspondência confiável não impede o resto da publicação: o pin usa o ponto
representativo da região e aparece como posição aproximada. Uma coordenada confirmada fora do polígono do DF coloca o cadastro inteiro
em quarentena: não há rota, pin nem item na lista. Se link e região discordarem dentro do DF,
prevalece a posição do link e o rótulo da região é corrigido.

Vários grupos podem usar a mesma igreja ou parque. Coordenadas repetidas são preservadas; a
interface apenas afasta visualmente marcadores sobrepostos para que todos continuem acessíveis.

## Decisão 4 — O navegador lê somente o snapshot público

O site não conhece o endereço nem o token do feed. Ele busca `data/snapshot.json`, renderiza
texto com `textContent`, oferece uma lista equivalente ao mapa e atualiza periodicamente. Cada
registro informa se a posição é exata ou aproximada. Rede social e rota passam pelas allowlists
de host antes de virar link.

Essa separação mantém as barreiras numa ordem segura:

```text
Google Form → planilha privada → feed privado autenticado → CI e gates
            → snapshot público sanitizado → mapa e lista
```

## Alternativas recusadas

1. **Continuar com CSV “Publicado na web”.** Recusado porque o valor cru fica público antes do
   gate e um clique errado pode publicar colunas não destinadas ao mapa.
2. **Navegador ler Apps Script ou planilha diretamente.** Recusado porque entrega a origem a cada
   visitante, duplica a sanitização no cliente e transforma uma falha de configuração em
   vazamento imediato.
3. **Token na query string de um `GET`.** Recusado porque URLs aparecem em histórico, logs e
   ferramentas de observabilidade.
4. **Descartar coordenadas iguais.** Recusado porque dois grupos legítimos podem se encontrar no
   mesmo local.

## Consequências operacionais

- São necessários dois Environment secrets em `github-pages`: `PLANILHA_FEED_URL` e
  `PLANILHA_FEED_TOKEN`. O ambiente e o código aceitam publicação somente de `main`.
- O Apps Script armazena o `MOV7_FEED_TOKEN` cadastrado manualmente e o
  `MOV7_SPREADSHEET_ID`; o disparo imediato também usa um `GITHUB_TOKEN` fine-grained de validade
  curta. `GITHUB_REPO` é opcional.
- Salvar uma mudança em `scripts/criar_form.gs` não atualiza o Web App implantado. Toda alteração
  exige editar a implantação existente em **Gerenciar implantações**, selecionar **Nova versão**
  e testar ponta a ponta; editar a implantação preserva a URL `/exec`.
- As Actions de terceiros são fixadas por SHA completo e o Dependabot verifica atualizações toda
  semana; uma atualização troca o SHA por pull request, passando pelos mesmos gates.
- Depois do teste ponta a ponta, qualquer publicação antiga existente da aba `PUBLICAR` deve ser
  interrompida no Google Sheets; instalação nova que nunca publicou a planilha não tem essa etapa.
- Trocar ou revogar um token exige atualizar todas as suas localizações autorizadas. No caso do
  feed, gere e guarde o novo valor no gerenciador, depois atualize a Propriedade do Script e o
  Environment secret. Segredos nunca são enviados por chat nem colocados em documentação.
- O procedimento operacional único está em
  [`moderacao/COMO_LIGAR_A_PLANILHA.md`](../../moderacao/COMO_LIGAR_A_PLANILHA.md).

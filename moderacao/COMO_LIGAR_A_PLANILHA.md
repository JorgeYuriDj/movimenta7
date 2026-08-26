# Como ligar a planilha ao site (uma vez, ~20 minutos)

Ao terminar, o fluxo fica automático: a pessoa preenche o formulário, o GitHub confere o
cadastro e o mapa se atualiza normalmente em **cerca de 1 a 2 minutos**. Se o gatilho imediato
falhar, o agendamento pede outra publicação a cada 10 minutos. Nas medições, execuções
agendadas bem-sucedidas começaram depois de 40 a 55 minutos; isso é histórico, não prazo
garantido, porque o GitHub pode atrasar ou descartar uma rodada.

> 🔒 **A planilha fica privada. Não use “Publicar na web”.** O site antigo lia uma aba pública
> em CSV. Esse caminho foi encerrado pelo ADR-0007 porque qualquer texto digitado no campo errado
> ficava exposto antes da checagem automática.

> A checagem reconhece telefone, e-mail, CPF/CNPJ e links fora do lugar. Ela **não consegue
> distinguir nome de pessoa de nome de grupo, nem residência de local público**. Por isso o Form
> manda não escrever nomes pessoais nem endereço de casa; se um aparecer, marque `remover`.

> 🔑 **Formulário, planilha e projeto Apps Script ficam sem colaboradores editores.** Compartilhe
> apenas o link público de resposta. Quem edita o Form também recebe acesso à planilha vinculada,
> e quem edita o projeto consegue ler as Propriedades do Script onde ficam os tokens.

Este procedimento usa o formulário e a planilha já existentes. Se ainda não existirem, rode
`criarFormMovimenta7` de `scripts/criar_form.gs` uma vez; o log entrega o link público do Form e
o link da planilha. Depois continue abaixo, dentro da planilha de respostas.

## 1. Instalar o feed privado no Google

1. Em **Compartilhar** no Form e na planilha, confirme que só a conta dona aparece como editora;
   remova qualquer colaborador antes de guardar os segredos. Isso não muda o link público de
   resposta.
2. Abra o projeto do Apps Script usado para criar o formulário. Se não o encontrar, abra a
   **planilha de respostas** e entre em **Extensões > Apps Script**.
3. No editor do Apps Script, abra **Compartilhar projeto** (ou o botão **Compartilhar**) e
   confirme que somente a conta dona tem acesso de edição. Em projeto vinculado, o acesso pode
   acompanhar o da planilha; em projeto independente, esta é uma lista separada e precisa ser
   conferida aqui.
4. No editor, coloque o conteúdo atual de `scripts/criar_form.gs` e salve.
5. Confirme que está usando o projeto da planilha certa; a função também reconhece a planilha
   guardada quando o formulário foi criado pelo script solto.
6. No seu gerenciador de senhas, gere localmente um segredo aleatório com pelo menos 32 caracteres
   (prefira 64). Em **Configurações do projeto > Propriedades do script**, crie
   `MOV7_FEED_TOKEN` com esse valor. Não use um exemplo deste guia e não coloque o valor em código,
   Logger, chat, issue, commit ou arquivo.
7. Escolha a função **`configurarFeedPrivado`** e clique em **Executar**. Autorize com a conta
   dona da planilha.

Essa função não apaga resposta nem troca segredo existente. Ela:

- identifica e guarda a planilha correta;
- confirma que o segredo criado manualmente existe, sem gerar nem exibir seu valor;
- torna obrigatórios os links do Google Maps e da rede social no formulário;
- atualiza as modalidades comuns e ativa **Outro**, para a pessoa escrever qualquer esporte sem
  perder seu nome no mapa;
- atualiza a mensagem final do cadastro.

O mesmo segredo terá exatamente três localizações autorizadas: o gerenciador de senhas, a
Propriedade do Script `MOV7_FEED_TOKEN` e, na Parte 3, o Environment secret
`PLANILHA_FEED_TOKEN`. Nunca o coloque em outro local. O Registro de execução confirma apenas
que `MOV7_FEED_TOKEN` está configurado; ele nunca deve mostrar o valor.

## 2. Implantar o Web App

1. No Apps Script, clique em **Implantar > Nova implantação**.
2. Em “Selecionar tipo”, escolha **App da Web**.
3. Em “Executar como”, escolha **Eu**.
4. Em “Quem pode acessar”, escolha **Qualquer pessoa**.
5. Clique em **Implantar** e copie a URL terminada em `/exec`.

### Atualizar o Web App quando o código mudar

Salvar ou colar uma versão nova de `scripts/criar_form.gs` **não atualiza a implantação que o
GitHub chama**. Depois da primeira implantação, sempre que esse arquivo mudar:

1. salve o código atualizado no editor;
2. abra **Implantar > Gerenciar implantações**;
3. selecione o Web App ativo e clique em **Editar** (lápis);
4. em **Versão**, escolha **Nova versão** e clique em **Implantar**;
5. confirme que a URL `/exec` continua exatamente a mesma e rode o teste ponta a ponta da Parte 5.

Edite a implantação existente; não crie outra **Nova implantação** para uma simples
atualização. Assim a URL `/exec` é preservada e `PLANILHA_FEED_URL` não precisa mudar. Se a URL
mudar por qualquer motivo, atualize imediatamente esse Environment secret antes de testar.

“Qualquer pessoa” não abre a planilha: sem o token, `GET` mostra apenas que o serviço está vivo e
`POST` responde “acesso negado”. As células só são projetadas para o GitHub com o token correto.

Se o endereço não apareceu no primeiro log, rode `configurarFeedPrivado` de novo após implantar.
O token anterior é preservado.

## 3. Proteger a publicação e guardar os dois segredos no GitHub

O Pages deste repositório já foi confirmado no modo **GitHub Actions** (`build_type: workflow`).
Não troque **Settings > Pages > Source** para “Deploy from a branch”: isso voltaria a publicar um
push sem esperar os gates.

1. Abra <https://github.com/JorgeYuriDj/movimenta7/settings/environments>.
2. Entre no ambiente **`github-pages`**.
3. Em **Deployment branches and tags**, permita somente a branch **`main`**. Não adicione aprovação
   manual: cadastro e remoção precisam continuar automáticos.
4. Em **Environment secrets**, crie os dois segredos abaixo — não use Variables nem Repository
   secrets:

| Nome | Valor |
|---|---|
| `PLANILHA_FEED_URL` | URL `/exec` da implantação |
| `PLANILHA_FEED_TOKEN` | o mesmo valor de `MOV7_FEED_TOKEN`, copiado do gerenciador de senhas |

Cole apenas cada valor, sem aspas ou texto adicional. O workflow falha fechado se um deles
estiver ausente ou errado; o site anterior continua publicado. O job `qa` nunca recebe esses
segredos: somente `publish`, protegido pelo ambiente e limitado a `refs/heads/main`, consegue
ler o feed e publicar. Se os mesmos nomes já existirem em **Repository secrets**, apague essas
cópias depois de um teste verde para manter uma única origem.

## 4. Ligar a publicação imediata

O cron é apenas reserva. Para o cadastro e a remoção aparecerem sem esperar a fila do cron, o
Apps Script precisa poder apertar o botão da Action.

### 4.1 Criar um token GitHub de privilégio mínimo

1. Abra <https://github.com/settings/personal-access-tokens> e gere um token fine-grained.
2. Dê acesso somente ao repositório **movimenta7**.
3. Em permissões do repositório, marque somente **Actions: Read and write**. O `Metadata:
   Read-only` automático é normal.
4. Escolha uma validade curta que você consiga renovar (por exemplo, 90 dias), anote a data de
   vencimento e copie o token uma única vez. Não crie token sem validade.

Não habilite **Contents: write**. A integração usa `workflow_dispatch`, que não precisa escrever
no projeto. Ainda assim, **Actions: write não significa “só apertar um botão”**: se vazar, o token
pode iniciar execuções em refs existentes e administrar workflows, execuções, logs e caches,
inclusive desativá-los. Por isso ele fica restrito a este repositório, vence em prazo curto e deve
ser revogado imediatamente se houver suspeita. O próprio CI recusa segredos e deploy fora de
`main`.

### 4.2 Guardar e testar no Apps Script

1. No Apps Script, abra **Configurações do projeto > Propriedades do script**.
2. Crie `GITHUB_TOKEN` com o token fine-grained como valor.
3. Volte ao editor, escolha **`instalarGatilhoDePublicacao`** e clique em **Executar**.

A função instala, sem duplicar:

- um gatilho para cada resposta do formulário;
- um gatilho para edição da coluna `remover`.

Ela termina pedindo uma publicação real. O log deve confirmar os dois gatilhos e que o GitHub
aceitou o pedido. Acompanhe em
<https://github.com/JorgeYuriDj/movimenta7/actions>.

`GITHUB_REPO` é opcional e só existe para o caso de o projeto mudar de conta. Não é necessário
criá-lo hoje. `MOV7_FEED_TOKEN` é gerenciado manualmente conforme a Parte 1, passo 6;
`MOV7_SPREADSHEET_ID` é gerenciado pelo próprio script.

## 5. Teste ponta a ponta antes de divulgar

1. Abra o site numa janela anônima/privativa, sem nenhuma conta Google conectada, e abra o
   formulário embutido. Ele deve aparecer sem login nem pedido de acesso.
2. Faça um cadastro real. Use o link de compartilhamento do Google Maps para o local público.
   Ao terminar “Dados da atividade”, o Form deve **enviar** a resposta — não abrir a página de
   correção/remoção. Confirme que uma nova linha apareceu na planilha.
3. A Action deve começar logo após o envio. O processamento costuma levar ~40 segundos; com o
   ciclo de atualização da página, espere **cerca de 1 a 2 minutos**.
4. Confirme no site:
   - o grupo aparece no mapa e na lista;
   - modalidade, dia e horário estão certos;
   - a posição aparece como exata ou aproximada de forma honesta;
   - rede social e “Como chegar” abrem o destino correto.
5. Na planilha, marque `remover` nessa linha. A edição deve iniciar outra Action e o grupo deve
   sumir no mesmo ciclo. Desmarque apenas se for um cadastro real que deve permanecer.

Se a Action não começar em 5 minutos, confira Apps Script > **Execuções** e a validade de
`GITHUB_TOKEN`. A resposta não se perde: enquanto o fallback estiver ativo, o cron pede novas
execuções. As rodadas bem-sucedidas medidas começaram em 40 a 55 minutos, mas o GitHub não
oferece prazo máximo para o agendamento e pode atrasar ou descartar uma rodada.

## 6. Encerrar a origem pública antiga

Faça isto **somente depois** de o teste acima passar e **somente se a planilha antiga tiver sido
publicada na web**:

1. Na planilha, abra **Arquivo > Compartilhar > Publicar na web**.
2. Expanda **Conteúdo publicado e configurações**.
3. Clique em **Interromper publicação** e confirme.
4. Se ainda existir `PLANILHA_CSV_URL` nas Variables do GitHub, remova-a quando for conveniente;
   o workflow atual não a usa.

Se não houver conteúdo publicado nem o botão **Interromper publicação**, a origem antiga nunca
foi ligada: pule os passos 1 a 3. A remoção de `PLANILHA_CSV_URL`, se ela existir, continua válida.

Nenhuma fórmula da aba `PUBLICAR` participa mais do site. Ela pode ficar como registro de
migração, mas não deve ser publicada nem usada como fonte.

## O dia a dia

Cadastro novo entra sozinho. Para retirar um grupo, marque `remover` na linha correspondente.
Pedido de correção ou remoção chega pelo mesmo formulário, no ramo separado; ele nunca vira pin.
Para corrigir, marque a linha antiga como `remover` e peça um novo cadastro com os dados certos.

Uma vez por mês, confira:

- Apps Script > **Execuções**: gatilhos sem falhas repetidas;
- GitHub > **Actions**: `ci e publicacao` e `reserva agendada da publicacao` ativos;
- data de validade do token `GITHUB_TOKEN`.

O cron mora sozinho em `.github/workflows/refresh.yml`. O GitHub pode desativar **esse fallback**
após 60 dias sem atividade no repositório; se isso ocorrer, reative “reserva agendada da
publicacao” em Actions. A desativação não atinge `.github/workflows/ci.yml`: os gatilhos imediatos
por `workflow_dispatch` continuam sendo o caminho normal.

## Se der erro

- **“faltam PLANILHA_FEED_URL e/ou PLANILHA_FEED_TOKEN”** — crie os dois Environment secrets no
  ambiente `github-pages`, como na Parte 3.
- **“PLANILHA_FEED_URL precisa ser a URL /exec”** — foi copiado o endereço do editor ou do teste;
  use a URL da implantação, em `script.google.com`, terminada em `/exec`.
- **“feed privado não confirmou o contrato” / “feed indisponível”** — confira se a versão atual
  de `scripts/criar_form.gs` foi salva e reimplantada como **Nova versão da implantação
  existente**, conforme a Parte 2, e se a Propriedade `MOV7_FEED_TOKEN` e o Environment secret
  `PLANILHA_FEED_TOKEN` continuam iguais à referência do gerenciador. Nunca cole o valor no log
  do GitHub.
- **`AVISO: linha N ...`** — só aquele cadastro ficou fora. A mensagem identifica campo e motivo,
  nunca o conteúdo.
- **`INGESTAO ABORTADA`, `PUBLICACAO ABORTADA` ou `SNAPSHOT REPROVADO`** — nada novo subiu; a
  versão anterior do site permaneceu intacta.
- **401/403 ao instalar o gatilho** — o token GitHub venceu ou não tem `Actions: Read and write`.
- **404** — o token não tem acesso ao repositório ou o nome foi alterado.
- **422** — `workflow_dispatch` foi removido do workflow ou o branch configurado não existe.

Segredos são corrigidos apenas nas telas do Apps Script e do GitHub. Nunca os coloque em issue,
commit, arquivo do projeto ou conversa.

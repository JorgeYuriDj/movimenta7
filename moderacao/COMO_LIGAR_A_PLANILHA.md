# Como ligar a planilha ao site (uma vez só, ~15 minutos)

Depois disto, **você não faz mais nada**: quem preencher o formulário aparece no mapa
sozinho, em **cerca de 2 minutos**.

São 5 partes. Faça na ordem. A primeira é a única que dá algum trabalho, e mesmo
essa é: copiar, colar, clicar em executar.

> **Ficou bem mais curto do que era.** Duas coisas sumiram do guia. A segunda planilha
> (IMPORTRANGE) existia só para isolar as colunas privadas — o formulário deixou de
> coletar dado pessoal (ADR-0006), então não há mais o que isolar. E a fórmula gigante
> que você colava a mão agora é montada pelo próprio script: era o passo com mais chance
> de dar errado no lançamento inteiro, por três motivos que sumiram junto com ele (o nome
> da aba de respostas muda conforme o idioma da conta, a fórmula era escrita com `;` ou
> `,` conforme o idioma da planilha, e os nomes das perguntas eram repetidos a mão).

---

## Parte 1 — Criar o formulário e a planilha (~5 minutos)

Um script faz tudo: cria o formulário novo, cria a planilha de respostas, acrescenta a
coluna `remover` (sua caixinha de emergência) e monta a aba **PUBLICAR** já pronta.

1. Abra https://script.google.com → **Novo projeto**.
2. Apague o `function myFunction() {}` que vem de exemplo e **cole o conteúdo inteiro de
   `scripts/criar_form.gs`**. Salve (ícone do disquete).
3. Em cima, escolha a função **`criarFormMovimenta7`** e clique em **Executar**.
   Ele vai pedir autorização na primeira vez — é a sua própria conta autorizando o seu
   próprio script. Aceite.
4. No painel de baixo (**Registro de execução**) aparecem os endereços. **Me mande o do
   meio, "Form (PUBLICAR ESTE)"** — é ele que vai no site.

Se der tudo certo, o log termina com duas linhas começando em `OK:`. Se aparecer
`ATENCAO`, rode a mesma função de novo (nada é apagado); se falhar duas vezes, me avise.

> O formulário antigo e as respostas dele **continuam existindo**, intactos. Nada é
> apagado. Só paramos de usá-los. O seu cadastro de 24/08 está lá — com o formulário novo
> você precisa preencher de novo, leva 2 minutos.

**Abra a planilha e confira** (10 segundos): a aba **PUBLICAR** tem que mostrar os 13
títulos na linha 1 — `grupo`, `organizacao`, ..., `remover`. Estar vazia embaixo é o
certo: ainda não há cadastro nenhum.

---

## Parte 2 — Publicar a aba PUBLICAR na web

1. **Arquivo > Compartilhar > Publicar na web**
2. à esquerda escolha a **aba PUBLICAR** — **não** deixe em "Documento inteiro"
3. à direita escolha **Valores separados por vírgula (.csv)**
4. clique em **Publicar** e **copie o endereço** que aparecer

> Se escolher "Documento inteiro" por engano, o site **não** publica nada errado: a
> ingestão vê colunas que não deviam existir, para, e o site anterior continua no ar.
> A mensagem no log diz exatamente isso.

---

## Parte 3 — Colar o endereço no GitHub

1. Abra: https://github.com/JorgeYuriDj/movimenta7/settings/variables/actions
2. Botão **New repository variable**
3. No campo **Name**, escreva: `PLANILHA_CSV_URL`
4. No campo **Value**, cole **o endereço que o Google te deu na Parte 2** — e só ele.
   Ele começa com `https://docs.google.com/` e termina com `output=csv`.
   ⚠️ Não escreva as palavras "Value" nem "o endereço": é só a URL, nada mais.
   (Aconteceu em 25/08: o texto deste passo foi colado no lugar da URL. Hoje a
   ingestão detecta e explica no log, em vez de estourar um erro incompreensível.)
5. **Add variable**

Pronto. O primeiro pin aparece em **até 1 hora** — e é exatamente isso que a Parte 4,
logo abaixo, derruba para cerca de 2 minutos.

---

## Parte 4 — Publicar na hora, sem esperar (~5 minutos)

**Por que esta parte existe.** Até aqui, o site só descobre um cadastro novo quando o
robô do GitHub acorda sozinho. Ele está configurado para acordar a cada 10 minutos, mas
o GitHub põe tarefa agendada de projeto público numa fila lenta: **medimos em 25/08, cinco
vezes seguidas — 40, 47, 43 e 55 minutos.** Não dá para acelerar essa fila; nós já pedimos
o mínimo. O que dá é **avisar o robô na hora**, em vez de esperar ele perguntar. É isso
que você vai ligar agora: o formulário passa a cutucar o GitHub a cada resposta recebida.

O relógio não vai a zero — a publicação em si leva ~40 segundos, e antes disso o Google
precisa de um minutinho para republicar a planilha. **Na prática: cerca de 2 minutos.**

### 4.1 — Criar a chave no GitHub

1. Abra https://github.com/settings/personal-access-tokens → botão **Generate new token**.
2. **Token name:** `movimenta7 publicar na hora`
3. **Expiration:** escolha a data mais longa que ele oferecer. ⚠️ Anote essa data: quando
   a chave vencer, o mapa **não quebra** — ele só volta a demorar até 1 hora, e você
   refaz esta parte. (É de propósito: veja "a rede de segurança", no fim.)
4. **Repository access:** marque **Only select repositories** e escolha **movimenta7**.
5. **Permissions > Repository permissions:** procure **Actions** na lista e mude para
   **Read and write**. **Só essa.** Se aparecer sozinho um **Metadata: Read-only**, é
   normal, pode deixar.
   > 🔒 **Por que só "Actions".** Existe um caminho mais óbvio para fazer isso que exige a
   > permissão **Contents**, que é permissão de **escrever no projeto** — e neste projeto
   > o site *é* o projeto. Uma chave dessas, se vazasse, poderia trocar o conteúdo do
   > site. A permissão **Actions** só sabe apertar o botão de publicar o que já existe.
   > No pior caso, alguém republica o site igualzinho ao que ele já era.
6. **Generate token** e **copie a chave**. O GitHub mostra **uma vez só**.

### 4.2 — Guardar a chave no seu Google (nunca no projeto)

⚠️ A chave **não pode** ser colada em nenhum arquivo do projeto: ele é público, qualquer
pessoa lê. Ela mora na sua conta do Google, onde só você entra.

1. Abra a **planilha de respostas** → **Extensões > Apps Script**.
2. Se o editor estiver vazio, cole o conteúdo inteiro de `scripts/criar_form.gs` e salve.
3. Na barra da esquerda, clique na engrenagem **Configurações do projeto**.
4. Desça até **Propriedades do script** → **Adicionar propriedade do script**. Crie **duas**:

   | Propriedade | Valor |
   |---|---|
   | `GITHUB_TOKEN` | a chave que você copiou no passo 4.1 |
   | `PLANILHA_CSV_URL` | o **mesmo endereço** da Parte 2 (o que termina em `output=csv`) |

   ⚠️ Cole **só** a chave e **só** o endereço — sem espaço antes, sem linha em branco
   depois. (O script tira sobra de espaço sozinho, mas não conte com isso.)
5. **Salvar propriedades do script**.

> A segunda propriedade é o que faz o robô esperar a planilha ficar pronta antes de
> publicar. Sem ela funciona, só que às vezes o site atualiza **um segundo antes** de o
> cadastro novo aparecer — e aí a pessoa vê o mapa mudar sem ela dentro.
>
> Existe uma terceira, `GITHUB_REPO`, que **você não precisa criar**: ela só serve se um
> dia o projeto mudar de conta no GitHub. Sem ela, o script usa `JorgeYuriDj/movimenta7`.

### 4.3 — Ligar o gatilho

1. Volte para o editor (**< >**, na barra da esquerda).
2. Em cima, escolha a função **`instalarGatilhoDePublicacao`** e clique em **Executar**.
3. O Google vai pedir autorização de novo — agora ele precisa de duas coisas novas:
   falar com um serviço externo (o GitHub) e criar um gatilho. Aceite.
4. No **Registro de execução** têm que aparecer **três** linhas começando com `OK:`.
   A última traz um endereço — abra e veja a publicação **rodando agora**.

Se aparecer erro em vermelho, ele está **escrito em português e diz o que fazer**
(chave vencida, permissão faltando, nome do projeto errado). Rodar a função de novo é
seguro: ela nunca cria um segundo gatilho e nunca apaga nada.

### A rede de segurança (não desligue)

O robô continua acordando sozinho de tempos em tempos, **de propósito**. O Google desativa
gatilho que falha muito, e chave de acesso vence na data marcada — as duas coisas
acontecem **caladas**. Com a rede ligada, o pior caso é o site voltar a demorar até 1 hora.
Sem ela, o pior caso é o site parar de atualizar e ninguém perceber.

**Como saber se o gatilho parou:** Apps Script → **Execuções**, na barra da esquerda.
Cada cadastro deveria ter uma linha verde. Falha manda um e-mail para você automaticamente.

---

## Parte 5 — O teste antes de divulgar (~10 minutos, faça COM o Claude)

**Não mande o link para os grupos antes disto.** O caminho planilha → site nunca rodou
com dado de verdade; rodou só contra uma planilha simulada. Um erro que só aparece com
dado real vira, sem esse teste, um site quebrado na frente de todo mundo ao mesmo tempo.

1. Preencha **1 cadastro de verdade** pelo formulário novo (pode ser o seu grupo).
2. Espere **cerca de 2 minutos** e acompanhe em Actions > **ci e publicacao**: com a
   Parte 4 ligada, a publicação começa sozinha logo depois de você apertar "Enviar".
   (Se não começar em 5 minutos, o gatilho não está ligado — volte à Parte 4. O cadastro
   não se perde: ele entra na rodada automática, em até 1 hora.)
3. Confira no site: o pin apareceu na região certa? O popup mostra os dados certos?
   O link do Instagram e o do Maps abrem no lugar certo?
4. Marque `remover` na sua linha e confira que ele **some** na rodada seguinte. Depois
   desmarque. Isso testa o seu freio de emergência antes de você precisar dele de verdade.

Só depois disso o link vai para os grupos.

---

## O dia a dia, a partir de agora

**Nada.** Cadastro novo entra sozinho, em cerca de 2 minutos (Parte 4). E, mesmo que o
gatilho falhe, o robô ainda acorda por conta própria e publica em até 1 hora.

As duas únicas coisas que você faz, e só quando precisar:

- **Tirar um grupo do ar:** marque a caixinha `remover` na linha dele. ⚠️ Isto é uma
  edição **na planilha**, não uma resposta do formulário — então o gatilho da Parte 4
  **não** dispara, e ele sai na rodada automática, em **até 1 hora**. Para tirar na hora:
  Actions > **ci e publicacao** > **Run workflow** (~40 segundos).
- **Pedido de correção ou remoção que chegou pelo formulário:** as respostas caem na aba
  de respostas, na parte de baixo (as perguntas da página 2 do formulário). Marque
  `remover` na linha do grupo citado. Se for correção, peça para a pessoa cadastrar de
  novo com o dado certo e marque `remover` na linha antiga.

## 🛑 O mapa está vazio mesmo com gente cadastrada (25/08/2026)

Isto aconteceu de verdade, e é a falha mais traiçoeira do projeto: **tudo parece certo**.
O CI fica verde, o endereço do CSV está publicado, o site está no ar — e o mapa não tem
nenhum pin, com cadastros preenchidos na planilha.

**O que acontece:** a aba PUBLICAR é montada por uma fórmula que lê a aba de respostas.
O Google Forms grava cada resposta **inserindo uma linha**, e inserir linha **empurra a
fórmula para baixo junto**. Ela nasceu apontando para a linha 2, virou linha 3 no primeiro
cadastro e linha 4 no segundo — sempre uma linha ABAIXO da resposta mais nova. Ou seja:
ela nunca mais acha nada, e vai piorando a cada pessoa que se cadastra.

**Como saber se é isso:** abra a aba **PUBLICAR**. Se a linha 1 tem os títulos
(`grupo`, `organizacao`, …) e da linha 2 para baixo está **vazio**, enquanto a aba de
respostas tem cadastros — é isto.

### O conserto (1 minuto, escolha UM dos dois)

**Jeito curto — colar uma fórmula:** na aba **PUBLICAR**, clique na célula **A2**, apague
o que estiver lá e cole a fórmula que está em `scripts/PUBLICAR_A2.txt` (neste repositório).
Os cadastros aparecem na hora.

> ⚠️ A fórmula do arquivo usa o nome `'Form Responses 1'` para a aba de respostas. Se a sua
> aba tiver outro nome (ex.: `Respostas ao formulário 1`), troque **os dois nomes** dentro da
> fórmula — ou use o jeito de baixo, que descobre o nome sozinho.

**Jeito à prova de nome — rodar o script:** na **planilha**, menu **Extensões > Apps Script**,
apague o que estiver lá, cole o conteúdo de `scripts/criar_form.gs`, escolha
**`consertarAbaPublicar`** na lista de funções e clique em **Executar**. Ele acha a aba de
respostas sozinho, remonta a PUBLICAR e **não cria formulário novo**.

Nos dois casos: **não precisa republicar o CSV** nem mexer no GitHub. O site pega na próxima
rodada (até 1 hora) — ou na hora, se você for em Actions > **ci e publicacao** > **Run workflow**.

**Por que não vai voltar a acontecer:** a fórmula agora lê **colunas inteiras**, que não têm
número de linha para ser empurrado. `tests/criar_form.test.mjs` reprova o build se alguém
reintroduzir a versão com linha fixa.

## Se der erro

O erro vem escrito em português no log do GitHub (Actions > **ci e publicacao**). Os mais
prováveis:

- **"o CSV tem coluna(s) que nao deveriam existir"** — você publicou o documento inteiro
  em vez de só a aba. Volte na Parte 2, item 2.
- **"a planilha respondeu 404"** — a publicação foi desfeita. Republique (Parte 2).
- **"NAO publicada — valor com cara de telefone"** — alguém escreveu um telefone num
  campo. **Esse cadastro sozinho** não entra; o resto do mapa continua normal. O log diz
  a linha e o campo, e **nunca** mostra o conteúdo (o log é público).
- **"nao e um endereco aceito"** — o link não é de rede social nem de mapa. O grupo entra
  no mapa assim mesmo, só que sem o link.

> **O mapa parou de atualizar sozinho depois de meses?** O GitHub desliga tarefas
> agendadas após 60 dias sem movimento no repositório. Vá em Actions > **ci e publicacao**
> e clique em **Enable workflow**.

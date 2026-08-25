# Como ligar a planilha ao site (uma vez só, ~10 minutos)

Depois disto, **você não faz mais nada**: quem preencher o formulário aparece no mapa
sozinho, em cerca de 10 minutos.

São 3 partes. Faça na ordem. A primeira é a única que dá algum trabalho, e mesmo
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

Pronto. Em até 10 minutos o primeiro pin aparece.

---

## Parte 4 — O teste antes de divulgar (~10 minutos, faça COM o Claude)

**Não mande o link para os grupos antes disto.** O caminho planilha → site nunca rodou
com dado de verdade; rodou só contra uma planilha simulada. Um erro que só aparece com
dado real vira, sem esse teste, um site quebrado na frente de todo mundo ao mesmo tempo.

1. Preencha **1 cadastro de verdade** pelo formulário novo (pode ser o seu grupo).
2. Espere a rodada seguinte (até ~10 minutos) — Actions > **ci e publicacao**.
3. Confira no site: o pin apareceu na região certa? O popup mostra os dados certos?
   O link do Instagram e o do Maps abrem no lugar certo?
4. Marque `remover` na sua linha e confira que ele **some** na rodada seguinte. Depois
   desmarque. Isso testa o seu freio de emergência antes de você precisar dele de verdade.

Só depois disso o link vai para os grupos.

---

## O dia a dia, a partir de agora

**Nada.** O site se atualiza sozinho a cada ~10 minutos.

As duas únicas coisas que você faz, e só quando precisar:

- **Tirar um grupo do ar:** marque a caixinha `remover` na linha dele. Sai na rodada
  seguinte, em até ~10 minutos.
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

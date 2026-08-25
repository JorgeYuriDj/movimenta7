# Como ligar a planilha ao site (uma vez só, ~10 minutos)

Depois disto, **você não faz mais nada**: quem preencher o formulário aparece no mapa
sozinho, em cerca de 10 minutos.

São 3 partes. Faça na ordem.

> **Ficou mais curto do que era.** A versão anterior tinha uma segunda planilha só para
> isolar as colunas privadas (seu nome, seu WhatsApp). O formulário deixou de coletar
> esses dados (ADR-0006), então não há mais o que isolar — e o passo mais confuso do
> guia sumiu junto.

---

## Parte 0 — Criar o formulário novo (se ainda não criou)

O formulário mudou: não pede mais nome nem telefone, pede o @ da rede social e o link do
Google Maps, e tem uma página separada para pedidos de remoção.

1. Abra https://script.google.com → **Novo projeto**.
2. Cole o conteúdo de `scripts/criar_form.gs` e salve.
3. Execute a função `criarFormMovimenta7` (autorize quando ele pedir).
4. No log aparecem 3 endereços. **Guarde os dois primeiros** e me mande o do meio
   ("Form (PUBLICAR ESTE)") — é ele que vai no site.

> O formulário antigo e as respostas dele **continuam existindo**, intactos. Nada é
> apagado. Só paramos de usá-los.

---

## Parte 1 — Criar a aba PUBLICAR

Na planilha de respostas (`movimenta7 — respostas`):

1. Na aba de respostas, crie **uma coluna nova à direita de tudo**, com o cabeçalho
   exatamente `remover` — vá em **Inserir > Caixa de seleção**.
   É o seu botão de emergência: marcou, o grupo sai do mapa na rodada seguinte.

2. Crie uma aba nova chamada exatamente **PUBLICAR** (menu `+` embaixo).

3. Na célula **A1** da aba PUBLICAR, cole isto **inteiro, de uma vez só**:

```
={"grupo","organizacao","regiao","modalidades","dias","horario","local","rede_social","mapa","orientacao_profissional","custo","publico","remover";
IFERROR(FILTER({
 INDEX(Respostas!$A:$ZZ;0;MATCH("Nome do grupo";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Igreja ou organização responsável";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Região administrativa (DF)";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Modalidade(s)";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Dia(s) da semana";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Horário de início (ex.: 06h30)";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Local do encontro (ponto público — parque, quadra, portão da igreja)";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("@ do Instagram ou link da rede social da igreja/grupo";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Link do Google Maps do local do encontro";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Tipo de atividade";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Custo";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Aberta a quem?";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("remover";Respostas!$A$1:$ZZ$1;0))
};INDEX(Respostas!$A:$ZZ;0;MATCH("Nome do grupo";Respostas!$A$1:$ZZ$1;0))<>"");"")}
```

> Se a sua aba de respostas **não** se chama `Respostas`, troque `Respostas!` pelo nome
> certo em todos os lugares (o Google mostra o nome na abinha de baixo).

**O `<>""` do final não é enfeite.** Ele deixa de fora as linhas de *pedido de remoção*,
que respondem outras perguntas e têm o "Nome do grupo" vazio. Sem ele, um pedido para
tirar um grupo do mapa entraria como grupo novo.

**Por que a fórmula é feia assim:** ela procura cada coluna **pelo nome do cabeçalho**, não
pela letra. Se um dia você inserir uma coluna no meio, tudo continua certo. Se fosse por
letra (`A:M`), inserir uma coluna faria a resposta errada aparecer no campo errado — com o
cabeçalho certo por cima, e ninguém perceberia.

**Confira agora:** a aba PUBLICAR tem que mostrar os títulos na linha 1. Se aparecer
`#REF!`, algum nome de pergunta está diferente — compare com o texto exato do formulário.

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
3. Name: `PLANILHA_CSV_URL`
4. Value: o endereço que você copiou
5. **Add variable**

Pronto. Em até 10 minutos o primeiro pin aparece.

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

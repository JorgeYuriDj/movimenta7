# Como ligar a planilha ao site (uma vez só, ~15 minutos)

Depois disto, publicar um grupo vira: **marcar uma caixinha** e o pin aparece.
Você nunca mais copia campo à mão.

São 3 partes. Faça na ordem.

---

## Parte 1 — Criar a aba PUBLICAR na planilha das respostas

Na planilha **privada** (a que recebe as respostas do formulário):

1. Na aba de respostas, crie duas colunas novas **à direita de tudo**:
   - `aprovado` — vá em **Inserir > Caixa de seleção**
   - `remover` — também caixa de seleção

2. Crie uma aba nova chamada exatamente **PUBLICAR** (menu `+` embaixo).

3. Na célula **A1** da aba PUBLICAR, cole isto **inteiro, de uma vez só**:

```
={"grupo","organizacao","regiao","modalidades","dias","horario","local","contato","orientacao_profissional","custo","publico","aprovado","remover";
IFERROR(FILTER({
 INDEX(Respostas!$A:$ZZ;0;MATCH("Nome do grupo";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Igreja ou organização responsável";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Região administrativa (DF)";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Modalidade(s)";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Dia(s) da semana";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Horário de início (ex.: 06h30)";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Local do encontro (ponto público — parque, quadra, portão da igreja)";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Contato PÚBLICO do grupo (link de grupo do WhatsApp ou @ do Instagram)";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Tipo de atividade";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Custo";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("Aberta a quem?";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("aprovado";Respostas!$A$1:$ZZ$1;0)),
 INDEX(Respostas!$A:$ZZ;0;MATCH("remover";Respostas!$A$1:$ZZ$1;0))
};INDEX(Respostas!$A:$ZZ;0;MATCH("aprovado";Respostas!$A$1:$ZZ$1;0))=TRUE);"")}
```

> Se a sua aba de respostas **não** se chama `Respostas`, troque `Respostas!` pelo nome
> certo em todos os lugares (o Google mostra o nome na abinha de baixo).

**Por que a fórmula é feia assim:** ela procura cada coluna **pelo nome do cabeçalho**, não
pela letra. Se um dia você inserir uma coluna no meio, tudo continua certo. Se fosse por
letra (`A:M`), inserir uma coluna faria o WhatsApp pessoal de alguém aparecer no lugar do
contato público — com o cabeçalho certo por cima, e ninguém perceberia.

**Confira agora:** a aba PUBLICAR tem que mostrar os títulos na linha 1 e **nenhuma linha
embaixo** (porque você ainda não marcou nenhuma caixinha). Se aparecer `#REF!`, algum nome
de pergunta está diferente — compare com o texto exato do formulário.

---

## Parte 2 — A segunda planilha (a que vai para a internet)

**Não pule esta parte.** É ela que garante que seu nome e seu WhatsApp não podem vazar.

1. Crie uma planilha **nova**, em branco, chamada `movimenta7 — público`.
2. Na célula **A1** dela, cole (trocando `ID_DA_PLANILHA_PRIVADA`):

```
=IMPORTRANGE("ID_DA_PLANILHA_PRIVADA";"PUBLICAR!A:M")
```

> O ID é o pedaço embolado do endereço da planilha privada, entre `/d/` e `/edit`.

3. Vai aparecer um botão **"Permitir acesso"**. Clique.

**Por que duas planilhas:** na tela de publicar, o Google deixa marcado
**"Documento inteiro"** por padrão. Um clique errado publicaria **todas as abas** — inclusive
os nomes e WhatsApps pessoais — num endereço aberto, sem senha. Como a segunda planilha
**não tem** essas colunas, o pior que pode acontecer é publicar o que já era público.

4. Nessa segunda planilha: **Arquivo > Compartilhar > Publicar na web**
   - à esquerda escolha a **aba** (não "Documento inteiro")
   - à direita escolha **Valores separados por vírgula (.csv)**
   - clique em **Publicar** e **copie o endereço** que aparecer

---

## Parte 3 — Colar o endereço no GitHub

1. Abra: https://github.com/JorgeYuriDj/movimenta7/settings/variables/actions
2. Botão **New repository variable**
3. Name: `PLANILHA_CSV_URL`
4. Value: o endereço que você copiou
5. **Add variable**

Pronto. Está ligado.

---

## O dia a dia, a partir de agora

1. Chegou cadastro novo → você olha na planilha privada.
2. Está tudo certo? **Marque a caixinha `aprovado`.**
3. Vá em https://github.com/JorgeYuriDj/movimenta7/actions → **ci e publicacao** →
   **Run workflow**. Em ~2 minutos o pin está no mapa.
4. Precisa tirar um grupo do ar? Marque `remover` e repita o passo 3.

## Se der erro

O erro vem escrito em português no log. Os dois mais prováveis:

- **"o CSV tem coluna(s) que nao deveriam existir"** — você publicou o documento inteiro
  em vez de só a aba. Volte na Parte 2, item 4, e escolha a aba.
- **"a planilha respondeu 404"** — a publicação foi desfeita. Republique (Parte 2, item 4).

⚠️ **A publicação do Google demora até ~5 minutos para atualizar.** Se você marcou a
caixinha e o pin não apareceu, espere 5 minutos e rode de novo.

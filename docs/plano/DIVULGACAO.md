# Divulgação — o que mandar para os grupos

> **Escrito em 25/08/2026.** Substitui a seção "Divulgação" do
> [`LANCAMENTO_DIA1.md`](LANCAMENTO_DIA1.md), que é um documento datado de 23/08 e descreve o
> desenho antigo — fila de aprovação `APROVADO=SIM`, botão de WhatsApp, planilha privada com nome
> e telefone. Aquele desenho acabou no
> [ADR-0006](../adr/0006-publicacao-automatica-sem-dado-pessoal.md).
>
> **Por que este arquivo existe:** a mensagem pronta de lá trazia um aviso de privacidade que hoje
> é falso — *"seu nome e telefone pessoais ficam privados com a moderação"* — sendo que o
> formulário não pede nem uma coisa nem outra, e moderação não existe mais. Quem colasse aquilo num
> grupo estaria prometendo, em nome do projeto, algo que o projeto não faz. **Use este arquivo, não
> aquele.**

## Antes de mandar o link — 2 coisas, nesta ordem

1. **A variável `PLANILHA_CSV_URL` no GitHub precisa estar com a URL certa.**
   Enquanto não estiver, ninguém aparece no mapa. Passo a passo:
   [`moderacao/COMO_LIGAR_A_PLANILHA.md`](../../moderacao/COMO_LIGAR_A_PLANILHA.md), Parte 3.
2. **O teste com 1 cadastro real** (Parte 4 do mesmo guia). O caminho planilha → site nunca rodou
   com dado de verdade. Erro que só aparece com dado real, sem esse teste, aparece na frente de
   todo mundo ao mesmo tempo.

Site: https://jorgeyuridj.github.io/movimenta7/ ·
Formulário: https://docs.google.com/forms/d/e/1FAIpQLSfWpfsteBTzJ3_d4Y-JQjlb4IBl3ep9QM4m8KpWwWDYK0MO2A/viewform

## A mensagem pronta (grupos de WhatsApp)

> 🏃‍♀️🚴‍♂️ Está nascendo o **movimenta7** — o mapa das atividades físicas da comunidade
> adventista do DF, aberto a toda Brasília.
>
> Sua igreja tem grupo de corrida, caminhada, vôlei, ciclismo, funcional ou trilha?
> **Cadastre em 2 minutos e o grupo entra no mapa sozinho, em até 1 hora** — não tem
> fila, não tem aprovação, não tem ninguém no meio.
>
> 📋 Cadastrar: [LINK DO FORMULÁRIO]
> 🗺️ Ver o mapa: https://jorgeyuridj.github.io/movimenta7/
>
> O cadastro **não pede nenhum dado pessoal** — nem nome, nem telefone, nem e-mail. É só sobre a
> atividade: modalidade, região, dia, horário, local de encontro e o @ da rede social da igreja.
> Tudo o que você preencher é público no mapa. 💚

**O que mudar à vontade:** emoji, saudação, ordem. **O que não mudar:** as duas frases sobre não
pedir dado pessoal e sobre tudo virar público. Elas são a promessa que o site faz por escrito em
[`index.html`](../../index.html) — se a divulgação prometer diferente, é o site que vira mentira.

## Instagram (stories + bio)

Story: print do mapa + "o mapa das atividades físicas da comunidade adventista do DF está no ar —
cadastre o grupo da sua igreja, link na bio". Bio: o link do formulário.

**Preview do link:** o que aparece quando o link é colado no WhatsApp é a primeira tela do produto.
**Já existe** — `assets/og-image.png`, 1200×630, servida e conferida por HTTP em 25/08. Não precisa
fazer nada.

## Canais e meta

Grupos de WhatsApp de igrejas/regionais · Instagram · mensagem direta para líderes de ~10 igrejas.
Meta da semana: **15 atividades reais**. Número publicado no site é sempre o real — o contador lê
o mapa, não um número escolhido.

## As 4 perguntas que vão te fazer — respostas prontas

**"Quem aprova o meu cadastro?"**
Ninguém. Uma checagem automática confere que não passou dado pessoal nem link estranho, e o grupo
entra no mapa na rodada seguinte — em até 1 hora.

**"Cadastrei e não apareceu."**
Três causas, nesta ordem: (1) ainda não passou 1 hora; (2) a pessoa usou o **formulário
antigo** — ele continua ativo e ainda recebe respostas, mas elas nunca chegam ao mapa, então é
refazer no link novo; (3) a checagem recusou o cadastro por ter telefone, e-mail ou nome de pessoa
em algum campo — o log do GitHub diz a linha e o campo, nunca o conteúdo.

**"Quero sair do mapa."**
Mesmo formulário, opção "corrigir ou remover". Sai em até 24 horas. Você também tira na hora:
marque a caixinha `remover` na linha do grupo, na planilha.

**"Vocês guardam meus dados?"**
Não há dado pessoal para guardar. O que é preenchido é sobre a atividade e sobre a
igreja/organização, e é tudo público no mapa desde o primeiro minuto.

## O que NÃO prometer

- ❌ "seus dados ficam protegidos com a moderação" — não existe moderação, e não existe dado
  pessoal coletado. Prometer sigilo de uma coisa que não é coletada convida a pessoa a escrever
  o telefone no campo errado.
- ❌ "a organização confere cada cadastro antes de publicar" — não confere. Quem cadastra é
  responsável pelo que escreveu, e o site diz isso.
- ❌ agenda, lista com filtros, selo de confirmação, equipe nas corridas de rua — ainda não
  existem. Ver as Fases 1 e 2 do [`PLANO_EXECUCAO.md`](PLANO_EXECUCAO.md).

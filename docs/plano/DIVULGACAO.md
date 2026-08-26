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

> **Atualização de 25/08/2026:** o
> [ADR-0007](../adr/0007-feed-privado-e-atualizacao-automatica.md) tornou a origem privada de
> ponta a ponta. Não publique aba em CSV; use os dois Environment secrets do feed autenticado.

## Antes de mandar o link — 2 coisas, nesta ordem

1. **`PLANILHA_FEED_URL` e `PLANILHA_FEED_TOKEN` precisam existir como Environment secrets do
   ambiente `github-pages`.** Não use Repository secrets nem Variables. A planilha continua
   privada. Passo a passo:
   [`moderacao/COMO_LIGAR_A_PLANILHA.md`](../../moderacao/COMO_LIGAR_A_PLANILHA.md), Partes 1–4.
2. **O teste com 1 cadastro real** (Parte 5 do mesmo guia). O caminho planilha → site nunca rodou
   com dado de verdade. Erro que só aparece com dado real, sem esse teste, aparece na frente de
   todo mundo ao mesmo tempo.

Site: https://jorgeyuridj.github.io/movimenta7/ ·
Formulário: https://docs.google.com/forms/d/e/1FAIpQLSfWpfsteBTzJ3_d4Y-JQjlb4IBl3ep9QM4m8KpWwWDYK0MO2A/viewform

## A mensagem pronta (grupos de WhatsApp)

> 🏃‍♀️🚴‍♂️ Está nascendo o **movimenta7** — o mapa das atividades físicas da comunidade
> adventista do DF, aberto a toda Brasília.
>
> Sua igreja tem grupo de corrida, caminhada, vôlei, ciclismo, funcional ou trilha?
> **Cadastre em 2 minutos e acompanhe o mapa: normalmente o grupo aparece em cerca de 1 a 2
> minutos** — não tem fila nem aprovação. Se o gatilho estiver indisponível, o agendamento
> continua tentando, mas não tem prazo garantido pelo GitHub.
>
> 📋 Cadastrar: [LINK DO FORMULÁRIO]
> 🗺️ Ver o mapa: https://jorgeyuridj.github.io/movimenta7/
>
> O cadastro **não pede nenhum dado pessoal** — nem nome, nem telefone, nem e-mail. É só sobre a
> atividade: modalidade, região, dia, horário, local de encontro e o @ da rede social da igreja.
> Os dados válidos sobre a atividade ficam públicos no mapa. Não escreva nome de pessoa,
> telefone, e-mail ou endereço de casa. 💚

**O que mudar à vontade:** emoji, saudação, ordem. **O que não mudar:** as duas frases sobre não
pedir dado pessoal e sobre os dados da atividade virarem públicos. Elas são a promessa que o site faz por escrito em
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
Ninguém. Uma checagem automática barra telefone, e-mail, CPF/CNPJ e links fora dos campos ou
destinos permitidos. O normal é aparecer em cerca de 1 a 2 minutos. No fallback, execuções
agendadas bem-sucedidas foram medidas entre 40 e 55 minutos, mas o GitHub não oferece prazo
máximo.

**"Cadastrei e não apareceu."**
Três causas, nesta ordem: (1) a publicação ainda está rodando — espere 2 minutos e atualize; se o
gatilho falhar, o agendamento continua tentando, mas pode atrasar ou descartar uma rodada; (2) a
pessoa usou o **formulário antigo** — ele continua ativo e ainda recebe respostas, mas elas nunca
chegam ao mapa, então é refazer no link novo; (3) a checagem recusou o cadastro por telefone,
e-mail, CPF/CNPJ, URL no
campo errado ou informação obrigatória ausente — o log do GitHub diz a linha e o campo, nunca o
conteúdo.

**"Quero sair do mapa."**
Mesmo formulário, opção “corrigir ou remover”. O responsável marca `remover` na planilha e a
retirada normalmente aparece em cerca de 1 a 2 minutos; o prazo de atendimento informado ao
público continua sendo até 24 horas.

**"Vocês guardam meus dados?"**
O formulário não pede dado pessoal. O que é preenchido é sobre a atividade e a
igreja/organização e vira público somente depois das checagens. Se alguém digitar dado pessoal no
campo errado, a planilha privada evita uma origem pública paralela. Telefone, e-mail e CPF/CNPJ
são barrados; nome pessoal e residência não são distinguíveis automaticamente de nome de grupo e
local público, por isso são proibidos no Form e removidos quando identificados.

## O que NÃO prometer

- ❌ "seus dados ficam protegidos com a moderação" — não existe fila de moderação, e o
  formulário não pede dado pessoal. Prometer uma revisão humana que não existe convida a pessoa
  a escrever o telefone no campo errado.
- ❌ "a organização confere cada cadastro antes de publicar" — não confere. Quem cadastra é
  responsável pelo que escreveu, e o site diz isso.
- ❌ agenda, selo de confirmação e equipe nas corridas de rua — ainda não existem. Ver as fases
  futuras do [`PLANO_EXECUCAO.md`](PLANO_EXECUCAO.md).

# movimenta7 — regras do projeto

**O que é:** rede de atividades físicas da comunidade adventista do DF, aberta a todos.
Site estático (vanilla JS, GitHub Pages) + Leaflet + pipeline
Forms→planilha privada→feed autenticado→checagem automática→JSON público.
Plano mestre: `docs/plano/PLANO_EXECUCAO.md`. Decisões: `docs/adr/`. Dono: Jorge Yuri (leigo).

## Regras não negociáveis
1. **`textContent` sempre, `innerHTML` nunca** — todo dado da comunidade é hostil até prova
   contrária (SECURITY_BASELINE.md:33). Vale para popups do Leaflet.
2. **O formulário NÃO pede dado pessoal** (ADR-0006/0007, 25/08/2026): nem nome, nem telefone,
   nem e-mail, nem CREF. Campo livre ainda é entrada hostil — alguém pode digitar PII no lugar
   errado —, por isso a planilha fica **privada** e nunca usa “Publicar na web”. O GitHub lê
   somente o feed Apps Script autenticado por `POST`; `GET` é health check sem células. Público
   só passa pelo pipeline Write-Audit-Publish. O controle primário é **allowlist**
   (`CAMPOS_PUBLICOS` em
   `scripts/denylist.mjs`) — campo fora dela reprova, tenha o nome que tiver; a denylist ficou
   como 2ª camada. Valores também são checados: telefone, e-mail, CPF/CNPJ (mod-11) e link fora
   dos dois campos de link. **Link só para host na allowlist** (`HOSTS_REDE_SOCIAL` /
   `HOSTS_MAPA` em `js/util.js`) — `safeUrl()` aceita a web inteira e não serve mais para dado
   da comunidade. **Nunca afirme que o gate detecta nome de pessoa ou endereço residencial:**
   eles são indistinguíveis, por algoritmo, de nome de grupo e local público válidos. O formulário
   proíbe escrevê-los; se aparecerem, a resposta operacional é `remover`.
   `MOV7_FEED_TOKEN` é gerado localmente (mín. 32, preferir 64) e tem exatamente três
   localizações autorizadas: gerenciador de senhas, Propriedade do Script `MOV7_FEED_TOKEN` e
   Environment secret `PLANILHA_FEED_TOKEN` de `github-pages`. Nunca vai para repo, URL,
   navegador, Logger ou chat. `PLANILHA_FEED_URL` também é Environment secret; o `GITHUB_TOKEN`
   fica nas Propriedades do Script e no gerenciador. Form, planilha e projeto Apps Script ficam
   sem colaboradores editores — confira separadamente o compartilhamento do projeto standalone;
   o público recebe apenas o link de resposta. Código e Logger nunca geram nem exibem o valor.
   ⚠️ **Nenhum cadastro é publicado editando
   `moderacao/aprovados.json` à mão** — repo público
   tem histórico permanente e isso conflita com o direito de exclusão (ADR-0005, decisão 1).
   O caminho é a planilha privada → `scripts/ingerir_csv.mjs`, no runner.
3. **Publicação é AUTOMÁTICA** (ADR-0006/0007): não há fila de aprovação. Envio do formulário
   e edição da coluna `remover` disparam `workflow_dispatch`; a Action leva ~40 s e o navegador
   procura snapshot novo a cada 60 s e ao voltar ao foco. Comunique **“cerca de 1 a 2 minutos”**
   como operação normal. O fallback isolado em `refresh.yml` pede a publicação nos minutos
   7,17,27,37,47,57. Execuções bem-sucedidas foram medidas em 40, 47, 43 e 55 min, mas isso é
   histórico, não teto nem SLA: o GitHub pode atrasar ou descartar uma rodada. Se o GitHub o
   desativar após 60 dias sem atividade,
   só `refresh.yml` para; `workflow_dispatch` em `ci.yml` continua ativo. Daí a assimetria que **não pode
   ser “consertada”**: erro estrutural (feed ausente, contrato inválido, origem fora do ar)
   **aborta tudo**; erro de um cadastro (dado pessoal, região inválida, rede social/mapa
   ausente ou inválido, coordenada confirmada fora do DF) **pula só aquele e segue**. Fail-closed por registro
   entregaria a qualquer pessoa o poder de congelar o site preenchendo o formulário com lixo.
   `publicar_snapshot.mjs` e `valida_snapshot.mjs` seguem fail-closed de propósito — a entrada
   deles é arquivo nosso, então erro ali é bug nosso.
4. **Nenhum dado de menor de idade** (ADR-0004). Aviso de privacidade sempre visível.
   ⚠️ O site **descreve o próprio funcionamento por escrito** em `index.html`. Se o desenho
   mudar, o texto muda no MESMO commit — nunca calado.
5. Deploy via `git push` (Pages). **Rollback = `git revert HEAD && git push`** — 1 comando.
6. CI verde obrigatório: testes + gates (exit ≠ 0 = não sobe). ✅ **Lacuna FECHADA em
   24/08/2026:** o Pages saiu do modo `legacy` e está confirmado com `build_type: workflow`.
   O job `qa` não recebe segredo; `publish` declara `needs: qa`, usa o ambiente `github-pages`
   e só roda em `refs/heads/main`. Verificado de verdade na branch `prova/gate-vermelho`
   (run 32766185945): gate vermelho → publicação **skipped**, site anterior intacto no ar.
   O que sobe é só o que a página carrega (`index.html`, `css/`, `js/`, `data/`, `assets/`) —
   `scripts/`, `tests/`, `docs/` e `moderacao/` deixaram de ser servidos.
7. Idiomas: **código e prompts em inglês; tudo que o dono lê em português.** Pesquisa web em
   inglês, saída em português.
8. Números públicos sempre REAIS — nunca inflar (regra do dono).
9. Encoding: `open(path, "w", encoding="utf-8")` em qualquer script Python; UTF-8 em tudo.
10. **Cor e fonte têm gate.** Mexeu em token de cor em `css/style.css`? Atualize `PAIRS` em
    `scripts/valida_contraste.mjs:22-39` e rode — contraste é validado por FÓRMULA, nunca a olho
    (D9). Fontes são **self-hosted** em `assets/fonts/` e não podem virar CDN: a CSP da página é
    `default-src 'self'`. Método visual vem da pesquisa em `C:\dev\ifp-plataforma\docs\`
    (`ESPECIALISTA_FRONTEND_UX.md`, `PLANO_UX.md`) — a aparência é nossa, o método é de lá.
11. **Nenhuma chave de API no repositório** — ele é público. Isso descarta mapa 3D
    (Cesium/Google Photorealistic Tiles) e qualquer serviço que exija credencial no cliente.
    Decidido em 25/08/2026 ao avaliar o projeto `gods-eye-view`. Só muda se houver servidor.

12. **O feed atual lê a aba de respostas por CABEÇALHO, sem fórmula.** A aba `PUBLICAR` e
    `scripts/PUBLICAR_A2.txt` são legado de migração e nunca voltam a ser origem do site. Se uma
    fórmula ligada ao Forms ainda for mantida para conferência, NUNCA pode ter linha fixa. Cada
    resposta do Google
    Forms é uma INSERÇÃO de linha, e inserção empurra referência absoluta (`$A$2` vira `$A$3`,
    `$A$4`…) — a fórmula fica eternamente uma linha abaixo do cadastro mais novo e não acha nada.
    Só **coluna inteira** (`$A:$ZZ`) sobrevive; o cabeçalho sai por nome, não por pular a linha 1.
    Custou 25/08/2026 inteiro: 2 cadastros na planilha, 0 pins, CI verde o tempo todo.
    Congelado em `tests/criar_form.test.mjs`. ⚠️ **Modo de falha a temer neste projeto: silencioso.**
    Qualquer `#N/A` dentro do `FILTER` vira `""` pelo `IFERROR` e a aba fica vazia sem erro nenhum.
13. **`git push` não alcança o Google.** Alterar `scripts/criar_form.gs` no repo NÃO atualiza o
    Web App, os gatilhos nem as Propriedades do Script já implantados. Toda mudança dessa camada
    exige **Implantar > Gerenciar implantações > Editar > Versão: Nova versão > Implantar** e
    teste ponta a ponta. Edite a implantação existente para preservar a URL `/exec`; não crie
    outra implantação numa simples atualização. Nunca peça que o dono cole um segredo em chat ou
    arquivo; use as telas próprias do Apps Script e os Environment secrets de `github-pages`.

14. **Para disparar o CI de fora, `workflow_dispatch` — NUNCA `repository_dispatch`.**
    Verificado na doc oficial do GitHub em 25/08/2026: `repository_dispatch` exige
    **Contents: write**, que é permissão de EMPURRAR COMMIT — e aqui o repositório **é** o
    site, então esse token, vazado, publica o que quiser no mapa. `workflow_dispatch` exige
    **Actions: write**, mas não diga que isso “só roda workflow”: a permissão também administra
    workflows, execuções, logs e caches, e o dispatch aceita branch/tag existente. Por isso o
    token é repo-only, tem validade curta, e o CI nunca entrega segredo nem deploy fora de
    `refs/heads/main`. O `on:` do
    `ci.yml` tem `workflow_dispatch` — **não remover**: os gatilhos de formulário e `remover`
    (`aoEnviarFormulario`/`aoEditarPlanilha`, `scripts/criar_form.gs`) morrem com HTTP 422 dentro
    da conta Google do dono, onde ninguém aqui vê. Token GitHub mora nas Propriedades do Script.

15. **Coordenada só vale se estiver na URL — NUNCA no corpo da página do Google.**
    Medido em 25/08/2026: "skate park samambaia" e "Catedral de Brasília" devolveram a
    MESMA coordenada (-15.8793728,-48.1099776), porque o Google entrega página genérica a
    robô. Ler o corpo fincaria todo grupo sem link resolvido no mesmo ponto — o bug original
    disfarçado de precisão. Congelado em `tests/coordenadas.test.mjs`. Duas consequências:
    (a) **quando o link e a região do formulário discordam, VALE O LINK** e a região é
    corrigida (`publicar_snapshot.mjs`) — validar o link contra a região jogaria fora o dado
    certo, que foi exatamente o caso dos grupos da 502 Sul cadastrados como Samambaia;
    (b) **"dentro do DF" se decide por POLÍGONO** (`regiaoDaCoordenada` em
    `scripts/coordenadas.mjs`), nunca pela caixa de `js/util.js` — a caixa inclui uma faixa
    de Goiás, e Luziânia passava por ela.
    Link curto é resolvido só por redirecionamento, com timeout e limite de saltos. O resultado
    fica no cache do GitHub Actions sob hash SHA-256 da URL; a URL crua não entra no cache.
    ⚠️ **Qualquer nova resolução por rede EXIGE cache antes de entrar no pipeline**: sem ele o
    cron repetiria requisições a terceiro até sofrer bloqueio. Falha de resolução usa a região
    como posição aproximada; uma coordenada confirmada fora do polígono do DF coloca o cadastro
    inteiro em quarentena; coordenadas iguais dentro do DF são legítimas e nunca eliminam grupos.

## Revisão externa (Codex)
Ciclo em marcos (fim Fase 1, fim Fase 2, antes da Fase 3): `_revisao_codex/PROMPT_ANALISE_SISTEMA.md`.
Codex é READ-ONLY; quem roda é o dono; reconciliação achado-a-achado antes de aplicar.

## Referências rápidas
- Base estrutural: `C:\dev\mapa-embaixadores-2026` (padrões de sanitização em `js/app.js:7-43`).
- Cérebro: `C:\dev\Engenharia de IA\INDEX.md` — consultar ANTES de qualquer decisão técnica.
- Pesquisas do projeto: `PESQUISAS/2026-08-23_leaflet-tiles-geojson-df_movimenta7.md` e
  `PESQUISAS/2026-08-23_cadastro-24h-forms-lgpd_movimenta7.md`.

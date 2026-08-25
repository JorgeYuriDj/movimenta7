# movimenta7 — regras do projeto

**O que é:** rede de atividades físicas da comunidade adventista do DF, aberta a todos.
Site estático (vanilla JS, GitHub Pages) + Leaflet + pipeline Forms→checagem automática→JSON público.
Plano mestre: `docs/plano/PLANO_EXECUCAO.md`. Decisões: `docs/adr/`. Dono: Jorge Yuri (leigo).

## Regras não negociáveis
1. **`textContent` sempre, `innerHTML` nunca** — todo dado da comunidade é hostil até prova
   contrária (SECURITY_BASELINE.md:33). Vale para popups do Leaflet.
2. **O formulário NÃO coleta dado pessoal** (ADR-0006, 25/08/2026): nem nome, nem telefone,
   nem e-mail, nem CREF. O que não é coletado não vaza. Público só passa pelo pipeline
   Write-Audit-Publish (ADR-0002). O controle primário é **allowlist** (`CAMPOS_PUBLICOS` em
   `scripts/denylist.mjs`) — campo fora dela reprova, tenha o nome que tiver; a denylist ficou
   como 2ª camada. Valores também são checados: telefone, e-mail, CPF/CNPJ (mod-11) e link fora
   dos dois campos de link. **Link só para host na allowlist** (`HOSTS_REDE_SOCIAL` /
   `HOSTS_MAPA` em `js/util.js`) — `safeUrl()` aceita a web inteira e não serve mais para dado
   da comunidade.
   ⚠️ **Nenhum cadastro é publicado editando `moderacao/aprovados.json` à mão** — repo público
   tem histórico permanente e isso conflita com o direito de exclusão (ADR-0005, decisão 1).
   O caminho é a planilha → `scripts/ingerir_csv.mjs`.
3. **Publicação é AUTOMÁTICA** (ADR-0006): não há fila de aprovação; cron de 10 min publica
   quem preencheu o formulário. Daí a assimetria que **não pode ser "consertada"**: erro
   estrutural (coluna inesperada, CSV vazio) **aborta tudo**; erro de um cadastro (dado pessoal,
   região inválida, link fora da lista) **pula só aquele e segue**. Fail-closed por registro
   entregaria a qualquer pessoa o poder de congelar o site preenchendo o formulário com lixo.
   `publicar_snapshot.mjs` e `valida_snapshot.mjs` seguem fail-closed de propósito — a entrada
   deles é arquivo nosso, então erro ali é bug nosso.
4. **Nenhum dado de menor de idade** (ADR-0004). Aviso de privacidade sempre visível.
   ⚠️ O site **descreve o próprio funcionamento por escrito** em `index.html`. Se o desenho
   mudar, o texto muda no MESMO commit — nunca calado.
5. Deploy via `git push` (Pages). **Rollback = `git revert HEAD && git push`** — 1 comando.
6. CI verde obrigatório: testes + gates (exit ≠ 0 = não sobe). ✅ **Lacuna FECHADA em
   24/08/2026:** o Pages saiu do modo `legacy` e passou a publicar por `actions/deploy-pages`,
   com o job `deploy` declarando `needs: qa`. Verificado de verdade na branch `prova/gate-vermelho`
   (run 32766185945): gate vermelho → `deploy` **skipped**, site anterior intacto no ar.
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

## Revisão externa (Codex)
Ciclo em marcos (fim Fase 1, fim Fase 2, antes da Fase 3): `_revisao_codex/PROMPT_ANALISE_SISTEMA.md`.
Codex é READ-ONLY; quem roda é o dono; reconciliação achado-a-achado antes de aplicar.

## Referências rápidas
- Base estrutural: `C:\dev\mapa-embaixadores-2026` (padrões de sanitização em `js/app.js:7-43`).
- Cérebro: `C:\dev\Engenharia de IA\INDEX.md` — consultar ANTES de qualquer decisão técnica.
- Pesquisas do projeto: `PESQUISAS/2026-08-23_leaflet-tiles-geojson-df_movimenta7.md` e
  `PESQUISAS/2026-08-23_cadastro-24h-forms-lgpd_movimenta7.md`.

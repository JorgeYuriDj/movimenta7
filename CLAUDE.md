# movimenta7 — regras do projeto

**O que é:** rede de atividades físicas da comunidade adventista do DF, aberta a todos.
Site estático (vanilla JS, GitHub Pages) + Leaflet + pipeline Forms→moderação→JSON público.
Plano mestre: `docs/plano/PLANO_EXECUCAO.md`. Decisões: `docs/adr/`. Dono: Jorge Yuri (leigo).

## Regras não negociáveis
1. **`textContent` sempre, `innerHTML` nunca** — todo dado da comunidade é hostil até prova
   contrária (SECURITY_BASELINE.md:33). Vale para popups do Leaflet.
2. **A planilha privada NUNCA entra no repo nem vira pública.** Público só passa pelo pipeline
   Write-Audit-Publish (ADR-0002). Denylist no CI barra telefone/e-mail pessoal no snapshot.
3. **Nenhum dado de menor de idade** (ADR-0004). Aviso de privacidade sempre visível.
4. Deploy via `git push` (Pages). **Rollback = `git revert HEAD && git push`** — 1 comando.
5. CI verde obrigatório: testes do parser + gate do snapshot (exit ≠ 0 = não sobe).
6. Idiomas: **código e prompts em inglês; tudo que o dono lê em português.** Pesquisa web em
   inglês, saída em português.
7. Números públicos sempre REAIS — nunca inflar (regra do dono).
8. Encoding: `open(path, "w", encoding="utf-8")` em qualquer script Python; UTF-8 em tudo.

## Revisão externa (Codex)
Ciclo em marcos (fim Fase 1, fim Fase 2, antes da Fase 3): `_revisao_codex/PROMPT_ANALISE_SISTEMA.md`.
Codex é READ-ONLY; quem roda é o dono; reconciliação achado-a-achado antes de aplicar.

## Referências rápidas
- Base estrutural: `C:\dev\mapa-embaixadores-2026` (padrões de sanitização em `js/app.js:7-43`).
- Cérebro: `C:\dev\Engenharia de IA\INDEX.md` — consultar ANTES de qualquer decisão técnica.
- Pesquisas do projeto: `PESQUISAS/2026-08-23_leaflet-tiles-geojson-df_movimenta7.md` e
  `PESQUISAS/2026-08-23_cadastro-24h-forms-lgpd_movimenta7.md`.

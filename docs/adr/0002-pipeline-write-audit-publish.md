# ADR-0002 — Pipeline de dados Write-Audit-Publish (planilha privada → JSON público)

**Status:** proposto (aguarda análise do dono) · 23/08/2026

**Contexto:** o mapa-embaixadores publica a planilha via CSV público — aceitável lá (dados
anônimos), inaceitável aqui (cadastro tem nome/telefone do organizador). "Publicar na web"
expõe a aba inteira.

**Decisão:** Google Form → planilha PRIVADA (**Write**) → moderação humana: coluna APROVADO,
revisão do texto, geocodificação 1x por clique no mapa (**Audit**) → público só o aprovado e
só campos públicos (**Publish**): Fase 1 via Apps Script `doGet` (Execute as me + acesso
Anyone); Fase 2 adiciona snapshot `data/snapshot.json` commitado por GitHub Action (fallback).
Cascata de leitura no site: JSON vivo → snapshot (herdada de `app.js:181-196`).

**Fonte:** padrão WAP em `MANUAL_ENGENHARIA_DADOS/05_qualidade_e_versionamento_de_dataset.md:295-297`;
Apps Script Web Apps (developers.google.com/apps-script/guides/web); risco do publish-to-web
documentado na pesquisa `PESQUISAS/2026-08-23_cadastro-24h-forms-lgpd_movimenta7.md`.

**Consequências:** a planilha bruta nunca fica pública; moderação é 1 coluna + 1 clique;
Apps Script tem cota (~30 execuções simultâneas) — mitigado por cache no front e snapshot.

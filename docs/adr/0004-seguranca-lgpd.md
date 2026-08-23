# ADR-0004 — Segurança e LGPD (minimização, denylist no CI, CSP)

**Status:** proposto (aguarda análise do dono) · 23/08/2026

**Decisão:**
1. Todo dado da comunidade entra no DOM via `textContent` — `innerHTML` proibido, inclusive em
   popups Leaflet (usar `L.popup().setContent(elementoDOM)`); limites de 120 chars/campo e teto
   de registros herdados do mapa-embaixadores (`app.js:14-15`).
2. CSP em meta tag (GitHub Pages não emite headers) ampliada para os hosts dos tiles —
   registrada como **mitigação parcial aceita**; se o projeto crescer, Cloudflare grátis na
   frente para CSP por header (`SECURITY_BASELINE.md:158`).
3. **Gate de CI (denylist)**: script valida o snapshot público antes do deploy — JSON parseia,
   schema correto, e NENHUM campo proibido (telefone/e-mail pessoal, endereço residencial);
   exit ≠ 0 quebra o build (Akita #140, `AKITA_PRINCIPLES.md:392`).
4. **LGPD**: minimização de dia 1 (`MANUAL_ENGENHARIA_DADOS/04:156`); público só o listado no
   PLANO_EXECUCAO §6; aviso de privacidade no form e no rodapé; base legal consentimento;
   regime de agente de pequeno porte (Res. CD/ANPD 2/2022); **nenhum dado de menor no MVP**
   (evolução futura exige política própria — art. 14 §1º LGPD, consentimento de responsável).
5. Remoção de cadastro a pedido do titular: sai do snapshot público por edição versionada
   (git guarda histórico); apagar da planilha-fonte segue o RITO da Regra Zero
   (`.gates/DONO_DOS_DADOS.md`).

**Fonte:** `SECURITY_BASELINE.md:33,114,158` · `AKITA_PRINCIPLES.md:392` ·
`MANUAL_ENGENHARIA_DADOS/04:156,1098` · guias ANPD (pesquisa
`PESQUISAS/2026-08-23_cadastro-24h-forms-lgpd_movimenta7.md`).

**Consequências:** vazamento de PII vira falha de build, não incidente; a proteção mora no
gate, não na instrução.

# ADR-0004 — Segurança e LGPD (minimização, denylist no CI, CSP)

**Status:** ACEITO pelo dono em 23/08/2026

> **Atualização de 25/08/2026:** o [ADR-0006](0006-publicacao-automatica-sem-dado-pessoal.md)
> eliminou a coleta intencional de nome, telefone, e-mail e CREF. O
> [ADR-0007](0007-feed-privado-e-atualizacao-automatica.md) substituiu a origem pública por um
> feed privado autenticado e a remoção por publicação automática sem commit de respostas. As
> regras de minimização, allowlist, denylist, CSP, ausência de menores e CI bloqueante continuam.
> A checagem de valor atual detecta telefone, e-mail, CPF/CNPJ e links. Nome pessoal e endereço
> residencial em texto livre não são classificáveis com segurança; são proibidos no Form e
> tratados por remoção. As frases históricas abaixo sobre “todo PII” não ampliam essa capacidade.

**Decisão:**
1. Todo dado da comunidade entra no DOM via `textContent` — `innerHTML` proibido, inclusive em
   popups Leaflet (usar `L.popup().setContent(elementoDOM)`); limites de 120 chars/campo e teto
   de registros herdados do mapa-embaixadores (`app.js:14-15`).
2. CSP em meta tag (GitHub Pages não emite headers) ampliada para os hosts dos tiles —
   registrada como **mitigação parcial aceita**; se o projeto crescer, Cloudflare grátis na
   frente para CSP por header (`SECURITY_BASELINE.md:158`).
3. **Gate de CI (denylist)**: script valida o snapshot público antes do deploy — JSON parseia,
   schema correto, nenhum campo proibido e nenhum telefone/e-mail/CPF/CNPJ detectável;
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

**Consequências:** identificadores detectáveis viram falha de build, não incidente; para nomes e
residências em texto livre, a instrução explícita e a remoção continuam necessárias.

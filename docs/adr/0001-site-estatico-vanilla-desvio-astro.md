# ADR-0001 — Site estático vanilla JS (desvio do default Astro)

**Status:** ACEITO pelo dono em 23/08/2026

**Contexto:** o FRONTEND_BASELINE da base manda Astro para site 100% estático e exige ADR para
desvio (`FRONTEND_BASELINE.md:20`). O movimenta7 precisa lançar cadastros em 1 dia e herda ~70%
de um projeto vanilla comprovado em produção (mapa-embaixadores-2026: zero build, zero
dependência, testes com node puro, CI por SHA).

**Decisão:** vanilla HTML+CSS+JS no GitHub Pages, sem build step.

**Fonte:** Akita #129 "KISS = não resolver problema que não existe" (`AKITA_PRINCIPLES.md:358`);
Akita #90 "não faça Netflix sem ser Netflix" (`:168`); base reutilizada validada em produção.

**Consequências:** lançamento imediato e manutenção simples; sem componentes/SSG — se o site
crescer para dezenas de páginas, reavaliar Astro em novo ADR.

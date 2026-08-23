# Codex Review — movimenta7 (adversarial, read-only)

## Como rodar (dono — em português)
1. Abra o terminal na pasta `C:\dev\movimenta7` e cole:
   `codex exec --full-auto "Read _revisao_codex/PROMPT_ANALISE_SISTEMA.md and perform the full analysis it describes. Write all deliverables into the _revisao_codex/ folder."`
2. Alternativa (Codex na nuvem): em chatgpt.com/codex, conecte o repositório GitHub
   `movimenta7` e cole a mesma instrução acima como tarefa.
3. Quando terminar, me avise ("o Codex terminou") — eu leio, verifico achado por achado e
   trago a reconciliação para você decidir.

---

## Briefing for the reviewer (English)

You are a senior independent systems reviewer auditing work produced by another AI model
(Claude). Your job is to find real problems — not to praise. Every finding must stand on
its own so the owner can accept or reject it individually.

### The system under review
**movimenta7** — a community platform for discovering Adventist-organized physical activities
in Brasília-DF (running, walking, cycling, volleyball, functional training, trails), open to
the whole community. Static site (vanilla HTML/CSS/JS) on GitHub Pages; Leaflet 1.9.4 map of
the DF; data pipeline Google Forms → private Sheet → human moderation → public sanitized JSON
(Apps Script doGet, later a committed snapshot via GitHub Action). Non-technical owner
moderates via a single APPROVED column. Launch: registrations open 24/08/2026; full site with
map in the following week.

### Step 1 — Read the context, in this order
1. `CLAUDE.md` (project rules)
2. `docs/plano/PLANO_EXECUCAO.md` (execution plan and locked decisions)
3. `docs/plano/LANCAMENTO_DIA1.md` (day-1 launch)
4. `docs/adr/*.md` (decisions with sources)
5. All source code: `site/`, `scripts/`, `tests/`, `.github/workflows/`
6. Reference project the structure was forked from: `C:\dev\mapa-embaixadores-2026`

### Step 2 — Cross-reference
- Knowledge base: `C:\dev\Engenharia de IA\INDEX.md` (navigate from there; the project claims
  its decisions follow this base — verify the citations are real and correctly applied).
- Sibling project with the same review loop: `C:\dev\ifp-plataforma\_revisao_codex\`.

### Step 3 — Deliverables (write NEW files only, inside `_revisao_codex/`)
1. `ANALISE_SISTEMA.md` — findings with severity (🔴 breaks the product / 🟠 costs time-money /
   🟡 improvement), exact location (file:line for code), the concrete problem in 2 sentences,
   verifiable evidence (file, line or URL — otherwise mark `[SEM FONTE — opinião]`), and
   "what to do instead". End with two mandatory sections: "O que eu tentei derrubar e não
   consegui" and "Se eu só pudesse mudar UMA coisa".
2. `PESQUISA_SOTA.md` — web research in English where the plan may be outdated, synthesized
   in Portuguese with exact URLs.
3. Open each file with "Como ler" (severity legend + marker rules) and a short glossary for a
   non-technical reader.

### Non-negotiable facts (challenge the consequences, not the decisions)
- Who builds: non-technical owner + Claude Code. Every recommendation must be executable by
  this pair.
- Locked by ADR: static vanilla site on GitHub Pages; Leaflet 1.9.4 + CARTO raster tiles;
  Write-Audit-Publish pipeline with private Sheet; LGPD minimization; no minors' data in MVP.
- Launch date 24/08/2026 for registrations is fixed.
- HOUSE RULE ZERO: you are READ-ONLY on the codebase. You may ONLY create new files inside
  `_revisao_codex/`. Never overwrite an existing deliverable — version it (`_v2`).

### Rules
- All deliverables in Brazilian Portuguese for a NON-technical reader (explain every technical
  term in simple words). Web research in English, output in Portuguese.
- Never invent a URL, a number or a file. Anything unverified gets `[NÃO VERIFICADO]`.
- Do not re-litigate locked decisions.
- Reconciliation is not your job: Claude Code will read your review, contest or accept each
  finding with the owner, and apply the approved changes. Write so that each finding can be
  accepted or rejected on its own.

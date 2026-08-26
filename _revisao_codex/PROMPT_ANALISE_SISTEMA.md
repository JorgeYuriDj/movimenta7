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
the DF; search/filter/list alongside the map; data pipeline Google Form → private Sheet →
authenticated Apps Script `POST` → GitHub Actions gates → public sanitized snapshot. There is
no approval queue: form submissions and edits to `remover` call `workflow_dispatch`; the cron is
the fallback. The browser never receives the feed URL/token and never reads the Sheet directly.
The form does not ask for personal names, phone, e-mail or CREF. Value gates detect phone,
e-mail, CPF/CNPJ and misplaced links; they do not claim to infer personal names or residential
addresses from arbitrary text (ADR-0007).

### Step 1 — Read the context, in this order
1. `CLAUDE.md` (project rules)
2. `README.md` (current overview)
3. `docs/adr/*.md`, especially ADR-0007 (decisions and supersession)
4. `moderacao/COMO_LIGAR_A_PLANILHA.md` and `moderacao/COMO_MODERAR.md` (current operations)
5. `docs/plano/PLANO_EXECUCAO.md` and `docs/plano/LANCAMENTO_DIA1.md` (dated history; respect
   their supersession notices)
6. All source code: `index.html`, `css/`, `js/`, `scripts/`, `tests/`, `.github/workflows/`
7. Reference project the structure was forked from: `C:\dev\mapa-embaixadores-2026`

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
- Who operates it: a non-technical owner with a coding agent. Every recommendation must be
  executable by this pair.
- Locked by ADR: static vanilla site on GitHub Pages; Leaflet 1.9.4 + CARTO raster tiles;
  private authenticated Write-Audit-Publish pipeline; automatic publication without an approval
  queue; browser reads only the sanitized snapshot; LGPD minimization; no minors' data in MVP.
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

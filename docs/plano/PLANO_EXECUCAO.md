# PLANO DE EXECUÇÃO — movimenta7

> **Status: AGUARDANDO ANÁLISE DO DONO** (Jorge Yuri) — nada abaixo vira código antes do seu OK.
> Escrito em 23/08/2026, com base em: código real do `mapa-embaixadores-2026`, pesquisa de
> frontend do `ifp-plataforma`, ciclo de revisão Codex do `ifp-plataforma`, base "Engenharia
> de IA" (citações abaixo) e 2 pesquisas web novas (salvas em `PESQUISAS/`).

## O que é o movimenta7 (1 frase)

Uma rede de comunidades esportivas organizadas por adventistas do DF, **aberta a toda Brasília**,
onde qualquer pessoa descobre em segundos **o quê, onde, quando e para quem** — corrida, caminhada,
ciclismo, vôlei, funcional, trilhas — e participa no seu ritmo.

Promessa do produto: **"Encontre uma atividade perto de você, participe no seu ritmo e
movimente-se em comunidade."** O mapa atrai; o calendário organiza; a comunidade é o produto.

---

## Resumo executivo das fases

| Fase | Quando | Entrega | Revisão Codex |
|---|---|---|---|
| **0 — Lançamento dos cadastros** | **AMANHÃ (24/08)** | Landing 1 página + Google Form + botão WhatsApp + aviso de privacidade. Divulgação em 3 canais. | — |
| **1 — Site completo** | 25–30/08 | "Próximas atividades" + filtros + mapa Leaflet do DF + lista acessível + moderação funcionando | **#1** ao final |
| **2 — Robustez** | 31/08–06/09 | Snapshot diário via GitHub Action, "Adicionar à agenda", confirmação periódica (selo 45/60/90 dias), provas da FAtDF | **#2** ao final |
| **3 — Comunidade** | setembro | Equipes nas corridas, encontros interigrejas, parceria APlaC/Mexa-se Pela Vida, página de impacto | **#3** antes |

Regra anti-scope-creep (lição do IFP, `CLAUDE.md:62-71` de lá): **a visão de setembro não engole
o prazo de amanhã.** Amanhã só existe a Fase 0.

---

## 1. As 3 camadas do produto (do rascunho aprovado pelo dono)

1. **Descoberta** — abrir e ver: atividades de hoje/da semana, modalidade, horário, nível,
   gratuito?, aberto a todos?, para famílias?, com profissional?
2. **Organização** — cada atividade tem cartão com: grupo, igreja, ponto de encontro, recorrência,
   nível, custo, acessibilidade, botões **Chamar no WhatsApp / Adicionar à agenda / Como chegar /
   Avisar erro**, e **data da última confirmação** (informação que expira — selo 🟢/🟡, some da
   lista ativa após 90 dias sem confirmação).
3. **Comunidade** — calendário de provas (FAtDF), equipe nas corridas, camisa opcional, encontros
   mensais regionais, ações solidárias, página de impacto.

Separação de entidades nos dados: **Grupo** (quem organiza) · **Atividade recorrente** (o pin no
mapa — uma igreja pode ter N atividades) · **Evento pontual** (prova, treinão).

## 2. Decisões técnicas travadas (cada uma com fonte — ver ADRs em `docs/adr/`)

| # | Decisão | Escolha | Fonte |
|---|---|---|---|
| D1 | Base do código | **Reaproveitar ~70% do `mapa-embaixadores-2026`**: tema claro/escuro sem flash, chips de filtro, lista acessível, cascata de dados com fallback, testes sem dependência, CI com actions fixadas por SHA, `config.js` único | leitura integral do repo (app.js:181-196, tema.js:1-8, app.js:390-474) |
| D2 | Stack | **Site 100% estático, vanilla HTML+CSS+JS, GitHub Pages** — desvio do default Astro registrado em ADR-0001 | FRONTEND_BASELINE.md:20 (exige ADR p/ desvio) + Akita #129 "KISS" e #90 "não faça Netflix sem ser Netflix" (AKITA_PRINCIPLES.md:358, :168) |
| D3 | Mapa | **Leaflet 1.9.4** via unpkg **com hash SRI oficial** (2.0 ainda é alpha), **sem** plugin de cluster (<200 pins), tiles **CARTO Voyager** (raster, grátis, sem chave) com atribuição "© OpenStreetMap contributors © CARTO", OSM como fallback; GeoJSON das RAs do **IPEDF/GeoPortal SEDUH** simplificado; `maxBounds` prende o mapa no DF | leafletjs.com/download.html · docs.carto.com/faqs/carto-basemaps · catalogo.ipe.df.gov.br (Limite_RA_2019) — ADR-0003 |
| D4 | Pipeline de dados | **Write-Audit-Publish**: Forms → planilha **privada** (Write) → moderação humana + geocodificação 1x por clique no mapa (Audit) → público só o aprovado (Publish). Fase 1: Apps Script `doGet` devolve JSON só das linhas `APROVADO=SIM` e só dos campos públicos; Fase 2: GitHub Action commita `data/snapshot.json` (fallback). **"Publicar na web" da planilha bruta é PROIBIDO** (vazaria telefones) | MANUAL_ENGENHARIA_DADOS/05:295-297 (WAP) · developers.google.com/apps-script/guides/web — ADR-0002 |
| D5 | Segurança | Herdar tudo do mapa-embaixadores: **`textContent` sempre, `innerHTML` nunca** (inclusive em popup do Leaflet), corte de 120 chars/campo, teto de registros, `urlSegura()` só http/https, `Map` anti-prototype-pollution, CSP em meta tag ampliada p/ hosts dos tiles (mitigação parcial documentada — Pages não emite header) + gate de CI que valida o snapshot com **denylist de campos proibidos** (telefone/e-mail pessoal) — exit ≠ 0 quebra o deploy | SECURITY_BASELINE.md:33,114 · Akita #80, #140 (AKITA_PRINCIPLES.md:392) — ADR-0004 |
| D6 | LGPD | Minimização de dia 1 (Akita #84): público SÓ nome do grupo, modalidade, RA, dia/hora, lat/lon de **local público**, link de grupo WhatsApp ou contato institucional. **Nunca** telefone pessoal sem consentimento destacado, nunca endereço residencial, **nenhum dado de menor no MVP**. Aviso de privacidade no form e no rodapé. Regime de pequeno porte: Res. CD/ANPD 2/2022 | MANUAL_ENGENHARIA_DADOS/04:156 · gov.br/anpd (Res. 2/2022 + Guia de Segurança p/ pequeno porte) — ADR-0004 |
| D7 | Revisor externo | **Codex (plano Pro do dono, GPT-5.3-Codex-Spark)** como revisor adversarial READ-ONLY em marcos, replicando o ciclo do ifp-plataforma: prompt em inglês, parecer em português, reconciliação achado-a-achado com céticos | \_revisao_codex/PROMPT_ANALISE_SISTEMA.md:3-185 do IFP — seção 5 abaixo |
| D8 | UX | Aplicar a pesquisa do IFP: Core Web Vitals como meta (LCP≤2,5s, INP≤200ms, CLS≤0,1), WCAG 2.2 AA piso, thumb zone (CTA na metade inferior), card-poster como card de atividade ("Corrida no Parque da Cidade — dom 6h30", nunca "Atividade 12"), chips roláveis ≥44px, 1 CTA de destaque/tela, empty states aspiracionais, `100svh` nunca `100vh` (browser interno do WhatsApp), og:image 1200×630, `prefers-reduced-motion` | ESPECIALISTA_FRONTEND_UX.md:15-41,82-118 · PLANO_UX.md:100-108 |
| D9 | Identidade | Tema claro+escuro (mecanismo do mapa-embaixadores). **Método** de tokens do PLANO_UX (fundo quase-preto quente, acento raro com contraste ≥4,5:1 verificado por fórmula), mas com **acento próprio "verde movimento"** — valores exatos validados na construção com a fórmula de contraste (não chutados) | PLANO_UX.md:7-51 (método) · regra anti-alucinação do dono |
| D10 | Mapa entra DEPOIS do cadastro | Amanhã lança **sem mapa** (landing + form). O mapa estreia na Fase 1 já com dados reais — mapa vazio no dia 1 passa desconfiança; "já somos X grupos" curado à mão passa confiança | checklists de lançamento (PESQUISAS/2026-08-23_cadastro-24h) + empty-state aspiracional (ESPECIALISTA §9.3) |

## 3. Arquitetura (fluxo de dados)

```
Google Form (cadastro do organizador)
        │  grava
        ▼
Planilha Google PRIVADA  ──────────────  nunca publicada, nunca no repo
        │  moderador (Jorge) revisa, marca APROVADO=SIM,
        │  ajusta texto público, clica no mapa p/ pegar lat/lon
        ▼
┌─ Fase 1: Apps Script doGet ─────────────┐   ┌─ Fase 2: GitHub Action diária ─┐
│ JSON só de linhas aprovadas,            │   │ puxa aprovados e commita       │
│ só campos públicos                      │   │ data/snapshot.json no repo     │
└──────────────┬──────────────────────────┘   └───────────────┬────────────────┘
               ▼                                              ▼
        Site estático (GitHub Pages): fetch com cascata  JSON vivo → snapshot
        Render 100% via textContent · Leaflet 1.9.4 + tiles CARTO
```

Gate de CI antes de todo deploy (Akita #140): snapshot parseia + schema válido + **denylist**
(nenhum telefone/e-mail pessoal no público) + testes do parser. Vermelho = não sobe.

## 4. Fases em detalhe

### Fase 0 — AMANHÃ (24/08): divulgar e cadastrar
Checklist completo com textos prontos em [`LANCAMENTO_DIA1.md`](LANCAMENTO_DIA1.md). Resumo:
1. Criar o Google Form com o script pronto (`scripts/criar_form.gs` — cola no Apps Script, roda 1x,
   o form nasce completo com aviso de privacidade). ~15 min.
2. Publicar a landing (1 página estática já no padrão visual, com o link do form + botão WhatsApp
   + aviso de privacidade). Claude constrói e sobe hoje/amanhã cedo no GitHub Pages. ~2 h de build.
3. Divulgar nos 3 canais: grupos de WhatsApp (mensagem pronta), Instagram, contato direto com
   líderes de 10 igrejas. Meta da semana: **15 atividades reais cadastradas** (validação humana
   do rascunho vira meta de cadastro).
4. Moderação: você só marca APROVADO=SIM na planilha e responde o WhatsApp.

### Fase 1 — Site completo (25–30/08)
- Fork estrutural do mapa-embaixadores → adaptar `config.js`, schema de colunas e substituir
  `mapa-brasil.js` por `mapa-df.js` (Leaflet, D3 decisões).
- Página inicial na ordem do rascunho: **Próximas atividades** (hoje/amanhã/semana) → chips de
  filtro (modalidade + dia + gratuito + iniciante + acessível) → mapa (carregado sob demanda,
  padrão facade — Leaflet só baixa quando o usuário rola até ele) → lista textual completa.
- Endpoint doGet + moderação com geocodificação por clique.
- Testes do parser adaptados + gate de denylist no CI.
- **Marco: Revisão Codex #1** sobre o site inteiro antes de considerar a fase fechada.

### Fase 2 — Robustez (31/08–06/09)
- GitHub Action de snapshot diário (fallback se o Apps Script cair).
- "Adicionar à agenda": link Google Calendar com RRULE (Android) + .ics no cliente (iPhone).
- Ciclo de confirmação: coluna "última confirmação" → selo 🟢 (≤45d) / 🟡 (45–90d) / oculto (>90d),
  lembrete por WhatsApp ao organizador.
- Seção "Próximas provas no DF" (calendário FAtDF curado à mão).
- **Marco: Revisão Codex #2.**

### Fase 3 — Comunidade (setembro)
- "A comunidade vai participar?" nas provas (equipe, ponto de encontro, camisa opcional).
- Encontro mensal regional; página de impacto com números REAIS (regra do dono: nunca inflar).
- Procurar APlaC/Ministério da Saúde com o protótipo funcionando + 15 atividades reais —
  proposta: extensão digital do Mexa-se Pela Vida. Até lá, aviso fixo no rodapé:
  *"Iniciativa comunitária independente, não oficial."* Sem logotipo oficial.
- **Revisão Codex #3 antes de planejar a fase.**

## 5. Ciclo de revisão Codex (replicado do ifp-plataforma)

- Pasta `_revisao_codex/` já criada com `PROMPT_ANALISE_SISTEMA.md` (**em inglês** — o modelo
  trabalha melhor em inglês; **pareceres em português** para você).
- **Quem roda é você** (o binário `codex` não está no PATH do Claude): comando pronto de colar
  está no topo do prompt. Alternativa: Codex na nuvem (chatgpt.com/codex) conectado ao repo GitHub.
- Codex é **READ-ONLY** (HOUSE RULE ZERO): só cria arquivos novos em `_revisao_codex/`.
- Devolve: `ANALISE_SISTEMA.md` (achados 🔴🟠🟡 com arquivo:linha e evidência, ou marca
  `[SEM FONTE — opinião]`) + seções "O que tentei derrubar e não consegui" e "Se eu só pudesse
  mudar UMA coisa".
- Depois, **reconciliação**: Claude verifica cada achado contra o código real (com céticos
  adversariais nos de maior consequência), veredito CONFIRMADO/PARCIAL/IMPROCEDENTE, você decide,
  Claude aplica. Padrão "aceitar-com-ajuste": aceita o fato, corrige o remédio se conflitar com
  decisão travada.
- Cadência: **em marcos** (fim das Fases 1 e 2, antes da Fase 3) — não continuamente.

## 6. Dados: o que é público × privado

**Públicos** (snapshot/JSON): id, nome_grupo, igreja, regiao_administrativa, modalidade, descricao,
publico, nivel, dia_da_semana, hora_inicio, hora_fim, recorrencia, local_publico, latitude,
longitude, custo, precisa_inscricao, link_inscricao, contato_publico (link de grupo/institucional),
acessibilidade, acompanhamento_profissional, cref_publico, status, ultima_confirmacao.

**Privados** (só na planilha, protegidos por denylist no CI): nome pessoal do organizador, telefone
pessoal, e-mail, observações internas, histórico de moderação.

**Tipo de atividade** no cadastro: `( ) Encontro social de prática livre  ( ) Atividade orientada
por profissional` — a segunda exige nome público do profissional + nº do CREF (CREF7/DF fiscaliza
exatamente isso no DF). O site não prescreve exercício nem promete cura; aviso de progressão
gradual para iniciantes (referência OMS 150–300 min/semana como educação, nunca cobrança).

## 7. Métricas (a principal primeiro)

> **Quantas pessoas encontraram uma atividade e participaram pela primeira vez?**

Depois: atividades ativas · igrejas com ≥1 atividade · RAs atendidas · confirmadas nos últimos
60 dias · participação de não adventistas · iniciantes · presença em provas. Números sempre REAIS.

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Virar "cemitério de horários antigos" (maior risco do produto) | Ciclo de confirmação 45/60/90 dias + botão "Avisar erro" + data de confirmação visível |
| Apps Script fora do ar em pico de divulgação | Cascata: JSON vivo → snapshot commitado; cache no front |
| Vazamento de dado pessoal | WAP + denylist no CI + planilha privada nunca publicada + CSP |
| Tiles CARTO mudarem política | Camada OSM de fallback já configurada; troca é 1 linha no config |
| Dono sobrecarregado na moderação | Moderação = 1 coluna SIM/NÃO + 1 clique no mapa; nada técnico |
| Nome "movimenta7" colidir com marca | Verificar INPI/Instagram/domínio antes da identidade final (tarefa Fase 1) |

## 9. O que NÃO entra no MVP (decidido, não esquecido)

Login/perfil pessoal · ranking/gamificação · app nativo · busca por texto (até ~30 itens) ·
cadastro de menores · feed social · logotipo oficial da igreja (até haver autorização).

---

### Fontes do cérebro citadas neste plano
- `AKITA_PRINCIPLES.md:168` (#90 Netflix), `:358` (#129 KISS), `:21` (#6 design emergente), `:392` (#140 gate por exit code), `:34` (#14 CI em cada commit)
- `FUNDACAO_PROJETOS/SECURITY_BASELINE.md:33` (input hostil), `:114` (XSS/escape no sink), `:158` (CSP por header)
- `FUNDACAO_PROJETOS/PLAYBOOK.md:162` (git init antes de feature), `:250` (CI bloqueia vermelho), `:274-275` (deploy por push + rollback 1 comando)
- `FUNDACAO_PROJETOS/frontend-baseline/FRONTEND_BASELINE.md:20` (desvio de Astro exige ADR)
- `MANUAL_ENGENHARIA_DADOS/05_qualidade_e_versionamento_de_dataset.md:295-297` (Write-Audit-Publish), `04_contratos_de_dados.md:156` (LGPD dia 1), `:1098` (remoção segue rito)
- Pesquisas novas salvas: `PESQUISAS/2026-08-23_leaflet-tiles-geojson-df_movimenta7.md` e `PESQUISAS/2026-08-23_cadastro-24h-forms-lgpd_movimenta7.md`

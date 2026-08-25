# movimenta7

Rede de atividades físicas e esportivas da comunidade adventista do Distrito Federal,
**aberta a toda Brasília**. Encontre uma atividade perto de você — corrida, caminhada,
ciclismo, vôlei, funcional, trilhas — participe no seu ritmo e movimente-se em comunidade.

> Iniciativa comunitária independente, não oficial. As referências à Igreja Adventista
> identificam os grupos participantes e não representam endosso institucional.

**Site (Fase 0):** landing + mapa do DF em `index.html` (raiz — GitHub Pages).
Para ligar o site: preencher `js/config.js` (link do Form).
Qualidade: `node --test tests/*.test.mjs` · `node scripts/valida_contraste.mjs` ·
`node scripts/valida_popup.mjs` · `node scripts/valida_snapshot.mjs`.
Todos rodam no CI, e o deploy só acontece se passarem (`needs: qa` em
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)) — gate vermelho mantém no ar a versão anterior.

**Publicação automática (ADR-0006):** não há fila de aprovação. Um cron de 10 minutos roda
`scripts/ingerir_csv.mjs` sobre o CSV publicado da planilha; `scripts/publicar_snapshot.mjs` gera
`data/snapshot.json` e põe cada grupo no centro da sua região administrativa. O formulário
**não coleta dado pessoal** — nem nome, nem telefone, nem e-mail —, o contato público é o @ da
rede social ou o link do Google Maps do local, e os links só valem para hosts numa allowlist
(`js/util.js`). O único controle manual é a coluna `remover`, que tira do ar.

Ligar a planilha (uma vez só): [`moderacao/COMO_LIGAR_A_PLANILHA.md`](moderacao/COMO_LIGAR_A_PLANILHA.md).
O que passa e o que não passa: [`moderacao/COMO_MODERAR.md`](moderacao/COMO_MODERAR.md).

> Editar `moderacao/aprovados.json` à mão **não é o caminho**: o repositório é público e o
> histórico do Git é permanente, então um cadastro publicado por commit continuaria achável
> depois de sair do site (ADR-0005, decisão 1). Quem escreve esse arquivo é a ingestão.

- Plano de execução: [`docs/plano/PLANO_EXECUCAO.md`](docs/plano/PLANO_EXECUCAO.md)
- Divulgação (mensagem pronta, **atual**): [`docs/plano/DIVULGACAO.md`](docs/plano/DIVULGACAO.md)
- Lançamento (Fase 0): [`docs/plano/LANCAMENTO_DIA1.md`](docs/plano/LANCAMENTO_DIA1.md) — datado
  de 23/08, desenho antigo; ver o aviso no topo
- Decisões técnicas (ADRs): [`docs/adr/`](docs/adr/)
- Estrutura herdada de: `mapa-embaixadores-2026` (site estático, GitHub Pages)

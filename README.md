# movimenta7

Rede de atividades físicas e esportivas da comunidade adventista do Distrito Federal,
**aberta a toda Brasília**. Encontre uma atividade perto de você — corrida, caminhada,
ciclismo, vôlei, funcional, trilhas — participe no seu ritmo e movimente-se em comunidade.

> Iniciativa comunitária independente, não oficial. As referências à Igreja Adventista
> identificam os grupos participantes e não representam endosso institucional.

**Site (Fase 0):** landing + mapa do DF em `index.html` (raiz — GitHub Pages).
Para ligar o site: preencher `js/config.js` (link do Form + WhatsApp da moderação).
Qualidade: `node --test tests/*.test.mjs` · `node scripts/valida_contraste.mjs` ·
`node scripts/valida_snapshot.mjs` (rodam no CI a cada push).

**Publicar cadastros aprovados:** editar `moderacao/aprovados.json` (só campos públicos)
e rodar `node scripts/publicar_snapshot.mjs` — ele gera `data/snapshot.json` e coloca cada
grupo no centro da sua região administrativa. Ver [`moderacao/COMO_MODERAR.md`](moderacao/COMO_MODERAR.md).

- Plano de execução: [`docs/plano/PLANO_EXECUCAO.md`](docs/plano/PLANO_EXECUCAO.md)
- Lançamento (Fase 0): [`docs/plano/LANCAMENTO_DIA1.md`](docs/plano/LANCAMENTO_DIA1.md)
- Decisões técnicas (ADRs): [`docs/adr/`](docs/adr/)
- Estrutura herdada de: `mapa-embaixadores-2026` (site estático, GitHub Pages)

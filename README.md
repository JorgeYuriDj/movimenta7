# movimenta7

Rede de atividades físicas e esportivas da comunidade adventista do Distrito Federal,
**aberta a toda Brasília**. Encontre uma atividade perto de você — corrida, caminhada,
ciclismo, vôlei, funcional, trilhas — participe no seu ritmo e movimente-se em comunidade.

> Iniciativa comunitária independente, não oficial. As referências à Igreja Adventista
> identificam os grupos participantes e não representam endosso institucional.

**Site:** página única com mapa do DF, busca, filtros e lista acessível em `index.html`
(GitHub Pages). A pessoa encontra um grupo, abre a rota no Google Maps e fala com a igreja ou
grupo pela rede social. O cadastro público está configurado em `js/config.js`.
Qualidade: `node --test tests/*.test.mjs` · `node scripts/valida_contraste.mjs` ·
`node scripts/valida_popup.mjs` · `node scripts/valida_snapshot.mjs`.
Todos rodam no CI. O job `qa` não recebe segredos; o job `publish` usa `needs: qa`, o ambiente
protegido `github-pages` e somente `refs/heads/main` em
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). Gate vermelho mantém no ar a versão anterior.

**Publicação automática (ADR-0006/0007):** não há fila de aprovação. A resposta fica numa
planilha privada; um Web App autenticado entrega ao GitHub somente as colunas permitidas.
`scripts/ingerir_csv.mjs` normaliza e isola cadastros inválidos,
`scripts/publicar_snapshot.mjs` gera `data/snapshot.json`, e os gates bloqueiam qualquer deploy
estruturalmente inseguro. Envio do formulário e edição de `remover` disparam a Action; o normal é
cerca de 1 a 2 minutos. O cron de 10 minutos fica isolado em
[`.github/workflows/refresh.yml`](.github/workflows/refresh.yml). Execuções agendadas
bem-sucedidas foram observadas entre 40 e 55 minutos, mas o GitHub não garante prazo e pode
atrasar ou descartar uma rodada. Se ele desativar esse agendamento por inatividade, o disparo
imediato de `ci.yml` continua ativo.

O formulário **não pede dado pessoal** — nem nome, telefone, e-mail ou CREF. Campo livre ainda é
tratado como hostil: telefone, e-mail, CPF/CNPJ e URL fora do lugar são barrados antes do
snapshot. Rede social e rota só viram links em hosts permitidos (`js/util.js`). Coordenada
verificável na URL gera posição exata; caso contrário, o mapa identifica a posição aproximada da
região. Rede social ou mapa ausente/inválido, assim como coordenada confirmada fora do DF,
coloca somente aquele cadastro em quarentena. Nome de pessoa e endereço residencial não podem
ser distinguidos automaticamente de nome de grupo e local público; o formulário proíbe
escrevê-los e a coluna `remover` é a reação rápida.

Ligar a planilha e reimplantar uma **Nova versão** do Web App quando `scripts/criar_form.gs`
mudar: [`moderacao/COMO_LIGAR_A_PLANILHA.md`](moderacao/COMO_LIGAR_A_PLANILHA.md).
O que passa e o que não passa: [`moderacao/COMO_MODERAR.md`](moderacao/COMO_MODERAR.md).

Registro factual da entrega, incidentes e provas de produção:
[`docs/REGISTRO_ENTREGA_PRODUCAO_2026-08-26.md`](docs/REGISTRO_ENTREGA_PRODUCAO_2026-08-26.md).
Molde reutilizável para sistemas semelhantes:
[`docs/BLUEPRINT_MAPA_COMUNITARIO_AUTOMATICO.md`](docs/BLUEPRINT_MAPA_COMUNITARIO_AUTOMATICO.md).

> Não publique a planilha na web e não edite `moderacao/aprovados.json` à mão. Respostas são
> processadas no runner e não entram por commit no histórico público. A configuração única e a
> retirada segura da origem CSV antiga estão no guia acima.

- Plano de execução: [`docs/plano/PLANO_EXECUCAO.md`](docs/plano/PLANO_EXECUCAO.md)
- Divulgação (mensagem pronta, **atual**): [`docs/plano/DIVULGACAO.md`](docs/plano/DIVULGACAO.md)
- Lançamento (Fase 0): [`docs/plano/LANCAMENTO_DIA1.md`](docs/plano/LANCAMENTO_DIA1.md) — datado
  de 23/08, desenho antigo; ver o aviso no topo
- Decisões técnicas (ADRs): [`docs/adr/`](docs/adr/)
- Leaflet 1.9.4 self-hosted e licença: [`vendor/leaflet/`](vendor/leaflet/)
- Estrutura herdada de: `mapa-embaixadores-2026` (site estático, GitHub Pages)

# Blueprint — mapa comunitário automático e seguro

Este é o molde reutilizável extraído do Movimenta7 para sistemas simples onde uma organização
cadastra um ponto/atividade, visitantes encontram o local e seguem uma rota ou contato
institucional.

## Quando usar

Use este desenho quando:

- o site pode ser estático;
- não há conta de usuário nem painel administrativo complexo;
- a contribuição entra por formulário;
- somente informações institucionais/públicas precisam aparecer;
- o proprietário aceita operar uma planilha privada como trilha e freio reversível.

Não use como está para prontuário, finanças, localização de pessoas, menores, denúncia sensível ou
qualquer domínio regulado que exija autenticação, controle por papel e auditoria formal.

## Arquitetura mínima recomendada

1. **Frontend estático:** HTML/CSS/JS, mapa e lista acessível.
2. **Formulário público:** mínimo de campos; nenhum dado pessoal solicitado.
3. **Origem privada:** planilha nunca publicada na web.
4. **Feed servidor-a-servidor:** projeção por allowlist, `POST` autenticado e health `GET` sem dado.
5. **Pipeline:** ingestão → normalização → quarentena por registro → snapshot → gate → deploy.
6. **Atualização:** evento imediato coalescido + cron isolado de reserva.
7. **Operação:** checkbox reversível `remover`; correção por novo cadastro.

## Contrato de dados

Declare uma allowlist pequena antes de criar o formulário. Exemplo:

```text
grupo, organizacao, regiao, modalidades, dias, horario, local_publico,
rede_social_institucional, mapa, tipo_atividade, custo, publico
```

Regras:

- input e output não compartilham schema implícito;
- coluna inesperada é erro estrutural;
- registro inválido é isolado sem congelar os válidos;
- texto é normalizado antes de qualquer detector;
- listas, texto, URLs, bytes totais e quantidade de registros têm teto;
- logs usam índice opaco/linha e classe de erro, nunca o valor;
- o snapshot final tem shape fechado e é validado novamente antes do deploy.

## Links fornecidos pelo público

Link é código de navegação, não “só texto”. Para cada tipo:

1. permita somente HTTPS;
2. use hostname exato, nunca `endsWith` ingênuo;
3. rejeite userinfo e porta;
4. permita somente caminhos necessários;
5. remova query/hash de rastreamento;
6. rejeite PII significativa no payload;
7. em redirect, revalide **cada salto antes do fetch**;
8. bloqueie IP, localhost, link-local, metadata e destino fora da allowlist;
9. limite saltos e timeout total;
10. cacheie por hash da URL, não pela URL crua.

## Localização honesta

- Coordenada na URL/redirect e dentro do polígono atendido → `exata`.
- Sem coordenada confirmável → centro representativo da região, rotulado `aproximada`.
- Coordenada confirmada fora do território → quarentena, não fallback enganoso.
- Coordenada vence seleção de região quando a divergência puder ser corrigida pelo polígono.
- Pontos iguais são legítimos; preserve registros e aplique pequeno deslocamento somente visual.
- Nunca extraia coordenada do corpo genérico de uma página de mapas.

## Frontend resiliente

O mapa é o caminho principal, mas não pode ser o único:

- lista HTML sincronizada com os mesmos filtros;
- rota e rede social disponíveis na lista;
- estados distintos: carregando, vazio, dado indisponível, mapa indisponível e pronto;
- `aria-live`, `aria-busy`, foco e teclado;
- polling em balde de cache compartilhado, mais `focus`/`visibilitychange`;
- dependências executáveis e fontes self-hosted quando viável;
- CSP restrita e nenhum dado comunitário por `innerHTML`;
- tiles com atribuição, tema coerente e fallback.

## Automação e segredos

- Token do feed gerado localmente com CSPRNG, mínimo 128 bits; prefira 256 bits.
- Segredo nunca em código, planilha, URL, log, issue ou chat.
- GitHub Environment secrets somente no job de produção e somente em `main`.
- Token de disparo fine-grained, repositório único, validade curta, permissão mínima.
- `workflow_dispatch`, não `repository_dispatch` quando Contents write não é necessário.
- Coalescer eventos para não transformar spam do formulário em exaustão de cota.
- Separar cron do workflow imediato para que a desativação do schedule não mate o dispatch.
- Pin de Actions por SHA completo; dependências atualizadas por processo explícito.

## Gates mínimos

Antes de publicar:

- testes unitários de parsing, allowlist, PII e links;
- testes de redirect/SSRF salto a salto;
- teste do contrato do formulário e feed;
- teste do schema completo do snapshot;
- gate anti-HTML cru no frontend;
- contraste calculado;
- SRI calculado dos bytes reais, se usado;
- teste em Linux para arquivos cujo hash depende de bytes;
- navegador real/headless provando estado `pronto`;
- CodeQL/secret scanning sem alerta novo;
- artifact construído por allowlist, não pela cópia do repositório inteiro.

## Teste ponta a ponta obrigatório

1. Abrir site e Form em janela anônima, sem login.
2. Enviar cadastro marcado como teste com links reais e local público.
3. Confirmar linha na origem privada.
4. Confirmar dispatch, QA e deploy verdes.
5. Confirmar item na lista, pin, precisão, rota e rede social.
6. Marcar `remover`.
7. Confirmar novo dispatch e desaparecimento do item.
8. Só então divulgar.

Uma suíte verde não substitui este teste porque Apps Script implantado, propriedades, gatilhos,
Environment secrets, CDN/Pages e navegador estão fora do processo Node local.

## Anti-patterns já pagos pelo Movimenta7

- publicar a planilha e tentar sanitizar somente depois;
- confiar a proteção ao navegador;
- aceitar link curto sem ligar a resolução ao pipeline;
- seguir redirect sem revalidar o destino;
- tratar coordenada repetida como cadastro duplicado;
- dizer “posição exata” quando só há região;
- publicar vazio quando a origem obrigatória sumiu;
- buscar snapshot somente no carregamento inicial;
- misturar “sem grupos” com “dados indisponíveis”;
- gerar/logar segredo para facilitar setup;
- disparar uma Action por evento sem lock/debounce;
- usar Actions por tag mutável;
- depender de CDN executável sem fallback/prova de navegador;
- escrever SRI manualmente sem recalcular contra os bytes servidos;
- deixar Git normalizar quebras de linha de arquivo coberto por SRI;
- considerar “teste local verde” como prova de produção.

## Estrutura de referência

```text
index.html
css/
js/
data/                 # somente snapshot e geodados públicos
assets/               # fontes/imagens próprias
vendor/               # dependência auditada + licença
scripts/              # form, ingestão, publicação e gates
tests/
moderacao/             # runbooks; não é fila pública
docs/adr/
.github/workflows/     # QA/publish e cron separado
```

## Definição de pronto

O sistema só está pronto quando código, configuração externa e operação foram comprovados:

- [ ] nenhuma origem pública paralela contém texto cru;
- [ ] segredo ausente/errado impede nova publicação e mantém a anterior;
- [ ] cadastro válido entra automaticamente;
- [ ] cadastro hostil fica em quarentena sem derrubar os demais;
- [ ] remoção reversível funciona;
- [ ] mapa e lista funcionam em desktop/mobile;
- [ ] fallback textual permanece útil sem mapa/tiles;
- [ ] links abrem destinos corretos;
- [ ] CI e CodeQL verdes;
- [ ] navegador limpo validado;
- [ ] rollback e runbook conhecidos pelo proprietário;
- [ ] limites e riscos residuais estão escritos honestamente.

## Fontes internas usadas para este blueprint

- `C:\dev\Engenharia de IA\INDEX.md`
- `C:\dev\Engenharia de IA\FUNDACAO_PROJETOS\SECURITY_BASELINE.md`
- `C:\dev\Engenharia de IA\FUNDACAO_PROJETOS\frontend-baseline\FRONTEND_BASELINE.md`
- `C:\dev\Engenharia de IA\MANUAL_DEPURACAO_PENSAMENTO_SISTEMICO\05_antecipacao_de_falhas.md`
- `C:\dev\Engenharia de IA\PESQUISAS\2026-08-23_cadastro-24h-forms-lgpd_movimenta7.md`
- `C:\dev\Engenharia de IA\PESQUISAS\2026-08-23_leaflet-tiles-geojson-df_movimenta7.md`
- `docs/adr/0007-feed-privado-e-atualizacao-automatica.md`
- `docs/REGISTRO_ENTREGA_PRODUCAO_2026-08-26.md`

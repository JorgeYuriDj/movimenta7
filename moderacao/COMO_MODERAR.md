# Como o mapa decide o que publica

Desde 25/08/2026 (ADR-0006) **não existe fila de aprovação**: quem preenche o formulário
entra no mapa sozinho, em cerca de 10 minutos. Este arquivo explica o que passa, o que não
passa, e o que você faz quando precisa tirar algo do ar.

> A versão anterior deste guia ensinava a copiar campo a campo para
> `moderacao/aprovados.json`. **Esse caminho não existe mais.** Quem escreve esse arquivo
> é `scripts/ingerir_csv.mjs`, a partir da planilha.

## O caminho de um cadastro

1. A pessoa preenche o **Google Form** — que **não pede nenhum dado pessoal**.
2. A resposta cai na planilha, e a aba **PUBLICAR** mostra só as colunas públicas.
3. A cada ~10 minutos o GitHub lê essa aba e roda as checagens automáticas.
4. O que passa vira pin. O que não passa fica de fora, com o motivo escrito no log.

## O que a checagem automática recusa

Um cadastro **não entra** (e só ele; o resto do mapa continua normal) quando algum campo tem:

| O quê | Como é detectado |
|---|---|
| telefone | qualquer formato brasileiro, inclusive dentro de link |
| e-mail | padrão `alguem@algumlugar.com` |
| CPF ou CNPJ | **dígito verificador conferido** — quase nunca dá alarme falso |
| link em campo que não é de link | uma URL escondida no nome do grupo, no local etc. |
| região que o mapa não conhece | comparada com `data/regioes.json` |
| cadastro sem nome de grupo ou sem região | não dá para desenhar |
| cadastro repetido | mesmo grupo + região + local entram uma vez só |

E **o link recusado custa só o link**: se o endereço da rede social ou do mapa não estiver
na lista de destinos aceitos, o grupo entra no mapa assim mesmo, sem o botão.

### Os destinos aceitos nos dois campos de link

- **rede social:** Instagram, Facebook, Threads, YouTube, TikTok, Twitter/X, Strava
  (ou só o `@` — vira Instagram)
- **mapa:** `maps.app.goo.gl`, `maps.google.com`, `google.com/maps`, `goo.gl/maps`,
  OpenStreetMap

Fora disso, não vira link. **WhatsApp saiu da lista de propósito** — o número de telefone
fica dentro da própria URL (`wa.me/5561...`), então publicá-lo seria publicar o telefone.

## O que você faz (e só quando precisar)

**Tirar um grupo do ar:** marque a caixinha `remover` na linha dele, na planilha. Sai na
rodada seguinte, em até ~10 minutos. É o mesmo caminho para pedido de remoção que chegou
pelo formulário, para cadastro falso e para grupo que acabou.

Não existe passo "aprovar". Não existe `git push` para publicar cadastro.

## O que é público

Tudo o que o formulário pergunta na página de cadastro:

nome do grupo · igreja/organização · região · modalidades · dias · horário · local público
de encontro · custo · para quem é aberto · se há profissional de educação física
acompanhando · @ da rede social · link do mapa

**Nada além disso é coletado.** Não há nome de pessoa, telefone nem e-mail na planilha —
e o que não é coletado não pode vazar.

## Se der erro

Os erros aparecem no log do GitHub (Actions > **ci e publicacao**), em português. Eles têm
duas gravidades bem diferentes:

- **`AVISO: linha N ...`** — um cadastro ficou de fora. O site publicou o resto normalmente.
  A mensagem diz a linha e o campo, e **nunca** o conteúdo (o log é público).
- **`INGESTAO ABORTADA` / `PUBLICACAO ABORTADA` / `SNAPSHOT REPROVADO`** — nada foi
  publicado e **o site anterior continua no ar, intacto**. É sinal de planilha errada
  publicada ou de bug no código, não de um cadastro ruim.

Para conferir na sua máquina: `node scripts/valida_snapshot.mjs`. O mesmo teste roda no CI,
e gate vermelho **não sobe** (`needs: qa` em `.github/workflows/ci.yml`).

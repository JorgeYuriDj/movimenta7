# Como colocar um cadastro no mapa (moderação)

Cadastro aprovado **não aparece sozinho** no site. Isso é de propósito: é a trava que
impede dado pessoal de vazar (ADR-0002 / ADR-0004). Um humano decide o que vira público.

## O caminho de um cadastro

1. A pessoa preenche o **Google Form**.
2. A resposta cai na **planilha privada** — que fica só com a moderação e **nunca** entra
   neste repositório.
3. Você lê a resposta e decide se aprova.
4. Você copia **só os campos públicos** para `moderacao/aprovados.json`.
5. Roda `node scripts/publicar_snapshot.mjs` — ele gera o `data/snapshot.json`.
6. `git add -A && git commit -m "publica cadastros aprovados" && git push` — em cerca de
   1 minuto o pin está no ar.

**O passo 4 é manual de propósito.** É ele que garante que o nome e o WhatsApp pessoal de
quem se cadastrou nunca saiam da planilha. Não automatize.

## O que copiar (e o que NUNCA copiar)

| Vai para o site | Fica só na planilha |
|---|---|
| nome do grupo, igreja/organização | seu nome pessoal |
| região, modalidades, dias, horário | seu WhatsApp pessoal |
| local público de encontro | qualquer dado de contato privado |
| o contato que a pessoa marcou como **público** | |

## Formato do arquivo

```json
[
  {
    "grupo": "Corredores da IASD Águas Claras",
    "organizacao": "IASD Águas Claras",
    "regiao": "Águas Claras",
    "modalidades": ["Corrida", "Caminhada"],
    "dias": ["Domingo", "Quarta"],
    "horario": "06h30",
    "local": "Parque Ecológico de Águas Claras, portão principal",
    "contato": "https://chat.whatsapp.com/EXEMPLO"
  }
]
```

- `regiao` precisa bater com o nome oficial da região administrativa (acento e maiúscula
  não importam). Se não bater, o grupo ainda conta no contador, mas fica **sem pin** — o
  script avisa na tela.
- `contato` vira link clicável só se começar com `https://`. Um `@instagram` aparece como
  texto.
- Não precisa informar `lat`/`lon`: o script coloca o grupo no centro da região sozinho,
  usando o mapa oficial do IPEDF. Vários grupos na mesma região ficam lado a lado.

## Se der erro

O script **recusa publicar** e explica o motivo, sem gravar nada. Os dois motivos comuns:

- `campo privado "telefone"` — você copiou um campo que não pode ir para o site. Apague-o.
- `campo desconhecido "X"` — só os campos da tabela acima entram.

Depois de publicar, confira com `node scripts/valida_snapshot.mjs`. O mesmo teste roda no
CI: se passar dado privado, o site **não sobe**.

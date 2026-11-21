# Corporate Chat — Frontend

Interface web do Corporate Chat desenvolvida
com React, JavaScript e Vite.

## Pré-requisitos

- Node.js compatível com Vite
- npm
- Backend Corporate Chat configurado

## Instalação

cd frontend
npm ci

## Configuração

Copie .env.example para .env.local.

Configure VITE_BACKEND_URL com o endereço
do backend.

## Desenvolvimento

npm run dev

## Validação

npm run lint
npm test
npm run build

## Integração

A interface utiliza a API REST do backend,
sob o prefixo /api/v1.

A comunicação em tempo real será realizada
por Socket.IO, conforme a documentação
do projeto.
## Funcionalidades implementadas

| PBI | Funcionalidade |
|---|---|
| FE-01 | Estrutura React/Vite, roteamento e cliente HTTP |
| FE-02 | Login, logout, rota protegida e solicitação de cadastro |
| FE-03 | Dashboard com contatos e conversas recentes |
| FE-04 | Conversas privadas e mensagens |
| FE-06 | Comunicação em tempo real (Socket.IO) |

### FE-04 — Conversas privadas e mensagens

- Selecionar um contato cria ou reutiliza a conversa privada
  (`POST /conversations/private`).
- Conversas recentes podem ser abertas pela lista; grupos possuem
  ícone e etiqueta próprios.
- O histórico carrega as 50 mensagens mais recentes e páginas
  anteriores pelo cursor do backend (`before`), ao rolar até o topo
  ou pelo botão "Carregar mensagens anteriores".
- Cada mensagem exibe autor e data/hora; a rolagem inicia na
  mensagem mais recente.
- Envio limitado a 1.000 caracteres, sem mensagens vazias, com os
  estados Enviando → Enviada ou Falha.
- Mensagens com falha podem ser reenviadas e são reenviadas
  automaticamente quando o navegador volta a ficar online, sempre
  com o mesmo `clientMessageId` (envio idempotente).
- A leitura da última mensagem recebida é registrada em
  `PATCH /conversations/:id/read`.

### FE-06 — Comunicação em tempo real

- Uma única conexão Socket.IO por sessão (`RealtimeProvider`): conecta
  após o login, desconecta no logout e encerra a sessão se o backend
  recusar o token.
- Com o socket conectado, o envio usa `message:send` (com ACK) e as
  mensagens chegam por `message:new`, sem recarregar a página. Sem
  socket, o envio continua pela API REST.
- Entrega e leitura são confirmadas por `message:delivered` e
  `message:read`; as mensagens próprias exibem Entregue/Lida a partir
  de `message:delivery:update` e `message:read:update` (em grupos,
  "Lida por N").
- Queda da conexão exibe "Reconectando...". Ao reconectar, a conversa
  aberta é sincronizada com `realtime:sync` e as mensagens com falha
  são reenviadas com o mesmo `clientMessageId`.
- O dashboard atualiza a lista de conversas ao chegar mensagem nova e
  confirma a entrega mesmo com a conversa fechada.

Limitação: o backend não informa os checkpoints dos outros
participantes ao abrir a conversa; por isso, mensagens antigas aparecem
como "Enviada" e Entregue/Lida são atualizados a partir dos eventos em
tempo real.

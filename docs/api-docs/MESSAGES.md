# Corporate Chat — API de Mensagens, Entrega e Leitura

## 1. Visão geral

A API de mensagens do Corporate Chat permite o envio de mensagens de texto em conversas privadas e grupos, bem como o registro de entrega e leitura por participante.

Os recursos utilizam a persistência de comunicação armazenada no MongoDB e a identidade dos usuários mantida no PostgreSQL.

Todos os endpoints descritos neste documento exigem autenticação.

## 2. Base URL

```text
/api/v1/conversations
```

## 3. Autenticação

As requisições devem utilizar um token JWT válido:

```http
Authorization: Bearer <token>
```

A identidade do remetente e do participante responsável pelos checkpoints de entrega e leitura é obtida exclusivamente do usuário autenticado.

Campos como `senderId` ou `userId` enviados pelo cliente não substituem a identidade autenticada.

## 4. Regras gerais

A implementação segue as seguintes regras:

- somente usuários autenticados e ativos podem utilizar os endpoints;
- somente membros `ACTIVE` podem interagir com uma conversa;
- mensagens podem ser enviadas em conversas `PRIVATE` e `GROUP`;
- o MVP aceita somente mensagens de texto;
- mensagens vazias são rejeitadas;
- o conteúdo possui limite máximo de 1.000 caracteres;
- toda mensagem persistida possui data e hora;
- `clientMessageId` é obrigatório para permitir reenvio idempotente;
- um reenvio do mesmo `clientMessageId` pelo mesmo remetente reutiliza a mensagem persistida;
- checkpoints de entrega e leitura são mantidos individualmente para cada participante;
- checkpoints não podem regredir para mensagens anteriores;
- registrar uma mensagem como lida também garante que ela esteja registrada como entregue.

## 5. Estados da mensagem

O requisito funcional define o seguinte fluxo:

```text
Enviando → Enviada → Entregue → Lida

Falha
```

### Enviando

Estado transitório mantido pelo cliente enquanto a requisição ainda não foi confirmada pelo backend.

### Enviada

A mensagem foi aceita e persistida pelo backend.

### Entregue

O participante confirmou a disponibilização da mensagem e seu vínculo em `conversation_members` avançou o checkpoint de entrega.

### Lida

O participante confirmou a leitura e seu checkpoint de leitura foi atualizado.

Uma mensagem marcada como lida também é considerada entregue.

### Falha

Representa falha no envio ou processamento. A apresentação desse estado é responsabilidade da interface cliente a partir da falha da operação HTTP ou, futuramente, da camada de comunicação em tempo real.

---

## 6. Enviar mensagem

### Endpoint

```http
POST /api/v1/conversations/:conversationId/messages
```

### Body

```json
{
  "clientMessageId": "web-123456",
  "content": "Olá, tudo bem?"
}
```

### Resposta — mensagem criada

```http
201 Created
```

```json
{
  "data": {
    "message": {
      "_id": "690000000000000000000001",
      "conversation_id": "680000000000000000000001",
      "sender_id": "22222222-2222-4222-8222-222222222222",
      "client_message_id": "web-123456",
      "content": "Olá, tudo bem?",
      "created_at": "2030-01-01T10:00:00.000Z"
    },
    "reused": false
  }
}
```

### Reenvio idempotente

Quando o mesmo remetente repete um `clientMessageId` já persistido:

```http
200 OK
```

```json
{
  "data": {
    "message": {
      "_id": "690000000000000000000001",
      "conversation_id": "680000000000000000000001",
      "sender_id": "22222222-2222-4222-8222-222222222222",
      "client_message_id": "web-123456",
      "content": "Olá, tudo bem?",
      "created_at": "2030-01-01T10:00:00.000Z"
    },
    "reused": true
  }
}
```

A idempotência permite que clientes realizem novamente uma operação após perda de conexão sem criar automaticamente mensagens duplicadas.

---

## 7. Registrar entrega

### Endpoint

```http
PATCH /api/v1/conversations/:conversationId/delivery
```

### Body

```json
{
  "messageId": "690000000000000000000001"
}
```

### Resposta

```http
200 OK
```

```json
{
  "data": {
    "checkpoint": {
      "conversation_id": "680000000000000000000001",
      "user_id": "22222222-2222-4222-8222-222222222222",
      "last_delivered_message_id": "690000000000000000000001",
      "last_delivered_at": "2030-01-01T10:01:00.000Z",
      "last_read_message_id": null,
      "last_read_at": null
    },
    "advanced": true
  }
}
```

O checkpoint é monotônico. Uma confirmação referente a uma mensagem anterior à já confirmada não faz o estado retroceder.

Nesse caso, a operação continua válida, mas retorna:

```json
{
  "advanced": false
}
```

---

## 8. Registrar leitura

### Endpoint

```http
PATCH /api/v1/conversations/:conversationId/read
```

### Body

```json
{
  "messageId": "690000000000000000000001"
}
```

### Resposta

```http
200 OK
```

```json
{
  "data": {
    "checkpoint": {
      "conversation_id": "680000000000000000000001",
      "user_id": "22222222-2222-4222-8222-222222222222",
      "last_delivered_message_id": "690000000000000000000001",
      "last_delivered_at": "2030-01-01T10:01:00.000Z",
      "last_read_message_id": "690000000000000000000001",
      "last_read_at": "2030-01-01T10:02:00.000Z"
    },
    "advanced": true,
    "deliveryAdvanced": true
  }
}
```

Registrar leitura garante que o checkpoint de entrega esteja no mínimo na mesma mensagem.

---

## 9. Segurança e autorização

A API utiliza o usuário autenticado como fonte da identidade.

No envio:

```text
sender_id = usuário autenticado
```

Na entrega e leitura:

```text
user_id = usuário autenticado
```

Um usuário que não seja membro `ACTIVE` da conversa não pode:

- enviar mensagens;
- registrar entrega;
- registrar leitura;
- utilizar o histórico protegido da conversa.

Essa regra vale para conversas privadas e grupos.

### Proteção contra enumeração de recursos

Nos endpoints de entrega e leitura, a autorização do participante é validada antes da consulta da mensagem.

Dessa forma, um usuário que não possua vínculo `ACTIVE` com a conversa recebe `403 USER_NOT_ACTIVE_MEMBER` sem que a API revele se determinada mensagem ou conversa possui conteúdo acessível.

Essa ordem de validação reduz a exposição de informações sobre recursos aos quais o usuário não possui acesso.

---

## 10. Principais erros

| HTTP | Código | Situação |
|---|---|---|
| 400 | `INVALID_CONVERSATION_ID` | Identificador da conversa inválido |
| 400 | `INVALID_MESSAGE_ID` | Identificador da mensagem inválido |
| 400 | `CLIENT_MESSAGE_ID_REQUIRED` | `clientMessageId` não informado |
| 400 | `MESSAGE_CONTENT_REQUIRED` | Mensagem vazia |
| 400 | `MESSAGE_CONTENT_TOO_LONG` | Conteúdo acima de 1.000 caracteres |
| 401 | `TOKEN_MISSING` | Token ausente ou mal formatado |
| 401 | `TOKEN_INVALID` | Token inválido |
| 403 | `USER_INACTIVE` | Usuário desativado |
| 403 | `SENDER_NOT_ACTIVE_MEMBER` | Remetente não participa ativamente da conversa |
| 403 | `USER_NOT_ACTIVE_MEMBER` | Usuário não é membro ativo |
| 404 | `CONVERSATION_NOT_FOUND` | Conversa inexistente durante o envio de mensagem |
| 404 | `MESSAGE_NOT_FOUND` | Mensagem não pertence à conversa informada |
| 409 | `CLIENT_MESSAGE_ID_CONFLICT` | Identificador reutilizado em contexto incompatível |
| 409 | `MESSAGE_CHECKPOINT_CONFLICT` | Conflito concorrente ao avançar checkpoint |


Erros inesperados retornam resposta genérica com `INTERNAL_ERROR`, sem exposição de detalhes internos.

---

## 11. Mensagens para usuários offline

A persistência de uma mensagem não depende do destinatário estar conectado.

Uma mensagem persistida permanece armazenada no MongoDB e pode ser recuperada posteriormente através do histórico da conversa.

A idempotência por `clientMessageId` fornece a base necessária para reenvios seguros.

A detecção automática de reconexão, o disparo do reenvio e a indicação visual de falha pertencem à camada cliente e à futura integração de comunicação em tempo real.

---

## 12. Mensagens em grupo

Conversas de grupo utilizam a mesma estrutura de mensagens das conversas privadas.

A autorização é baseada em `conversation_members`.

Somente membros com status `ACTIVE` podem acessar novas mensagens da conversa.

As mensagens persistidas continuam disponíveis no histórico.

A entrega em tempo real para participantes conectados será tratada pela camada Socket.IO e não faz parte dos endpoints HTTP descritos neste documento.

---

## 13. Persistência dos estados de entrega e leitura

Os estados não são armazenados como um campo global em cada mensagem.

Cada participante possui seus próprios checkpoints:

```text
conversation_members
├── last_delivered_message_id
├── last_delivered_at
├── last_read_message_id
└── last_read_at
```

Esse modelo permite que uma mensagem de grupo esteja, por exemplo:

```text
Participante A → Lida
Participante B → Entregue
Participante C → ainda não entregue
```

sem modificar o documento original da mensagem.

---

## 14. Testes

A implementação possui testes automatizados em duas camadas.

### Integração

```text
backend/database/tests/integration/messages-integration.test.js
```

Valida a integração real com PostgreSQL e MongoDB, incluindo:

- envio e persistência;
- atualização da última mensagem;
- idempotência;
- conversas privadas;
- mensagens em grupo;
- autorização de membros;
- checkpoints de entrega;
- checkpoints de leitura;
- não regressão;
- concorrência.

### API

```text
backend/tests/api/messages.test.js
```

Valida:

- contratos HTTP;
- autenticação;
- identidade derivada do token;
- códigos de resposta;
- erros operacionais;
- tratamento de JSON inválido;
- proteção contra exposição de erros internos.

A regressão completa do backend pode ser executada com:

```bash
npm run verify:persistence
```
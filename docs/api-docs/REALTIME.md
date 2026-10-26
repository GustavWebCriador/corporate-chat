# Corporate Chat — Comunicação em Tempo Real

## 1. Objetivo

O Corporate Chat utiliza Socket.IO como infraestrutura de comunicação em tempo real.

A camada realtime compartilha o mesmo servidor HTTP utilizado pela API Express e exige autenticação antes que uma conexão Socket.IO seja aceita.

Esta documentação descreve a infraestrutura de comunicação em tempo real do Corporate Chat, incluindo autenticação da conexão, ciclo de vida dos sockets, envio e distribuição de mensagens, confirmação de entrega e leitura, reconexão e sincronização após períodos de desconexão.

---

## 2. Escopo atual

A infraestrutura realtime atualmente contempla:

- inicialização do Socket.IO sobre o mesmo servidor HTTP da API;
- autenticação da conexão utilizando JWT;
- validação da sessão persistida no PostgreSQL;
- rejeição de sessões revogadas ou expiradas;
- rejeição de usuários com status `INACTIVE`;
- associação da identidade autenticada a `socket.data.user`;
- registro das conexões ativas por usuário;
- suporte a múltiplas conexões simultâneas para a mesma identidade;
- sala privada por usuário no formato `user:<user_id>`;
- envio de mensagens através de Socket.IO;
- persistência das mensagens antes da distribuição realtime;
- distribuição de novas mensagens para todos os membros `ACTIVE` da conversa;
- confirmação realtime de entrega;
- confirmação realtime de leitura;
- checkpoints monotônicos de entrega e leitura;
- Connection State Recovery para interrupções temporárias;
- reconexão automática do cliente;
- nova autenticação durante a reconexão;
- sincronização incremental de mensagens após perda de conexão;
- sincronização por snapshot quando o cliente não possui cursor local;
- paginação das mensagens perdidas durante períodos prolongados de desconexão;
- remoção da conexão do registry após `disconnect`.

A persistência das mensagens no MongoDB permanece como fonte autoritativa do estado do chat.

O Socket.IO é utilizado como mecanismo de transporte em tempo real. Caso a recuperação automática da conexão não seja suficiente, o cliente deve reconciliar seu estado através do mecanismo `realtime:sync`.

---

## 3. Endpoint Socket.IO

O Socket.IO utiliza o path padrão:

```text
/socket.io/
```

Express e Socket.IO compartilham o mesmo servidor HTTP e a mesma porta da aplicação.

---

## 4. Autenticação da conexão

O cliente deve informar o JWT através do campo `auth.token` do handshake Socket.IO.

Exemplo conceitual:

```javascript
const socket = io(SERVER_URL, {
    auth: {
        token,
    },
});
```

O servidor não utiliza `userId`, `senderId` ou outro identificador informado pelo cliente para definir a identidade da conexão.

A identidade é obtida exclusivamente a partir do token autenticado.

---

## 5. Fluxo de autenticação

```text
Cliente
   |
   | auth.token
   v
Socket.IO middleware
   |
   v
authService.authenticateToken()
   |
   +-- valida assinatura JWT
   +-- valida expiração
   +-- valida sub
   +-- valida jti
   +-- consulta auth_sessions
   +-- verifica revogação
   +-- consulta usuário atual
   +-- verifica status ACTIVE
   |
   v
socket.data.user
   |
   v
conexão aceita
```

O mesmo `authService` utilizado pela API HTTP é reutilizado pela camada Socket.IO.

Dessa forma, não existem duas implementações independentes das regras de autenticação.

---

## 6. Erros de conexão

Quando a autenticação não é aprovada, a conexão é recusada através do evento `connect_error`.

Formato conceitual:

```text
message:
Não foi possível autenticar a conexão.

data.code:
<TIPO_DO_ERRO>
```

Códigos expostos pelo contrato realtime:

| Código | Situação |
|---|---|
| `TOKEN_MISSING` | Token não informado |
| `TOKEN_INVALID` | JWT ou sessão inválidos |
| `TOKEN_EXPIRED` | Token ou sessão expirados |
| `TOKEN_REVOKED` | Sessão encerrada/revogada |
| `USER_INACTIVE` | Usuário não está `ACTIVE` |
| `SOCKET_AUTH_ERROR` | Falha não segura para exposição |

Mensagens internas e códigos de outras camadas não são propagados ao cliente.

---

## 7. Identidade do socket

Após autenticação:

```javascript
socket.data.user
```

contém os dados públicos do usuário autenticado.

A identificação das operações realtime utiliza:

```javascript
socket.data.user.user_id
```

O servidor não confia em identificadores de usuário enviados no payload dos eventos.

Essa regra é aplicada ao envio de mensagens, confirmação de entrega, confirmação de leitura e sincronização após reconexão.

---

## 8. Ciclo de vida da conexão

Cada conexão possui um `socket.id` próprio.

Esse identificador representa uma conexão física e não deve ser utilizado como identidade permanente do usuário.

Um usuário pode possuir múltiplas conexões simultâneas, por exemplo:

```text
usuário
├── navegador — aba 1
├── navegador — aba 2
└── dispositivo móvel
```

O `connectionRegistry` mantém:

```text
user_id -> Set<socket.id>
```

O usuário é considerado online enquanto possuir pelo menos uma conexão registrada.

Quando uma nova conexão autenticada é aceita:

1. a identidade é obtida de `socket.data.user`;
2. o `socket.id` é registrado no `connectionRegistry`;
3. o socket entra na room privada do usuário;
4. o servidor emite `realtime:ready`;
5. os handlers funcionais de mensagem e sincronização são registrados.

---

## 9. Sala privada do usuário

Cada conexão autenticada entra automaticamente em uma sala com o padrão:

```text
user:<user_id>
```

Exemplo:

```text
user:22222222-2222-4222-8222-222222222222
```

A sala privada é utilizada para distribuir eventos a todas as conexões pertencentes à mesma identidade.

Dessa forma, um mesmo usuário pode receber atualizações em múltiplas abas ou dispositivos simultaneamente.

No envio de mensagens e nas atualizações de entrega e leitura, o backend identifica os membros `ACTIVE` da conversa e distribui os eventos para suas respectivas salas privadas.

A sala `user:<user_id>` representa um usuário e não uma conversa.

No escopo atual, não são mantidas rooms permanentes no formato `conversation:<id>`. A audiência é determinada consultando os membros ativos da conversa no momento da distribuição.

---

## 10. Disconnect

Quando uma conexão é encerrada:

1. o Socket.IO remove automaticamente o socket das rooms;
2. o backend remove o `socket.id` do `connectionRegistry`;
3. se ainda existirem sockets para o mesmo usuário, ele permanece online;
4. quando a última conexão é removida, o usuário deixa de possuir conexões ativas.

O `connectionRegistry` mantém apenas estado efêmero de presença e não substitui os dados persistidos no PostgreSQL ou MongoDB.

---

## 11. Reconexão e recuperação de estado

O Socket.IO está configurado para realizar tentativas automáticas de reconexão após interrupções temporárias do transporte.

O servidor também utiliza `connectionStateRecovery` com uma janela de recuperação de dois minutos:

```text
maxDisconnectionDuration = 2 minutos
skipMiddlewares = false
```

O valor `skipMiddlewares = false` mantém a passagem pelo middleware de autenticação durante a recuperação.

Isso permite considerar mudanças ocorridas durante a desconexão, como:

- logout;
- revogação da sessão;
- expiração do token;
- desativação do usuário.

Após uma conexão ou reconexão bem-sucedida, o servidor emite:

```text
realtime:ready
```

com o formato:

```json
{
  "recovered": false,
  "connectedAt": "2030-01-01T10:00:00.000Z"
}
```

O campo `recovered` informa se o Socket.IO conseguiu recuperar o estado da conexão anterior.

### 11.1. Recuperação bem-sucedida

Quando:

```text
recovered = true
```

o Socket.IO conseguiu recuperar o estado temporário da conexão anterior.

### 11.2. Recuperação não realizada

Quando:

```text
recovered = false
```

o cliente não deve assumir que recebeu todos os eventos ocorridos enquanto esteve desconectado.

Nesse cenário deve utilizar:

```text
realtime:sync
```

para reconciliar o estado local com as mensagens persistidas.

A recuperação automática do Socket.IO funciona como otimização para interrupções temporárias. O MongoDB permanece como fonte autoritativa para recuperação das mensagens.

---

## 12. Persistência da presença

O estado de conexão não é persistido no PostgreSQL nem no MongoDB.

O registry permanece em memória no processo Node.js.

Essa estratégia atende ao ambiente atual de uma única instância da aplicação.

Em uma arquitetura com múltiplas instâncias, será necessário utilizar um mecanismo distribuído de presença e um adapter compatível com o Socket.IO.

---

## 13. Eventos realtime

Os eventos utilizados atualmente são:

| Evento | Direção | Responsabilidade |
|---|---|---|
| `realtime:ready` | servidor → cliente | Informa que a conexão está pronta e se houve recuperação |
| `realtime:sync` | cliente → servidor | Solicita sincronização após perda de conexão |
| `message:send` | cliente → servidor | Envia uma nova mensagem |
| `message:new` | servidor → cliente | Distribui uma mensagem persistida |
| `message:delivered` | cliente → servidor | Confirma entrega até determinada mensagem |
| `message:delivery:update` | servidor → cliente | Distribui checkpoint de entrega |
| `message:read` | cliente → servidor | Confirma leitura até determinada mensagem |
| `message:read:update` | servidor → cliente | Distribui checkpoint de leitura |

Os eventos enviados pelo cliente utilizam acknowledgement quando precisam confirmar o resultado da operação.

---

## 14. Envio de mensagens

### 14.1. Evento `message:send`

O cliente envia:

```json
{
  "conversationId": "507f1f77bcf86cd799439011",
  "clientMessageId": "identificador-gerado-pelo-cliente",
  "content": "Olá!"
}
```

A identidade do remetente não é obtida do payload.

O backend utiliza exclusivamente:

```javascript
socket.data.user.user_id
```

Fluxo:

```text
message:send
    |
    v
messageService.sendMessage()
    |
    +-- valida usuário
    +-- valida membership ACTIVE
    +-- valida conteúdo
    +-- aplica idempotência
    +-- persiste no MongoDB
    |
    v
membros ACTIVE da conversa
    |
    v
user:<user_id>
    |
    v
message:new
```

A mensagem somente é distribuída depois de sua persistência.

### 14.2. ACK de sucesso

Exemplo:

```json
{
  "ok": true,
  "data": {
    "message": {
      "_id": "607f1f77bcf86cd799439011",
      "conversation_id": "507f1f77bcf86cd799439011",
      "sender_id": "uuid",
      "client_message_id": "identificador-gerado-pelo-cliente",
      "content": "Olá!",
      "created_at": "2030-01-01T10:00:00.000Z"
    },
    "reused": false
  }
}
```

O campo `reused` indica se a mensagem já havia sido persistida anteriormente utilizando o mesmo `clientMessageId`.

A idempotência permite que o cliente repita uma operação cujo ACK tenha sido perdido sem criar uma nova mensagem no banco.

### 14.3. Evento `message:new`

Após persistência, os membros ativos recebem:

```json
{
  "message": {
    "_id": "607f1f77bcf86cd799439011",
    "conversation_id": "507f1f77bcf86cd799439011",
    "sender_id": "uuid",
    "client_message_id": "identificador-gerado-pelo-cliente",
    "content": "Olá!",
    "created_at": "2030-01-01T10:00:00.000Z"
  }
}
```

O próprio remetente também pode receber `message:new` em suas conexões ativas.

O cliente deve tratar mensagens recebidas de forma idempotente, utilizando o identificador persistido da mensagem para evitar duplicações visuais em cenários de retry ou reconexão.

---

## 15. Entrega e leitura

Os estados de entrega e leitura são mantidos como checkpoints por participante da conversa.

Essa modelagem permite representar corretamente grupos, nos quais cada participante pode possuir um ponto diferente de entrega e leitura.

### 15.1. Entrega

O cliente envia:

```text
message:delivered
```

Payload:

```json
{
  "conversationId": "507f1f77bcf86cd799439011",
  "messageId": "607f1f77bcf86cd799439011"
}
```

A identidade responsável pelo checkpoint é obtida de `socket.data.user.user_id`.

Após validação e atualização, os participantes conectados recebem:

```text
message:delivery:update
```

Exemplo:

```json
{
  "checkpoint": {
    "conversation_id": "507f1f77bcf86cd799439011",
    "user_id": "uuid",
    "last_delivered_message_id": "607f1f77bcf86cd799439011",
    "last_delivered_at": "2030-01-01T10:01:00.000Z",
    "last_read_message_id": null,
    "last_read_at": null
  },
  "advanced": true
}
```

### 15.2. Leitura

O cliente envia:

```text
message:read
```

Payload:

```json
{
  "conversationId": "507f1f77bcf86cd799439011",
  "messageId": "607f1f77bcf86cd799439011"
}
```

O serviço garante que uma mensagem marcada como lida também esteja marcada como entregue.

Os participantes conectados recebem:

```text
message:read:update
```

Exemplo conceitual:

```json
{
  "checkpoint": {
    "conversation_id": "507f1f77bcf86cd799439011",
    "user_id": "uuid",
    "last_delivered_message_id": "607f1f77bcf86cd799439011",
    "last_delivered_at": "2030-01-01T10:01:00.000Z",
    "last_read_message_id": "607f1f77bcf86cd799439011",
    "last_read_at": "2030-01-01T10:02:00.000Z"
  },
  "advanced": true,
  "deliveryAdvanced": true
}
```

### 15.3. Monotonicidade dos checkpoints

Os checkpoints são monotônicos.

Uma confirmação referente a uma mensagem anterior não faz o estado persistido de entrega ou leitura regredir.

Mesmo quando `advanced` é `false`, o backend pode redistribuir o checkpoint autoritativo já persistido, permitindo que clientes desatualizados reconciliem seu estado.

---

## 16. Sincronização após reconexão

O evento:

```text
realtime:sync
```

permite recuperar mensagens persistidas que podem não ter sido recebidas durante uma interrupção.

A sincronização reutiliza as mesmas regras de membership da aplicação e somente permite acesso a membros `ACTIVE` da conversa.

### 16.1. Sincronização incremental

Quando o cliente conhece a última mensagem local, envia:

```json
{
  "conversationId": "507f1f77bcf86cd799439011",
  "afterMessageId": "607f1f77bcf86cd799439011",
  "limit": 50
}
```

O servidor retorna somente mensagens posteriores ao cursor informado.

Exemplo:

```json
{
  "ok": true,
  "data": {
    "mode": "incremental",
    "items": [],
    "hasMore": false,
    "nextAfterMessageId": "607f1f77bcf86cd799439011"
  }
}
```

Quando `hasMore` for `true`, o cliente deve realizar outra sincronização utilizando `nextAfterMessageId`.

Isso permite recuperar períodos de desconexão que contenham mais mensagens do que o limite de uma única página.

A ordenação utilizada considera:

```text
created_at
_id
```

preservando a mesma regra utilizada pelos mecanismos de histórico e checkpoints.

### 16.2. Snapshot

Quando `afterMessageId` não é informado, o serviço pode retornar um snapshot das mensagens mais recentes.

Requisição:

```json
{
  "conversationId": "507f1f77bcf86cd799439011",
  "limit": 50
}
```

Resposta conceitual:

```json
{
  "ok": true,
  "data": {
    "mode": "snapshot",
    "items": [],
    "hasMore": false,
    "nextAfterMessageId": null
  }
}
```

### 16.3. Autorização

A identidade utilizada para sincronização é sempre derivada de:

```javascript
socket.data.user.user_id
```

Um `userId` informado pelo cliente não substitui a identidade autenticada.

Usuários que não pertencem à conversa não podem utilizar a sincronização para consultar suas mensagens.

---

## 17. Erros dos eventos realtime

Operações realtime que utilizam acknowledgement retornam erros no formato:

```json
{
  "ok": false,
  "error": {
    "code": "CODIGO_DO_ERRO",
    "message": "Descrição segura do erro."
  }
}
```

Erros operacionais conhecidos podem ser apresentados ao cliente utilizando códigos de aplicação apropriados.

Erros inesperados são sanitizados:

```json
{
  "ok": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Erro interno do servidor."
  }
}
```

Stacks, detalhes internos e mensagens inesperadas não são expostos ao cliente.

---

## 18. Segurança

A camada realtime segue as seguintes regras:

- somente conexões autenticadas são aceitas;
- JWT é enviado pelo handshake `auth`;
- a identidade é derivada da sessão autenticada;
- `userId` e `senderId` enviados pelo cliente não substituem a identidade autenticada;
- sessões revogadas são rejeitadas;
- usuários `INACTIVE` são rejeitados;
- somente membros `ACTIVE` podem acessar mensagens e sincronização de uma conversa;
- mensagens são persistidas antes do broadcast;
- entrega e leitura reutilizam as regras da camada de serviço existente;
- erros inesperados não são enviados ao cliente;
- códigos de autenticação expostos utilizam whitelist;
- dados sensíveis, como `password_hash`, não são armazenados em `socket.data`;
- a recuperação da conexão não elimina a necessidade de autorização e reconciliação com a persistência.

---

## 19. Testes

A infraestrutura realtime possui testes automatizados para:

- conexão autenticada;
- armazenamento da identidade em `socket.data.user`;
- ausência de token;
- token inválido;
- token expirado;
- sessão revogada;
- usuário inativo;
- tentativa de falsificação de identidade;
- proteção contra vazamento de erro interno;
- proteção contra exposição de códigos não autorizados;
- integração real com JWT e PostgreSQL;
- logout e revogação reais;
- desativação do usuário após login;
- registro e remoção de conexões;
- múltiplas conexões do mesmo usuário;
- isolamento entre usuários;
- gerenciamento da room privada;
- comportamento do `connectionRegistry`;
- envio de mensagens em tempo real;
- distribuição de mensagens aos membros ativos;
- tentativa de falsificação do `senderId`;
- idempotência do envio;
- confirmação realtime de entrega;
- confirmação realtime de leitura;
- não regressão dos checkpoints;
- propagação do estado autoritativo;
- sincronização incremental;
- sincronização por snapshot;
- proteção da sincronização por membership;
- paginação das mensagens perdidas;
- reconexão automática após falha de transporte;
- nova autenticação após reconexão;
- continuidade do `realtime:sync` depois da reconexão.

### 19.1. Execução

```bash
npm run test:realtime
```

Na validação atual da camada realtime foram executados:

```text
36 testes
36 aprovados
0 falhas
```

Os testes de integração real fazem parte de:

```bash
npm run test:integration
```

Na validação atual da suíte de integração foram executados:

```text
69 testes
69 aprovados
0 falhas
```

A regressão completa é executada através de:

```bash
npm test
```

---

## 20. Arquivos principais

```text
backend/src/realtime/socketServer.js
backend/src/realtime/connectionRegistry.js
backend/src/realtime/rooms.js
backend/src/realtime/events.js
backend/src/realtime/ack.js
backend/src/realtime/messageHandlers.js
backend/src/realtime/realtimeAudienceService.js
backend/src/realtime/realtimeSyncService.js
backend/src/realtime/syncHandlers.js

backend/src/services/messages/messageService.js
backend/src/services/queries/messageQueryService.js

backend/tests/realtime/connection-registry.test.js
backend/tests/realtime/socket-auth.test.js
backend/tests/realtime/socket-lifecycle.test.js
backend/tests/realtime/socket-messages.test.js
backend/tests/realtime/socket-message-status.test.js
backend/tests/realtime/socket-sync.test.js
backend/tests/realtime/socket-reconnection.test.js

backend/database/tests/integration/messages-integration.test.js
backend/database/tests/integration/socket-auth-integration.test.js
```

---

## 21. Limitações atuais e evolução

A implementação atual atende ao cenário de uma única instância do backend.

Em uma futura arquitetura distribuída, deverão ser reavaliados:

- `connectionRegistry` em memória;
- coordenação de presença entre instâncias;
- adapter distribuído do Socket.IO;
- recuperação de eventos entre processos;
- observabilidade das conexões realtime;
- métricas de reconexão e falhas;
- limites e proteção contra abuso de eventos.

Esses itens representam evolução arquitetural e não são necessários para o funcionamento atual do MVP.

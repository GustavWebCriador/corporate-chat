# Corporate Chat — Comunicação em Tempo Real

## 1. Objetivo

O Corporate Chat utiliza Socket.IO como infraestrutura de comunicação em tempo real.

A camada realtime compartilha o mesmo servidor HTTP utilizado pela API Express e exige autenticação antes que uma conexão Socket.IO seja aceita.

Esta documentação descreve a infraestrutura atualmente implementada para conexão, autenticação e ciclo de vida dos sockets.

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
- sala privada por usuário;
- remoção da conexão do registry após `disconnect`.

Ainda não fazem parte desta entrega:

- entrada em salas de conversa;
- envio de mensagens por Socket.IO;
- broadcast de novas mensagens;
- confirmação realtime de entrega;
- confirmação realtime de leitura;
- sincronização de mensagens após reconexão.

Esses recursos utilizarão a infraestrutura de conexão autenticada descrita neste documento.

## 3. Endpoint Socket.IO

O Socket.IO utiliza o path padrão:

```text
/socket.io/
```

Express e Socket.IO compartilham o mesmo servidor HTTP e a mesma porta da aplicação.

## 4. Autenticação da conexão

O cliente deve informar o JWT através do campo `auth.token` do handshake Socket.IO.

Exemplo conceitual do cliente:

```javascript
const socket = io(SERVER_URL, {
    auth: {
        token,
    },
});
```

O servidor não utiliza `userId`, `senderId` ou outro identificador informado pelo cliente para definir a identidade da conexão.

A identidade é obtida exclusivamente a partir do token autenticado.

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
connection aceita
```

O mesmo `authService` utilizado pela API HTTP é reutilizado pela camada Socket.IO.

Dessa forma, não existem duas implementações independentes das regras de autenticação.

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
| `TOKEN_MISSING` | token não informado |
| `TOKEN_INVALID` | JWT ou sessão inválidos |
| `TOKEN_EXPIRED` | token ou sessão expirados |
| `TOKEN_REVOKED` | sessão encerrada/revogada |
| `USER_INACTIVE` | usuário não está ACTIVE |
| `SOCKET_AUTH_ERROR` | falha não segura para exposição |

Mensagens internas e códigos de outras camadas não são propagados ao cliente.

## 7. Identidade do socket

Após autenticação:

```javascript
socket.data.user
```

contém os dados públicos do usuário autenticado.

A identificação das operações realtime deverá utilizar:

```javascript
socket.data.user.user_id
```

O servidor não deve confiar em identificadores de usuário enviados no payload dos eventos.

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

## 9. Sala privada do usuário

Cada conexão autenticada entra automaticamente em uma sala com o padrão:

```text
user:<user_id>
```

Exemplo:

```text
user:22222222-2222-4222-8222-222222222222
```

Essa sala poderá ser utilizada posteriormente para entregar eventos a todas as conexões pertencentes ao mesmo usuário.

Ela não representa uma conversa.

Salas de conversa serão tratadas separadamente.

## 10. Disconnect

Quando uma conexão é encerrada:

1. Socket.IO remove automaticamente o socket das rooms;
2. o backend remove o `socket.id` do `connectionRegistry`;
3. se ainda existirem sockets para o mesmo usuário, ele permanece online;
4. quando a última conexão é removida, o usuário deixa de possuir conexões ativas.

## 11. Reconexão

Uma nova conexão deve passar novamente pelo middleware de autenticação.

Isso garante que mudanças ocorridas durante a desconexão sejam consideradas, como:

- logout;
- revogação da sessão;
- expiração do token;
- desativação do usuário.

A recuperação de estado que ignore o middleware de autenticação não está habilitada nesta implementação.

## 12. Persistência da presença

O estado de conexão não é persistido no PostgreSQL nem no MongoDB.

O registry permanece em memória no processo Node.js.

Essa estratégia atende ao ambiente atual de uma única instância da aplicação.

Em uma arquitetura com múltiplas instâncias, será necessário utilizar um mecanismo distribuído de presença/adaptação.

## 13. Segurança

A camada realtime segue as seguintes regras:

- somente conexões autenticadas são aceitas;
- JWT é enviado pelo handshake `auth`;
- identidade nunca é definida a partir de `userId` informado pelo cliente;
- sessões revogadas são rejeitadas;
- usuários `INACTIVE` são rejeitados;
- erros internos não são enviados ao cliente;
- códigos de erro expostos utilizam uma whitelist;
- dados sensíveis como `password_hash` não são armazenados em `socket.data`.

## 14. Testes

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
- reconexão com novo `socket.id`;
- gerenciamento da room privada;
- comportamento do `connectionRegistry`.

### Execução

```bash
npm run test:realtime
```

Os testes de integração real também fazem parte de:

```bash
npm run test:integration
```

A regressão completa é executada através de:

```bash
npm test
```

## 15. Arquivos principais

```text
backend/src/realtime/socketServer.js
backend/src/realtime/connectionRegistry.js
backend/src/realtime/rooms.js
backend/tests/realtime/socket-auth.test.js
backend/tests/realtime/socket-lifecycle.test.js
backend/tests/realtime/connection-registry.test.js
backend/database/tests/integration/socket-auth-integration.test.js
```
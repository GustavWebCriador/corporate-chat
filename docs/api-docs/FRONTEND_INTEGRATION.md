# Corporate Chat — Integração com o Frontend (API v1)

## 1. Visão geral

Este documento apresenta os contratos de comunicação necessários para integrar o frontend React ao backend do Corporate Chat.

A aplicação utiliza:

- **React:** interface do usuário.
- **Node.js e Express:** API REST e regras de negócio.
- **Socket.IO:** comunicação em tempo real.
- **PostgreSQL:** usuários, solicitações de cadastro e sessões.
- **MongoDB:** conversas, participantes e mensagens.

O frontend não acessa diretamente os bancos de dados. Todas as operações devem passar pela API REST ou pela comunicação Socket.IO.

Os contratos detalhados permanecem documentados nos arquivos específicos da API.

## 2. Endereços e configuração

### 2.1 API HTTP

Prefixo dos endpoints:

`/api/v1`

Em desenvolvimento, o backend pode ser acessado por:

`http://localhost:3000`

Essa URL é um exemplo baseado na porta padrão do backend e deverá ser ajustada conforme o ambiente.

### 2.2 Socket.IO

O Socket.IO utiliza o mesmo servidor HTTP do backend, com o path padrão:

`/socket.io/`

### 2.3 Configuração proposta para React e Vite

Na futura estrutura do frontend, poderá ser utilizada a variável:

```env
VITE_BACKEND_URL=http://localhost:3000
```

Essa variável contém somente a URL pública do backend.

**Não armazenar tokens JWT, senhas ou segredos em variáveis `VITE_`**, pois elas podem ser incorporadas ao código distribuído ao navegador.

Em desenvolvimento, a origem do frontend deverá ser compatível com a configuração de CORS do backend.

## 3. Autenticação e sessão

A autenticação utiliza JWT com sessões persistidas no PostgreSQL.

O backend valida:

- Assinatura e expiração do token.
- Existência e situação da sessão.
- Revogação da sessão.
- Existência e status atual do usuário.

### 3.1 Login

**Endpoint:**

`POST /api/v1/auth/login`

**Corpo:**

```json
{
  "email": "usuario@empresa.com",
  "password": "SenhaExemplo123"
}
```

**Resposta de sucesso — HTTP 200:**

```json
{
  "data": {
    "token": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "user_id": "11111111-1111-4111-8111-111111111111",
      "name": "Usuário Exemplo",
      "email": "usuario@empresa.com",
      "status": "ACTIVE",
      "is_admin": false
    }
  }
}
```

Os dados e o tempo de expiração são ilustrativos.

O frontend deve utilizar `data.token` para autenticar requisições protegidas.

### 3.2 Consultar usuário autenticado

**Endpoint:**

`GET /api/v1/auth/me`

**Header:**

```http
Authorization: Bearer <token>
```

**Resposta — HTTP 200:**

```json
{
  "data": {
    "user": {
      "user_id": "11111111-1111-4111-8111-111111111111",
      "name": "Usuário Exemplo",
      "email": "usuario@empresa.com",
      "status": "ACTIVE",
      "is_admin": false
    }
  }
}
```

A API utiliza o estado atual do usuário no backend, e não apenas os dados armazenados no JWT.

### 3.3 Logout

**Endpoint:**

`POST /api/v1/auth/logout`

**Resposta de sucesso:**

`204 No Content`

O backend revoga a sessão correspondente ao token enviado.

O frontend deve:

1. Enviar a requisição de logout.
2. Encerrar a conexão Socket.IO.
3. Limpar o token e os dados de sessão mantidos pelo cliente.
4. Redirecionar o usuário para a tela de login.

Em caso de falha de rede, a interface pode limpar a sessão local, mas não deve afirmar que a revogação no servidor foi concluída.

### 3.4 Armazenamento do token

Para a implementação inicial, recomenda-se gerenciar o token em memória, por meio de um contexto ou gerenciador de sessão.

O backend atual não disponibiliza um fluxo documentado de refresh token.

Por isso, a restauração de sessão após recarregar a página depende da estratégia de autenticação escolhida para o frontend. A persistência do JWT no navegador deve ser avaliada considerando os riscos de exposição em caso de XSS.

## 4. Catálogo de endpoints HTTP

Os endpoints estão agrupados por funcionalidade.

| Área | Método | Endpoint | Acesso |
|---|---|---|---|
| Saúde | GET | `/api/v1/health` | Público |
| Autenticação | POST | `/api/v1/auth/login` | Público |
| Autenticação | GET | `/api/v1/auth/me` | JWT |
| Autenticação | POST | `/api/v1/auth/logout` | JWT |
| Usuários | POST | `/api/v1/admin/users` | Admin |
| Usuários | GET | `/api/v1/admin/users` | Admin |
| Usuários | GET | `/api/v1/admin/users/:userId` | Admin |
| Usuários | PATCH | `/api/v1/admin/users/:userId/status` | Admin |
| Usuários | PATCH | `/api/v1/admin/users/:userId/password` | Admin |
| Cadastro | POST | `/api/v1/registration-requests` | Público |
| Cadastro | GET | `/api/v1/admin/registration-requests` | Admin |
| Cadastro | POST | `/api/v1/admin/registration-requests/:requestId/approve` | Admin |
| Cadastro | POST | `/api/v1/admin/registration-requests/:requestId/reject` | Admin |
| Dashboard | GET | `/api/v1/dashboard` | JWT |
| Conversas | POST | `/api/v1/conversations/private` | JWT |
| Conversas | GET | `/api/v1/conversations` | JWT |
| Histórico | GET | `/api/v1/conversations/:conversationId/messages` | JWT + membro |
| Mensagens | POST | `/api/v1/conversations/:conversationId/messages` | JWT + membro |
| Entrega | PATCH | `/api/v1/conversations/:conversationId/delivery` | JWT + membro |
| Leitura | PATCH | `/api/v1/conversations/:conversationId/read` | JWT + membro |
| Grupos | POST | `/api/v1/groups` | JWT |
| Grupos | GET | `/api/v1/groups/:groupId` | JWT + membro |
| Grupos | PATCH | `/api/v1/groups/:groupId` | JWT + criador |
| Grupos | POST | `/api/v1/groups/:groupId/members` | JWT + criador |
| Grupos | DELETE | `/api/v1/groups/:groupId/members/:userId` | JWT + criador |
| Grupos | POST | `/api/v1/groups/:groupId/leave` | JWT + membro |

**Legenda:**

- Público: não exige autenticação.
- JWT: exige usuário autenticado e ativo.
- Admin: exige privilégio administrativo.
- Membro: exige vínculo ativo com a conversa.
- Criador: exige permissão de criador do grupo.

O controle de autorização é responsabilidade do backend.

## 5. Padrão de respostas HTTP

### 5.1 Sucesso

As respostas normalmente utilizam:

```json
{
  "data": {}
}
```

O conteúdo de `data` varia conforme o endpoint.

### 5.2 Respostas sem corpo

Operações que retornam `204 No Content` não possuem JSON.

O frontend não deve executar `response.json()` nessas respostas.

### 5.3 Erros

A API utiliza o formato:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos."
  }
}
```

O campo `details` pode estar presente quando necessário.

### 5.4 Códigos HTTP relevantes

| HTTP | Significado |
|---|---|
| 200 | Operação concluída |
| 201 | Recurso criado |
| 204 | Operação concluída sem corpo |
| 400 | Dados inválidos |
| 401 | Autenticação ausente ou inválida |
| 403 | Operação não autorizada |
| 404 | Recurso não encontrado |
| 409 | Conflito de estado |
| 413 | Corpo da requisição acima do limite |
| 429 | Limite de requisições excedido |
| 500 | Erro interno |

O frontend deve utilizar os códigos e o campo `error.code` para determinar o tratamento adequado.

## 6. Cliente HTTP para React

A implementação do frontend deverá centralizar as requisições HTTP em um serviço reutilizável.

### 6.1 Exemplo de cliente HTTP

```javascript
const API_URL =
    import.meta.env.VITE_BACKEND_URL;

export async function apiRequest(
    path,
    {
        method = "GET",
        token,
        body,
    } = {}
) {
    const headers = {};

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (body !== undefined) {
        headers["Content-Type"] =
            "application/json";
    }

    const response = await fetch(
        `${API_URL}/api/v1${path}`,
        {
            method,
            headers,
            cache: "no-store",
            ...(body !== undefined
                ? {
                    body: JSON.stringify(body),
                }
                : {}),
        }
    );

    if (response.status === 204) {
        return null;
    }

    const result = await response.json();

    if (!response.ok) {
        const error = new Error(
            result.error?.message ??
                "Erro ao realizar requisição."
        );

        error.code =
            result.error?.code;

        error.status =
            response.status;

        error.details =
            result.error?.details;

        throw error;
    }

    return result.data;
}
```

O exemplo assume que `VITE_BACKEND_URL` está configurada corretamente.

### 6.2 Exemplo de utilização

```javascript
import {
    apiRequest,
} from "./api";

export async function getDashboard(
    token
) {
    return apiRequest(
        "/dashboard",
        {
            token,
        }
    );
}
```

A função retorna diretamente o conteúdo de `data`.

## 7. Integração do dashboard

Após o login, o frontend deve consultar:

`GET /api/v1/dashboard`

O retorno contém:

```json
{
  "data": {
    "contacts": [],
    "conversations": []
  }
}
```

O dashboard deverá utilizar:

| Campo | Utilização |
|---|---|
| `contacts` | Lista de contatos |
| `conversations` | Conversas do usuário |
| `conversation_id` | Identificação da conversa |
| `type` | Conversa privada ou grupo |
| `contact` | Outro participante da conversa privada |
| `name` | Nome do grupo |
| `last_message` | Prévia da última mensagem |
| `membership` | Papel do usuário na conversa |

O contrato completo está documentado em `DASHBOARD.md`.

## 8. Criação e navegação de conversas

### 8.1 Selecionar contato

Quando o usuário selecionar um contato, o frontend deverá chamar:

`POST /api/v1/conversations/private`

**Corpo:**

```json
{
  "otherUserId": "22222222-2222-4222-8222-222222222222"
}
```

O backend cria ou reutiliza a conversa privada correspondente.

### 8.2 Abrir conversa

Após obter o identificador da conversa, o frontend poderá consultar:

`GET /api/v1/conversations/:conversationId/messages`

O identificador de conversa utiliza ObjectId do MongoDB.

### 8.3 Histórico

O histórico utiliza paginação.

Parâmetros disponíveis:

- `limit`: quantidade de mensagens.
- `before`: cursor da página anterior.

O frontend deve utilizar o cursor retornado pelo backend, sem interpretá-lo ou reconstruí-lo.

## 9. Envio de mensagens por HTTP

O endpoint de envio é:

`POST /api/v1/conversations/:conversationId/messages`

**Corpo:**

```json
{
  "clientMessageId": "eab4b831-b76d-47b6-a5e1-c20b5a98d564",
  "content": "Olá! Tudo bem?"
}
```

O identificador `clientMessageId` é fornecido pelo cliente e permite controlar reenvios idempotentes.

A resposta contém:

```json
{
  "data": {
    "message": {},
    "reused": false
  }
}
```

O servidor retorna:

- `201 Created` na primeira persistência.
- `200 OK` quando a mensagem é reutilizada em um reenvio idempotente.

Em caso de tentativa de reenvio após falha de rede, o frontend deve reutilizar o mesmo `clientMessageId` para a mesma mensagem.

## 10. Integração com Socket.IO

A comunicação em tempo real é realizada pelo Socket.IO.

O cliente deve utilizar a URL do backend e fornecer o JWT no handshake:

```javascript
auth: {
    token
}
```

O backend valida a origem da conexão e autentica o token antes de permitir acesso aos eventos.

A autenticação também considera a situação atual da sessão.

## 11. Eventos Socket.IO

O backend define oito eventos.

| Evento | Direção | Responsabilidade |
|---|---|---|
| `realtime:ready` | Servidor → cliente | Confirmar conexão autenticada |
| `realtime:sync` | Cliente → servidor | Sincronizar mensagens |
| `message:send` | Cliente → servidor | Enviar mensagem |
| `message:new` | Servidor → cliente | Distribuir mensagem |
| `message:delivered` | Cliente → servidor | Confirmar entrega |
| `message:delivery:update` | Servidor → cliente | Propagar checkpoint de entrega |
| `message:read` | Cliente → servidor | Confirmar leitura |
| `message:read:update` | Servidor → cliente | Propagar checkpoint de leitura |

Os eventos que solicitam operações utilizam ACK para retornar o resultado ao cliente.

O contrato detalhado encontra-se em `REALTIME.md`.

## 12. Exemplo de conexão Socket.IO

A futura implementação React poderá utilizar `socket.io-client`.

Exemplo de serviço:

```javascript
import {
    io,
} from "socket.io-client";

const SOCKET_URL =
    import.meta.env.VITE_BACKEND_URL;

export function createChatSocket(token) {
    const socket = io(
        SOCKET_URL,
        {
            autoConnect: false,

            auth: {
                token,
            },

            reconnection: true,
        }
    );

    socket.on(
        "realtime:ready",
        ({ recovered, connectedAt }) => {
            console.log(
                "Conexão pronta.",
                {
                    recovered,
                    connectedAt,
                }
            );
        }
    );

    socket.on(
        "message:new",
        ({ message }) => {
            // Atualizar estado das mensagens.
            // Evitar duplicatas por message._id.
        }
    );

    socket.on(
        "message:delivery:update",
        payload => {
            // Atualizar checkpoint de entrega.
        }
    );

    socket.on(
        "message:read:update",
        payload => {
            // Atualizar checkpoint de leitura.
        }
    );

    socket.on(
        "connect_error",
        error => {
            // Diferenciar falha de autenticação
            // de falha de transporte/origem.
            console.error(
                error.data?.code ??
                    "CONNECTION_ERROR"
            );
        }
    );

    return socket;
}
```

A aplicação deverá registrar os listeners antes de chamar:

```javascript
socket.connect();
```

No encerramento da sessão:

```javascript
socket.removeAllListeners();
socket.disconnect();
```

O token não deve ser registrado em logs.

A instância do socket deve ser controlada pelo ciclo de vida da sessão, evitando a criação de múltiplas conexões desnecessárias.

## 13. Envio de mensagens em tempo real

O cliente poderá enviar mensagens utilizando:

`message:send`

**Payload:**

```json
{
  "conversationId": "507f1f77bcf86cd799439011",
  "clientMessageId": "eab4b831-b76d-47b6-a5e1-c20b5a98d564",
  "content": "Mensagem de teste."
}
```

**ACK de sucesso:**

```json
{
  "ok": true,
  "data": {
    "message": {},
    "reused": false
  }
}
```

**ACK de erro:**

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos."
  }
}
```

O campo `senderId` não deve ser enviado pelo frontend.

O backend identifica o remetente a partir da conexão autenticada.

### 13.1 Exemplo de envio

```javascript
export async function sendMessage(
    socket,
    payload
) {
    const ack = await socket
        .timeout(10000)
        .emitWithAck(
            "message:send",
            payload
        );

    if (!ack.ok) {
        const error = new Error(
            ack.error?.message ??
                "Falha ao enviar mensagem."
        );

        error.code = ack.error?.code;

        throw error;
    }

    return ack.data;
}
```

Se ocorrer timeout, a mensagem pode ter sido persistida mesmo sem o ACK ter chegado ao cliente.

Antes de gerar uma nova mensagem, o frontend deve tentar reconciliar o estado e preservar o mesmo `clientMessageId` em reenvios.

## 14. Recebimento de mensagens

Quando uma mensagem é persistida, o servidor pode emitir:

`message:new`

**Payload:**

```json
{
  "message": {
    "_id": "507f1f77bcf86cd799439012",
    "conversation_id": "507f1f77bcf86cd799439011",
    "sender_id": "22222222-2222-4222-8222-222222222222",
    "client_message_id": "eab4b831-b76d-47b6-a5e1-c20b5a98d564",
    "content": "Olá!",
    "created_at": "2026-10-30T10:00:00.000Z"
  }
}
```

O servidor distribui mensagens aos usuários que possuem participação ativa.

O próprio remetente também pode receber `message:new` em outras abas ou dispositivos.

Por isso, o frontend deve evitar mensagens duplicadas usando o identificador persistido `_id` e conciliar mensagens locais pendentes pelo `client_message_id`.

## 15. Confirmação de entrega e leitura

Os eventos de confirmação são:

- `message:delivered`
- `message:read`

**Payload:**

```json
{
  "conversationId": "507f1f77bcf86cd799439011",
  "messageId": "507f1f77bcf86cd799439012"
}
```

O servidor utiliza checkpoints associados ao participante, evitando atualizar individualmente cada mensagem para representar o estado de entrega ou leitura.

As atualizações são propagadas por:

- `message:delivery:update`
- `message:read:update`

O frontend deve usar os dados dos checkpoints recebidos para atualizar a interface.

Os formatos completos estão disponíveis em `REALTIME.md`.

## 16. Reconexão e sincronização

O Socket.IO oferece mecanismos de reconexão, mas a interface não deve presumir que mensagens perdidas durante uma desconexão foram recuperadas automaticamente.

O evento:

`realtime:sync`

permite solicitar mensagens após um identificador conhecido.

**Payload:**

```json
{
  "conversationId": "507f1f77bcf86cd799439011",
  "afterMessageId": "507f1f77bcf86cd799439012",
  "limit": 50
}
```

**ACK de sucesso:**

```json
{
  "ok": true,
  "data": {
    "mode": "incremental",
    "items": [],
    "hasMore": false,
    "nextAfterMessageId": "507f1f77bcf86cd799439012"
  }
}
```

O exemplo é ilustrativo.

### 16.1 Sincronização incremental

Quando `afterMessageId` é fornecido, o servidor recupera mensagens posteriores ao identificador informado.

A interface deve utilizar `nextAfterMessageId` para continuar a sincronização quando `hasMore` for `true`.

### 16.2 Sincronização por snapshot

Quando `afterMessageId` não é fornecido, o backend retorna um conjunto recente de mensagens em modo `snapshot`.

Essa modalidade é útil quando o frontend perdeu seu estado local e precisa reconstruir as mensagens recentes.

### 16.3 Fluxo recomendado

1. Detectar o estabelecimento ou restabelecimento da conexão.
2. Confirmar a autenticação por meio de `realtime:ready`.
3. Identificar a última mensagem persistida conhecida localmente.
4. Executar `realtime:sync`.
5. Incorporar as mensagens recebidas sem duplicação.
6. Continuar a sincronização enquanto houver páginas adicionais.
7. Atualizar a interface com o estado reconciliado.

O campo `recovered` recebido no evento `realtime:ready` informa uma condição de recuperação do Socket.IO, mas não substitui a sincronização explícita da aplicação.

## 17. Identificadores utilizados

O Corporate Chat utiliza identificadores diferentes conforme a entidade.

| Entidade | Formato |
|---|---|
| Usuário | UUID |
| Solicitação de cadastro | UUID |
| Sessão de autenticação | UUID |
| Conversa | ObjectId |
| Mensagem | ObjectId |

O frontend não deve assumir que todos os identificadores possuem o mesmo formato.

O identificador `clientMessageId`, fornecido no envio, é utilizado para idempotência e não substitui o `_id` persistido da mensagem.

## 18. Tratamento de erros no frontend

O frontend deve identificar os erros utilizando os códigos retornados pelo backend.

Recomendações:

| Situação | Comportamento sugerido |
|---|---|
| `TOKEN_MISSING` | Solicitar autenticação |
| `TOKEN_INVALID` | Encerrar sessão local |
| `TOKEN_EXPIRED` | Solicitar novo login |
| `TOKEN_REVOKED` | Encerrar sessão local |
| `USER_INACTIVE` | Bloquear acesso e informar situação da conta |
| `ADMIN_REQUIRED` | Informar ausência de permissão |
| `VALIDATION_ERROR` | Apresentar erro de formulário |
| `RATE_LIMITED` | Informar limite temporário de tentativas |
| `INTERNAL_ERROR` | Apresentar mensagem genérica |
| Falha de rede | Permitir nova tentativa controlada |

Falhas do handshake por origem não autorizada podem não apresentar os mesmos códigos de autenticação.

## 19. Segurança na integração

O frontend deverá seguir os seguintes cuidados:

- Não incorporar credenciais reais ao código-fonte.
- Não registrar JWTs e senhas no console.
- Não enviar `senderId` ou identidade arbitrária nas operações autenticadas.
- Não confiar em permissões fornecidas apenas pela interface.
- Respeitar o encerramento e a revogação da sessão.
- Tratar respostas HTTP `204` sem tentar ler JSON.
- Utilizar as políticas de cache apropriadas.
- Validar e apresentar erros sem expor detalhes internos.
- Utilizar HTTPS e WSS nos ambientes publicados.
- Encerrar conexões Socket.IO quando a sessão terminar.
- Evitar duplicação de mensagens durante reenvios e reconexões.

A segurança efetiva continua sendo responsabilidade do backend.

## 20. Fluxo inicial previsto para o frontend

A primeira integração funcional deverá permitir:

1. Usuário abre a aplicação React.
2. Realiza login.
3. O frontend recebe o JWT e os dados públicos do usuário.
4. Consulta o dashboard.
5. Apresenta a lista de contatos e conversas.
6. Usuário seleciona um contato.
7. O frontend cria ou reutiliza a conversa privada.
8. Carrega o histórico de mensagens.
9. Estabelece conexão Socket.IO autenticada.
10. Envia e recebe mensagens.
11. Atualiza indicadores de entrega e leitura.
12. Sincroniza dados após reconexão.
13. Realiza logout e encerra a conexão.

Esse fluxo será utilizado como referência para as primeiras entregas do frontend.

## 21. Funcionalidades não previstas no contrato atual

A implementação analisada não documenta suporte para:

- Envio de anexos.
- Edição de mensagens.
- Exclusão de mensagens.
- Indicador de digitação.
- Chamadas de áudio ou vídeo.
- Notificações push.
- Refresh token.
- Paginação avançada de contatos.

Essas funcionalidades não devem ser presumidas na interface sem uma alteração formal do escopo ou dos contratos.

## 22. Testes e validação

A integração deverá preservar os contratos validados pelo backend.

### Testes da API

```powershell
cd backend
npm run test:api
```

### Testes realtime

```powershell
npm run test:realtime
```

### Regressão completa

```powershell
npm test
```

O resultado da regressão completa já registrada no projeto foi de 330 testes aprovados e nenhuma falha.

Novas alterações de frontend deverão ser submetidas a testes de integração próprios, verificando os fluxos reais no navegador.

## 23. Documentação relacionada

- [Autenticação](AUTHENTICATION.md)
- [Administração de usuários](ADMIN_USERS.md)
- [Solicitações de cadastro](REGISTRATION.md)
- [Dashboard](DASHBOARD.md)
- [Conversas privadas e histórico](CONVERSATION.md)
- [Grupos](GROUPS.md)
- [Mensagens](MESSAGES.md)
- [Comunicação em tempo real](REALTIME.md)
- [Segurança da API](SECURITY.md)
- [Testes automatizados](TESTING.md)

## 24. Considerações finais

Este documento centraliza os contratos necessários para integrar a interface React ao backend do Corporate Chat.

A API REST será responsável pelas operações de consulta e gerenciamento, enquanto o Socket.IO permitirá a atualização das mensagens e dos indicadores de entrega e leitura em tempo real.

A integração deverá preservar os mecanismos de autenticação, autorização, validação e segurança implementados no backend.

Os exemplos apresentados constituem orientações para o desenvolvimento do frontend e devem ser conferidos com a versão atual da API durante a implementação.
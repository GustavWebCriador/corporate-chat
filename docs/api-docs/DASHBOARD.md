# Corporate Chat — Dashboard (API v1)

## 1. Visão geral

O dashboard representa a área inicial do Corporate Chat após a autenticação do usuário.

A API disponibiliza as informações necessárias para apresentar os contatos disponíveis e as conversas das quais o usuário participa, permitindo a navegação entre conversas privadas e grupos.

Os dados são obtidos a partir de duas fontes:

- **PostgreSQL:** informações públicas dos usuários, identificação dos contatos e situação das contas.
- **MongoDB:** conversas, participantes, vínculos de participação e últimas mensagens.

A integração é realizada pelo backend, sem necessidade de acesso direto aos bancos de dados pelo frontend.

## 2. Objetivo

O endpoint de dashboard tem como responsabilidades:

- Disponibilizar os contatos ativos.
- Excluir o próprio usuário da lista de contatos.
- Listar as conversas em que o usuário possui participação ativa.
- Diferenciar conversas privadas de grupos.
- Identificar o outro participante de uma conversa privada.
- Apresentar o nome de grupos.
- Disponibilizar a última mensagem de cada conversa, quando existente.
- Retornar apenas os campos necessários para a interface.

A operação é exclusivamente de consulta e não altera os dados persistidos.

## 3. Endpoint disponível

| Método | Endpoint | Descrição | Sucesso |
|---|---|---|---|
| GET | `/api/v1/dashboard` | Consultar contatos e conversas do usuário autenticado | 200 OK |

**Exemplo de requisição:**

```http
GET /api/v1/dashboard HTTP/1.1
Authorization: Bearer <token>
```

A resposta utiliza o formato JSON e recebe a política:

```http
Cache-Control: no-store
```

## 4. Autenticação e autorização

O endpoint exige autenticação JWT válida.

Para acessar o dashboard, o usuário precisa:

- Estar autenticado.
- Possuir uma conta existente.
- Estar com status `ACTIVE`.
- Apresentar um token válido e não revogado.

Não é necessário possuir privilégio administrativo.

A identidade utilizada na consulta é extraída exclusivamente do usuário autenticado:

```javascript
userId: req.user.user_id
```

O backend não utiliza um identificador de usuário enviado pelo frontend para substituir a identidade autenticada.

**Exemplo:** incluir `?userId=outro-usuario` não permite consultar o dashboard de outra pessoa.

## 5. Parâmetros da requisição

O endpoint aceita um parâmetro opcional de consulta.

| Parâmetro | Tipo | Obrigatório | Valor padrão | Limite |
|---|---|---|---|---|
| `limit` | Número inteiro positivo, enviado como string decimal | Não | 50 | 1 a 100 |

O parâmetro controla a quantidade máxima de conversas retornadas.

**Exemplo:**

```http
GET /api/v1/dashboard?limit=25
Authorization: Bearer <token>
```

### 5.1 Regras de validação

São aceitos valores inteiros positivos entre 1 e 100.

Exemplos válidos:

```text
?limit=1
?limit=25
?limit=50
?limit=100
```

Exemplos inválidos:

```text
?limit=0
?limit=101
?limit=-1
?limit=1.5
?limit=abc
?limit=
```

Quando o parâmetro é inválido, a API retorna:

**HTTP 400 — VALIDATION_ERROR**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Parâmetros do dashboard inválidos.",
    "details": [
      {
        "field": "limit",
        "message": "Informe um número inteiro entre 1 e 100."
      }
    ]
  }
}
```

### 5.2 Observações

- O `limit` restringe a lista de conversas, não a lista de contatos.
- O endpoint não implementa paginação por cursor ou offset.
- Para carregar o histórico de uma conversa, deve ser utilizada a API específica de mensagens.
- O frontend não deve utilizar parâmetros adicionais para tentar alterar a identidade consultada.

## 6. Estrutura da resposta

A API utiliza o contrato:

```json
{
  "data": {
    "contacts": [],
    "conversations": []
  }
}
```

**HTTP 200 OK**

O objeto `data` possui dois campos principais.

| Campo | Tipo | Descrição |
|---|---|---|
| `contacts` | Array | Usuários ativos disponíveis como contatos |
| `conversations` | Array | Conversas das quais o usuário participa ativamente |

Esses arrays podem estar vazios, dependendo dos dados existentes.

## 7. Contatos disponíveis

O campo `contacts` representa os usuários disponíveis para interação.

A consulta aplica as seguintes regras:

- Retorna somente usuários com status `ACTIVE`.
- Exclui o usuário autenticado.
- Ordena os contatos pelo nome e, como critério secundário, pelo identificador.
- Retorna apenas os dados públicos necessários.

### 7.1 Estrutura de um contato

```json
{
  "user_id": "22222222-2222-4222-8222-222222222222",
  "name": "Maria Oliveira",
  "email": "maria@empresa.com",
  "status": "ACTIVE"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `user_id` | UUID (string) | Identificador do usuário no PostgreSQL |
| `name` | String | Nome do contato |
| `email` | String | E-mail cadastrado |
| `status` | String | Situação atual da conta |

Os campos `password_hash`, `is_admin` e timestamps administrativos não fazem parte dessa representação.

### 7.2 Lista vazia

Caso não existam outros usuários ativos disponíveis:

```json
{
  "data": {
    "contacts": [],
    "conversations": []
  }
}
```

Esse exemplo também pressupõe que o usuário não possui conversas. Uma lista de contatos vazia não implica necessariamente uma lista de conversas vazia.

## 8. Conversas do usuário

O campo `conversations` contém as conversas nas quais o usuário autenticado possui vínculo com status `ACTIVE`.

O backend diferencia dois tipos de conversa:

| Tipo | Descrição |
|---|---|
| `PRIVATE` | Conversa privada entre dois usuários |
| `GROUP` | Conversa em grupo com múltiplos participantes |

As conversas são consultadas no MongoDB e complementadas com informações públicas dos participantes no PostgreSQL.

A consulta utiliza os metadados da última mensagem e da criação para ordenar as conversas, priorizando as atividades mais recentes.

### 8.1 Estrutura pública de uma conversa

| Campo | Tipo | Descrição |
|---|---|---|
| `conversation_id` | ObjectId (string) | Identificador da conversa no MongoDB |
| `type` | String | `PRIVATE` ou `GROUP` |
| `name` | String ou null | Nome do grupo; null nas conversas privadas |
| `contact` | Objeto ou null | Outro participante de conversa privada |
| `membership` | Objeto | Dados do vínculo do usuário autenticado |
| `last_message` | Objeto ou null | Última mensagem disponível |
| `last_message_at` | Data ISO 8601 ou null | Data da última mensagem |
| `created_at` | Data ISO 8601 | Data de criação da conversa |

A propriedade `membership` contém `role`, cujo valor depende do vínculo do usuário com a conversa.

## 9. Conversas privadas

As conversas privadas possuem `type: "PRIVATE"`.

Nesse tipo de conversa:

- `name` é `null`.
- `contact` identifica o outro participante.
- `conversation_id` é o identificador utilizado nas operações relacionadas à conversa.

### 9.1 Exemplo de conversa privada

```json
{
  "conversation_id": "507f1f77bcf86cd799439011",
  "type": "PRIVATE",
  "name": null,
  "contact": {
    "user_id": "22222222-2222-4222-8222-222222222222",
    "name": "Maria Oliveira",
    "email": "maria@empresa.com",
    "status": "ACTIVE"
  },
  "membership": {
    "role": "CREATOR"
  },
  "last_message": {
    "message_id": "507f1f77bcf86cd799439012",
    "sender_id": "22222222-2222-4222-8222-222222222222",
    "content": "Olá! Tudo bem?",
    "created_at": "2026-10-30T14:30:00.000Z"
  },
  "last_message_at": "2026-10-30T14:30:00.000Z",
  "created_at": "2026-10-29T09:00:00.000Z"
}
```

Os identificadores e dados apresentados são ilustrativos.

### 9.2 Identificação do contato

Para identificar o outro participante, o backend:

1. Obtém os UUIDs dos participantes com vínculo ativo na conversa.
2. Identifica o UUID diferente daquele pertencente ao usuário autenticado.
3. Consulta os dados públicos desse usuário no PostgreSQL.
4. Inclui o resultado em `contact`.

Caso não consiga resolver uma associação obrigatória, o serviço retorna um erro de consistência.

**Observação:** um contato de conversa já existente pode estar `INACTIVE` no PostgreSQL. Isso é diferente da lista `contacts`, que contém somente usuários ativos.

## 10. Conversas em grupo

As conversas de grupo possuem `type: "GROUP"`.

Nesse tipo de conversa:

- `name` contém o nome do grupo.
- `contact` é `null`.
- `membership.role` informa o papel do usuário autenticado no grupo.

### 10.1 Exemplo de grupo

```json
{
  "conversation_id": "507f1f77bcf86cd799439013",
  "type": "GROUP",
  "name": "Equipe de Projetos",
  "contact": null,
  "membership": {
    "role": "MEMBER"
  },
  "last_message": {
    "message_id": "507f1f77bcf86cd799439014",
    "sender_id": "33333333-3333-4333-8333-333333333333",
    "content": "A reunião será às 14h.",
    "created_at": "2026-10-30T11:00:00.000Z"
  },
  "last_message_at": "2026-10-30T11:00:00.000Z",
  "created_at": "2026-10-28T08:00:00.000Z"
}
```

A interface deve utilizar o nome do grupo para identificação visual, enquanto o campo `conversation_id` deve ser utilizado nas operações com a API.

## 11. Última mensagem

O campo `last_message` representa a última mensagem associada à conversa.

### 11.1 Estrutura

```json
{
  "message_id": "507f1f77bcf86cd799439012",
  "sender_id": "22222222-2222-4222-8222-222222222222",
  "content": "Olá! Tudo bem?",
  "created_at": "2026-10-30T14:30:00.000Z"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `message_id` | ObjectId (string) | Identificador da mensagem |
| `sender_id` | UUID (string) | Identificador do remetente |
| `content` | String | Conteúdo da mensagem |
| `created_at` | Data ISO 8601 | Data de criação |

O dashboard não expõe os campos internos `client_message_id` e `conversation_id` dentro do objeto `last_message`.

### 11.2 Conversa sem mensagens

Quando uma conversa não possui mensagens, os campos podem ser retornados como:

```json
{
  "last_message": null,
  "last_message_at": null
}
```

O frontend deve tratar essa condição sem apresentar erros de renderização.

## 12. Exemplo completo da resposta

**Requisição:**

```http
GET /api/v1/dashboard?limit=50
Authorization: Bearer <token>
```

**Resposta — HTTP 200 OK:**

```json
{
  "data": {
    "contacts": [
      {
        "user_id": "22222222-2222-4222-8222-222222222222",
        "name": "Maria Oliveira",
        "email": "maria@empresa.com",
        "status": "ACTIVE"
      }
    ],
    "conversations": [
      {
        "conversation_id": "507f1f77bcf86cd799439011",
        "type": "PRIVATE",
        "name": null,
        "contact": {
          "user_id": "22222222-2222-4222-8222-222222222222",
          "name": "Maria Oliveira",
          "email": "maria@empresa.com",
          "status": "ACTIVE"
        },
        "membership": {
          "role": "CREATOR"
        },
        "last_message": {
          "message_id": "507f1f77bcf86cd799439012",
          "sender_id": "22222222-2222-4222-8222-222222222222",
          "content": "Olá! Tudo bem?",
          "created_at": "2026-10-30T14:30:00.000Z"
        },
        "last_message_at": "2026-10-30T14:30:00.000Z",
        "created_at": "2026-10-29T09:00:00.000Z"
      },
      {
        "conversation_id": "507f1f77bcf86cd799439013",
        "type": "GROUP",
        "name": "Equipe de Projetos",
        "contact": null,
        "membership": {
          "role": "MEMBER"
        },
        "last_message": null,
        "last_message_at": null,
        "created_at": "2026-10-28T08:00:00.000Z"
      }
    ]
  }
}
```

Os dados utilizados são exemplos ilustrativos do contrato da API.

## 13. Códigos HTTP e tratamento de erros

| HTTP | Código | Descrição |
|---|---|---|
| 200 | — | Dashboard consultado com sucesso |
| 400 | `VALIDATION_ERROR` | Parâmetro `limit` inválido |
| 401 | `TOKEN_MISSING` | Token ausente |
| 401 | `TOKEN_INVALID` | Token inválido |
| 401 | `TOKEN_EXPIRED` | Token expirado |
| 401 | `TOKEN_REVOKED` | Sessão revogada |
| 403 | `USER_INACTIVE` | Usuário autenticado está inativo |
| 500 | `DASHBOARD_DATA_INCONSISTENT` | Inconsistência necessária à montagem do dashboard |
| 500 | `INTERNAL_ERROR` | Erro inesperado no processamento |

### 13.1 Estrutura padrão de erro

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Parâmetros do dashboard inválidos.",
    "details": [
      {
        "field": "limit",
        "message": "Informe um número inteiro entre 1 e 100."
      }
    ]
  }
}
```

A propriedade `details` é opcional.

### 13.2 Erro interno inesperado

Erros técnicos não tratados são normalizados:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Erro interno do servidor."
  }
}
```

Informações internas de exceções inesperadas não devem ser expostas ao cliente.

## 14. Segurança e privacidade

A implementação utiliza os seguintes mecanismos:

**Autenticação:** o acesso exige token válido, associado a usuário ativo.

**Identidade confiável:** os dados consultados pertencem ao usuário identificado pelo backend, não a parâmetros fornecidos pelo cliente.

**Controle de participação:** somente conversas com vínculo ativo do usuário são retornadas.

**Projeção pública:** os campos apresentados são selecionados pelo serviço do dashboard.

O DTO não expõe:

- `password_hash`
- `is_admin`
- `private_key`
- `participant_user_ids`
- `client_message_id`
- `last_message_id` como campo interno da conversa

**Privacidade de cache:** as respostas recebem:

```http
Cache-Control: no-store
```

Essa política não substitui autenticação, autorização ou HTTPS.

## 15. Integração com o frontend React

O frontend deve utilizar o dashboard como fonte inicial de dados após a autenticação.

### 15.1 Fluxo esperado

1. O usuário realiza login.
2. A aplicação recebe as credenciais de sessão previstas pela API.
3. O frontend consulta `GET /api/v1/dashboard`.
4. O backend valida o token e a situação do usuário.
5. A interface recebe contatos e conversas.
6. O frontend renderiza a lista de contatos e conversas.
7. O usuário seleciona uma conversa para acessar seu histórico.

### 15.2 Exemplo de consumo

```javascript
async function getDashboard(token, limit = 50) {
    const response = await fetch(
        `/api/v1/dashboard?limit=${limit}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
        }
    );

    const body = await response.json();

    if (!response.ok) {
        const error = new Error(
            body.error?.message ??
                "Não foi possível carregar o dashboard."
        );

        error.code = body.error?.code;
        error.status = response.status;

        throw error;
    }

    return body.data;
}
```

O exemplo pressupõe que o frontend tenha configurado o endereço da API, seja por proxy de desenvolvimento ou por um cliente HTTP centralizado.

### 15.3 Utilização dos dados

| Dados | Utilização sugerida |
|---|---|
| `contacts` | Lista de contatos disponíveis |
| `conversations` | Lista lateral das conversas |
| `type` | Diferenciar conversa privada e grupo |
| `contact.name` | Identificar uma conversa privada |
| `name` | Identificar um grupo |
| `last_message.content` | Prévia da última mensagem |
| `last_message_at` | Exibir horário da última interação |
| `membership.role` | Identificar o papel do usuário |
| `conversation_id` | Navegação e consulta do histórico |

O frontend deve tratar valores `null` e arrays vazios.

## 16. Relação com as demais APIs

O dashboard fornece um resumo inicial, mas não substitui as APIs responsáveis pelas operações completas do chat.

| Operação | Endpoint |
|---|---|
| Consultar dashboard | `GET /api/v1/dashboard` |
| Criar ou reutilizar conversa privada | `POST /api/v1/conversations/private` |
| Listar conversas | `GET /api/v1/conversations` |
| Consultar histórico | `GET /api/v1/conversations/:conversationId/messages` |
| Criar grupo | `POST /api/v1/groups` |

Para operações adicionais de mensagens, grupos, entrega e leitura, consultar os respectivos documentos da API.

### Comunicação em tempo real

A resposta HTTP representa um retrato dos dados no momento da consulta.

O frontend deverá utilizar a integração Socket.IO para acompanhar novas mensagens e atualizações de entrega e leitura, além dos mecanismos de sincronização após reconexão.

O endpoint de dashboard não estabelece, por si só, uma conexão em tempo real.

## 17. Limitações da implementação atual

O endpoint disponibiliza os dados necessários à montagem inicial da interface, mas não possui todas as funcionalidades de uma API de consulta avançada.

Na implementação analisada:

- Não há paginação por cursor do dashboard.
- Não há pesquisa de contatos por parâmetro.
- Não há filtros por tipo de conversa no endpoint.
- O `limit` controla somente o total máximo de conversas.
- Não há um campo `unread_count` no DTO público do dashboard.

Essas características deverão ser consideradas durante o desenvolvimento do frontend, sem presumir funcionalidades que a API ainda não oferece.

## 18. Testes automatizados

O contrato do dashboard possui testes automatizados cobrindo:

- Acesso sem autenticação.
- Acesso de usuário autenticado.
- Lista de contatos ativos.
- Exclusão do próprio usuário dos contatos.
- Proteção de campos internos.
- Identificação do outro participante em conversas privadas.
- Identificação de conversas em grupo.
- Representação pública da última mensagem.
- Limite padrão de 50 conversas.
- Validação do parâmetro `limit`.
- Proteção contra alteração da identidade por parâmetros HTTP.

### Executar testes específicos

Na pasta `backend`:

```powershell
node --test .\tests\api\dashboard.test.js
```

### Executar a suíte completa da API

```powershell
npm run test:api
```

Esses testes permitem verificar se futuras alterações preservam o contrato esperado pelo frontend.

## 19. Referências técnicas

Arquivos relacionados à implementação:

- `backend/src/routes/v1/dashboardRoutes.js`
- `backend/src/controllers/dashboardController.js`
- `backend/src/services/dashboard/dashboardService.js`
- `backend/src/services/queries/conversationQueryService.js`
- `backend/src/repositories/postgres/userRepository.js`
- `backend/tests/api/dashboard.test.js`

Documentação complementar:

- `AUTHENTICATION.md`
- `CONVERSATION.md`
- `GROUPS.md`
- `MESSAGES.md`
- `REALTIME.md`
- `SECURITY.md`

## 20. Considerações finais

O endpoint de dashboard disponibiliza uma representação pública e organizada das informações necessárias à interface inicial do Corporate Chat.

A integração entre PostgreSQL e MongoDB é realizada pelo backend, respeitando a identidade autenticada, as regras de participação em conversas e a proteção dos dados dos usuários.

A documentação estabelece o contrato necessário para desenvolver a interface React, incluindo listagem de contatos, navegação entre conversas privadas e grupos e apresentação das últimas mensagens.

O funcionamento em tempo real será complementado pelos eventos Socket.IO, documentados separadamente.
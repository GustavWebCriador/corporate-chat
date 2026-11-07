# Corporate Chat — Conversas Privadas e Histórico (API v1)

## 1. Visão geral

A API de conversas do Corporate Chat permite criar ou reutilizar conversas privadas, listar conversas associadas ao usuário autenticado e consultar o histórico de mensagens com paginação.

As informações são armazenadas no MongoDB, enquanto a validação de identidade e a situação dos usuários são verificadas utilizando o PostgreSQL.

## 2. Autenticação e identificadores

Todos os endpoints exigem autenticação JWT de usuário ativo.

**Header obrigatório:**

`Authorization: Bearer <token>`

**Base URL:**

`/api/v1/conversations`

Os identificadores utilizados possuem formatos diferentes:

| Identificador | Formato | Origem |
|---|---|---|
| `otherUserId` | UUID | PostgreSQL |
| `conversationId` | ObjectId | MongoDB |
| ID da mensagem | ObjectId | MongoDB |

O backend utiliza o usuário identificado pelo JWT. O cliente não pode substituir a identidade autenticada enviando outro `userId`.

As respostas dessas rotas utilizam `Cache-Control: no-store`.

## 3. Endpoints disponíveis

| Método | Endpoint | Descrição | Sucesso |
|---|---|---|---|
| POST | `/api/v1/conversations/private` | Criar ou reutilizar conversa privada | 201 |
| GET | `/api/v1/conversations` | Listar conversas do usuário | 200 |
| GET | `/api/v1/conversations/:conversationId/messages` | Consultar histórico paginado | 200 |

O envio de mensagens utiliza o mesmo prefixo de URL, mas é documentado separadamente em `MESSAGES.md`.

## 4. Criar ou reutilizar conversa privada

### Endpoint

`POST /api/v1/conversations/private`

### Descrição

Cria uma conversa privada entre o usuário autenticado e outro usuário.

A implementação verifica se os usuários são diferentes e se possuem contas ativas.

Caso já exista uma conversa privada entre ambos, ela é reutilizada. O índice único de `private_key` impede a duplicação do par de usuários.

### Corpo da requisição

```json
{
  "otherUserId": "22222222-2222-4222-8222-222222222222"
}
```

O campo `otherUserId` identifica o destinatário, não o usuário que realiza a requisição.

### Resposta de sucesso

**HTTP 201 Created**

```json
{
  "data": {
    "conversation": {
      "_id": "507f1f77bcf86cd799439011",
      "type": "PRIVATE",
      "private_key": "11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222",
      "created_by": "11111111-1111-4111-8111-111111111111",
      "last_message_at": null,
      "last_message_id": null,
      "created_at": "2026-10-30T10:00:00.000Z",
      "updated_at": "2026-10-30T10:00:00.000Z"
    }
  }
}
```

Os valores são ilustrativos.

O controller retorna o documento de conversa fornecido pelo serviço. Portanto, campos internos de persistência podem estar presentes.

O frontend deve utilizar `_id` para identificar a conversa e não depender de `private_key` para navegação.

### Possíveis erros

| HTTP | Código | Situação |
|---|---|---|
| 400 | `OTHER_USER_ID_REQUIRED` | Identificador do destinatário ausente |
| 400 | `PRIVATE_CONVERSATION_SAME_USER` | Tentativa de criar conversa consigo mesmo |
| 401 | `TOKEN_MISSING` | Autenticação ausente |
| 401 | `TOKEN_INVALID` | Token inválido |
| 500 | `INTERNAL_ERROR` | Erro inesperado ou não mapeado |

Outras falhas de validação de usuários devem ser verificadas conforme a implementação do controller.

## 5. Listar conversas

### Endpoint

`GET /api/v1/conversations`

### Descrição

Retorna as conversas às quais o usuário autenticado possui vínculo ativo.

O serviço consulta inicialmente os vínculos do usuário em `conversation_members` e recupera os respectivos documentos na collection `conversations`.

Vínculos com status `LEFT` ou `REMOVED` não são incluídos.

### Resposta de sucesso

**HTTP 200 OK**

```json
{
  "data": {
    "conversations": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "type": "PRIVATE",
        "created_by": "11111111-1111-4111-8111-111111111111",
        "last_message_at": null,
        "last_message_id": null,
        "membership": {
          "role": "CREATOR",
          "status": "ACTIVE",
          "joined_at": "2026-10-30T10:00:00.000Z"
        }
      }
    ]
  }
}
```

O exemplo apresenta os campos principais. Outros campos do documento MongoDB podem estar presentes.

### Regras

- Retorna somente conversas com vínculo ativo.
- Inclui os dados de participação em `membership`.
- Retorna array vazio quando o usuário não possui conversas.
- Não possui paginação por parâmetros HTTP na implementação analisada.

**Observação de segurança:** a listagem utiliza documentos MongoDB sem projeção pública explícita. Para exibição na interface, o frontend deve preferir o contrato público de `GET /api/v1/dashboard`.

## 6. Consultar histórico de mensagens

### Endpoint

`GET /api/v1/conversations/:conversationId/messages`

### Descrição

Permite consultar mensagens anteriores de uma conversa, utilizando paginação por cursor.

O backend verifica:

- Se `conversationId` é um ObjectId válido.
- Se o usuário autenticado está ativo.
- Se possui vínculo `ACTIVE` com a conversa.

### Parâmetros

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `conversationId` | Sim | ObjectId da conversa |
| `limit` | Não | Quantidade de mensagens. Padrão 50, máximo 100 |
| `before` | Não | Cursor da página anterior |

O parâmetro `before` é um cursor opaco codificado em Base64URL.

Não deve ser preenchido manualmente com datas ou identificadores de mensagens.

### Exemplo de requisição

`GET /api/v1/conversations/507f1f77bcf86cd799439011/messages?limit=50`

### Resposta de sucesso

**HTTP 200 OK**

```json
{
  "data": {
    "items": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "conversation_id": "507f1f77bcf86cd799439011",
        "sender_id": "22222222-2222-4222-8222-222222222222",
        "client_message_id": "mensagem-cliente-001",
        "content": "Olá! Tudo bem?",
        "created_at": "2026-10-30T10:30:00.000Z"
      }
    ],
    "hasMore": false,
    "nextCursor": null
  }
}
```

Os documentos podem incluir outros campos de persistência.

### Estrutura da resposta

| Campo | Tipo | Descrição |
|---|---|---|
| `items` | Array | Mensagens da página |
| `hasMore` | Boolean | Indica a existência de mensagens anteriores |
| `nextCursor` | String ou null | Cursor para carregar a próxima página |

O histórico retorna as mensagens em ordem cronológica, da mais antiga para a mais recente dentro de cada página.

### Paginação

O backend consulta as mensagens mais recentes primeiro e utiliza o cursor para recuperar mensagens anteriores.

Fluxo esperado:

1. Consultar o histórico sem `before`.
2. Renderizar as mensagens recebidas.
3. Verificar `hasMore`.
4. Caso seja `true`, utilizar `nextCursor` como `before`.
5. Repetir até `hasMore` ser `false`.

Exemplo:

`GET /api/v1/conversations/507f1f77bcf86cd799439011/messages?limit=50&before=<cursor>`

O frontend deve preservar o cursor retornado pelo backend, sem reinterpretar seu conteúdo.

**Importante:** o campo `reused` é utilizado no contexto do envio idempotente de mensagens, não faz parte do contrato normal do histórico.

## 7. Erros de consulta ao histórico

| HTTP | Código | Situação |
|---|---|---|
| 400 | `INVALID_CONVERSATION_ID` | Identificador de conversa inválido |
| 400 | `INVALID_QUERY_CURSOR` | Cursor inválido |
| 401 | `TOKEN_MISSING` | Token ausente |
| 401 | `TOKEN_INVALID` | Token inválido |
| 403 | `USER_INACTIVE` | Usuário inativo |
| 403 | `USER_NOT_ACTIVE_MEMBER` | Usuário sem vínculo ativo |
| 500 | `INTERNAL_ERROR` | Erro inesperado |

O controller também possui tratamento para `CONVERSATION_NOT_FOUND`, retornando HTTP 404, quando esse erro é produzido pela camada de serviço.

### Exemplo de erro

```json
{
  "error": {
    "code": "USER_NOT_ACTIVE_MEMBER",
    "message": "Usuário não é membro ativo da conversa."
  }
}
```

Os detalhes de erro podem variar conforme a validação executada.

## 8. Segurança e autorização

Os endpoints utilizam os seguintes mecanismos:

- Autenticação JWT obrigatória.
- Identidade do usuário obtida pelo servidor.
- Validação de contas ativas no PostgreSQL.
- Verificação de participação ativa no MongoDB para acesso ao histórico.
- Política de cache `no-store`.
- Tratamento padronizado de respostas de erro.

Usuários que não possuem vínculo ativo não podem consultar o histórico de mensagens de uma conversa.

## 9. Integração com o frontend React

O frontend deverá utilizar os endpoints conforme o fluxo de navegação.

| Ação do usuário | Operação |
|---|---|
| Selecionar contato | `POST /conversations/private` |
| Abrir lista de conversas | `GET /conversations` ou dashboard |
| Abrir conversa | `GET /conversations/:conversationId/messages` |
| Carregar mensagens antigas | Repetir histórico com `before` |

Para apresentar nomes de contatos, prévias de mensagens e identificação dos grupos, utilizar preferencialmente os dados públicos do dashboard.

O envio de mensagens e as confirmações de entrega e leitura são documentados em `MESSAGES.md`.

A comunicação em tempo real é documentada em `REALTIME.md`.

## 10. Testes automatizados

Os testes de conversas verificam:

- Criação de conversa privada.
- Reutilização de conversa existente.
- Listagem das conversas do usuário.
- Consulta de histórico.
- Paginação e cursores.
- Autenticação obrigatória.
- Validação de identificadores.
- Proteção contra acesso de usuários sem vínculo ativo.

Para executar os testes da API:

```powershell
cd backend
npm run test:api
```

A validação completa utiliza:

```powershell
npm test
```

## 11. Referências técnicas

- `backend/src/routes/v1/conversationRoutes.js`
- `backend/src/controllers/conversationController.js`
- `backend/src/services/conversations/conversationService.js`
- `backend/src/services/queries/messageQueryService.js`
- `backend/src/services/integration/chatPersistenceService.js`
- `backend/tests/api/conversations.test.js`

## 12. Considerações finais

A API de conversas privadas e histórico fornece os recursos necessários para navegação e consulta de mensagens no Corporate Chat.

A documentação diferencia os identificadores do PostgreSQL e MongoDB, descreve a paginação por cursor e apresenta as regras de autenticação e participação.

A integração com o frontend deverá utilizar esses contratos em conjunto com as APIs de dashboard e mensagens.
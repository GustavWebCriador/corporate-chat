# API de Conversas Privadas (BE-07)

## Base URL
`/api/v1/conversations`

## Autenticação
Todos os endpoints exigem autenticação via token Bearer JWT na header `Authorization: Bearer <token>`.

---

### 1. Criar conversa privada

**POST** `/private`

Cria uma nova conversa privada entre o usuário autenticado e outro usuário.

#### Request Body
```json
{
  "otherUserId": "uuid-do-outro-usuario"
}
```

#### Responsees

| Status | Descrição |
|--------|-----------|
| **201** | Conversa criada com sucesso |
| **400** | `OTHER_USER_ID_REQUIRED` - ID do outro usuário não informado |
| **400** | `PRIVATE_CONVERSATION_SAME_USER` - Tentativa de conversa com oneself |
| **403** | `USER_INACTIVE` - Usuário inativo |
| **500** | Erro interno do servidor |

#### Exemplos

**Sucesso (201)**
```json
{
  "data": {
    "conversation": {
      "_id": "uuid",
      "type": "PRIVATE",
      "private_key": "userA:userB",
      "created_by": "userA",
      "last_message_at": null,
      "last_message_id": null
    }
  }
}
```

**Erro 400 - ID não informado**
```json
{
  "error": {
    "code": "OTHER_USER_ID_REQUIRED",
    "message": "Informe o ID do outro usuário."
  }
}
```

---

### 2. Listar conversas

**GET** `/`

Lista todas as conversas ativas do usuário autenticado.

#### Responsees

| Status | Descrição |
|--------|-----------|
| **200** | Lista de conversas obtida com sucesso |
| **401** | Token ausente ou inválido |
| **500** | Erro interno do servidor |

#### Response (200)
```json
{
  "data": {
    "conversations": [
      {
        "_id": "uuid",
        "type": "PRIVATE",
        "membership": {
          "role": "MEMBER",
          "status": "ACTIVE",
          "joined_at": "ISO date"
        }
      }
    ]
  }
}
```

---

### 3. Consultar histórico/mensagens

**GET** `/{conversationId}/messages`

Retorna o histórico de mensagens de uma conversa, com paginação opcional.

#### Query Parameters
- `limit` (opcional): Número máximo de mensagens por página
- `before` (opcional): Cursor para obter mensagens anteriores a esta data/ID

#### Responsees

| Status | Descrição |
|--------|-----------|
| **200** | Histórico obtido com sucesso |
| **400** | `INVALID_CONVERSATION_ID` - ID de conversa inválido |
| **400** | `INVALID_QUERY_CURSOR` - Cursor de paginação inválido |
| **403** | `USER_NOT_ACTIVE_MEMBER` ou `SENDER_NOT_ACTIVE_MEMBER` - Usuário não é membro ativo da conversa ou está com status LEFT |
| **404** | `CONVERSATION_NOT_FOUND` - Conversa não encontrada |
| **500** | Erro interno do servidor |

#### Response (200)
```json
{
  "data": {
    "items": [
      {
        "_id": "msg-uuid",
        "content": "Conteúdo da mensagem",
        "sender_id": "uuid-do-remetente",
        "created_at": "ISO date",
        "reused": false
      }
    ],
    "hasMore": true,
    "nextCursor": "cursor-para-proxima-pagina"
  }
}
```

**Response (400 - conversationId inválido)**
```json
{
  "error": {
    "code": "INVALID_CONVERSATION_ID",
    "message": "conversationId inválido."
  }
}
```

**Response (400 - cursor inválido)**
```json
{
  "error": {
    "code": "INVALID_QUERY_CURSOR",
    "message": "Cursor de paginação inválido."
  }
}
```

**Response (403 - sem permissão)**
```json
{
  "error": {
    "code": "USER_NOT_ACTIVE_MEMBER",
    "message": "Usuário não é membro ativo da conversa."
  }
}
```

**Response (404 - conversa inexistente)**
```json
{
  "error": {
    "code": "CONVERSATION_NOT_FOUND",
    "message": "Conversa não encontrada."
  }
}
```
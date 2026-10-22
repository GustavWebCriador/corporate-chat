# Corporate Chat — Gerenciamento de Grupos (BE-08)

## 1. Visão geral

A API de grupos permite que usuários autenticados criem e gerenciem conversas do tipo `GROUP`.

A implementação corresponde ao gerenciamento previsto no RF09 e utiliza a estrutura de persistência já existente no MongoDB:

- `conversations`
- `conversation_members`

Não existe uma collection separada chamada `groups`.

Um grupo é representado por uma `Conversation` com:

```text
type = GROUP
```

O vínculo entre usuários e o grupo é armazenado em `conversation_members`.

---

## 2. Base URL

```text
/api/v1/groups
```

Todos os endpoints exigem autenticação JWT:

```http
Authorization: Bearer <token>
```

A identidade do usuário responsável pela requisição é obtida exclusivamente através do token autenticado.

O backend não utiliza `creatorId` ou `requesterId` enviados pelo cliente para substituir a identidade autenticada.

---

## 3. Regras principais

A implementação aplica as seguintes regras:

| Regra | Comportamento |
|---|---|
| Nome | Obrigatório e limitado a 30 caracteres |
| Quantidade inicial | Entre 2 e 50 participantes, incluindo o criador |
| Criador | Incluído automaticamente no grupo |
| Responsável | Apenas um `CREATOR` no MVP |
| Participante comum | Armazenado como `MEMBER` |
| Participação ativa | `ACTIVE` |
| Saída voluntária | `LEFT` com `left_at` |
| Remoção pelo criador | `REMOVED` com `removed_at` e `removed_by` |
| Renomear grupo | Apenas o `CREATOR` |
| Adicionar participantes | Apenas o `CREATOR` |
| Remover participantes | Apenas o `CREATOR` |
| Consultar grupo | Apenas membro `ACTIVE` |
| Usuários adicionados | Precisam existir e estar `ACTIVE` no PostgreSQL |

No MVP não existe transferência da responsabilidade do grupo.

Por esse motivo, o `CREATOR` não pode remover a si próprio nem sair voluntariamente enquanto permanecer responsável pelo grupo.

A reentrada automática de usuários com vínculo `LEFT` ou `REMOVED` não faz parte desta implementação.

---

## 4. Criar grupo

```http
POST /api/v1/groups
```

Cria um novo grupo utilizando o usuário autenticado como `CREATOR`.

### Request

```json
{
  "name": "Equipe Corporate Chat",
  "memberIds": [
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444"
  ]
}
```

O criador não precisa ser informado em `memberIds`.

Ele é incluído automaticamente com:

```text
role   = CREATOR
status = ACTIVE
```

Os demais participantes são cadastrados como:

```text
role   = MEMBER
status = ACTIVE
```

### Response — 201 Created

```json
{
  "data": {
    "group": {
      "_id": "507f1f77bcf86cd799439011",
      "type": "GROUP",
      "name": "Equipe Corporate Chat",
      "created_by": "22222222-2222-4222-8222-222222222222",
      "created_at": "2026-10-21T12:00:00.000Z",
      "updated_at": "2026-10-21T12:00:00.000Z",
      "members": [
        {
          "user_id": "22222222-2222-4222-8222-222222222222",
          "role": "CREATOR",
          "status": "ACTIVE",
          "joined_at": "2026-10-21T12:00:00.000Z"
        }
      ]
    }
  }
}
```

### Possíveis erros

| Status | Código | Situação |
|---|---|---|
| 400 | `GROUP_NAME_REQUIRED` | Nome não informado |
| 400 | `GROUP_NAME_TOO_LONG` | Nome maior que 30 caracteres |
| 400 | `GROUP_MEMBERS_REQUIRED` | Nenhum participante informado |
| 400 | `INVALID_GROUP_MEMBERS` | `memberIds` não é uma lista |
| 400 | `INVALID_USER_ID` | UUID de participante inválido |
| 400 | `INVALID_GROUP_SIZE` | Quantidade fora de 2 a 50 |
| 400 | `GROUP_MEMBERS_NOT_FOUND` | Participante não cadastrado |
| 409 | `GROUP_MEMBERS_INACTIVE` | Participante inativo |
| 401 | `TOKEN_MISSING` / `TOKEN_INVALID` | Falha de autenticação |

---

## 5. Consultar grupo

```http
GET /api/v1/groups/:groupId
```

Retorna os dados do grupo e seus participantes ativos.

O usuário autenticado deve possuir vínculo:

```text
status = ACTIVE
```

### Response — 200 OK

```json
{
  "data": {
    "group": {
      "_id": "507f1f77bcf86cd799439011",
      "type": "GROUP",
      "name": "Equipe Corporate Chat",
      "created_by": "22222222-2222-4222-8222-222222222222",
      "members": [
        {
          "user_id": "22222222-2222-4222-8222-222222222222",
          "role": "CREATOR",
          "status": "ACTIVE"
        },
        {
          "user_id": "33333333-3333-4333-8333-333333333333",
          "role": "MEMBER",
          "status": "ACTIVE"
        }
      ]
    }
  }
}
```

### Possíveis erros

| Status | Código |
|---|---|
| 400 | `INVALID_GROUP_ID` |
| 403 | `GROUP_MEMBERSHIP_REQUIRED` |
| 404 | `GROUP_NOT_FOUND` |
| 401 | `TOKEN_MISSING` / `TOKEN_INVALID` |

---

## 6. Alterar nome

```http
PATCH /api/v1/groups/:groupId
```

Somente o `CREATOR` ativo pode alterar o nome.

### Request

```json
{
  "name": "Novo nome do grupo"
}
```

### Response — 200 OK

Retorna o grupo atualizado.

### Possíveis erros

| Status | Código |
|---|---|
| 400 | `INVALID_GROUP_ID` |
| 400 | `GROUP_NAME_REQUIRED` |
| 400 | `GROUP_NAME_TOO_LONG` |
| 403 | `GROUP_CREATOR_REQUIRED` |
| 404 | `GROUP_NOT_FOUND` |

---

## 7. Adicionar participantes

```http
POST /api/v1/groups/:groupId/members
```

Somente o `CREATOR` pode adicionar participantes.

### Request

```json
{
  "memberIds": [
    "44444444-4444-4444-8444-444444444444"
  ]
}
```

Os usuários precisam existir e estar `ACTIVE` no PostgreSQL.

O limite máximo do grupo é 50 participantes ativos.

### Response — 200 OK

Retorna o grupo atualizado e a lista de participantes ativos.

### Possíveis erros

| Status | Código |
|---|---|
| 400 | `INVALID_GROUP_ID` |
| 400 | `INVALID_USER_ID` |
| 400 | `GROUP_MEMBERS_REQUIRED` |
| 400 | `GROUP_MEMBERS_NOT_FOUND` |
| 403 | `GROUP_CREATOR_REQUIRED` |
| 409 | `GROUP_MEMBERS_ALREADY_ACTIVE` |
| 409 | `GROUP_MEMBER_REENTRY_NOT_SUPPORTED` |
| 409 | `GROUP_MEMBERS_INACTIVE` |
| 409 | `GROUP_MAX_MEMBERS_EXCEEDED` |

---

## 8. Remover participante

```http
DELETE /api/v1/groups/:groupId/members/:userId
```

Somente o `CREATOR` pode remover participantes.

A remoção é lógica.

O documento em `conversation_members` permanece armazenado e passa de:

```text
ACTIVE
```

para:

```text
REMOVED
```

Também são preenchidos:

```text
removed_at
removed_by
```

### Response — 204 No Content

Não existe corpo de resposta.

### Possíveis erros

| Status | Código |
|---|---|
| 400 | `INVALID_GROUP_ID` |
| 400 | `INVALID_USER_ID` |
| 403 | `GROUP_CREATOR_REQUIRED` |
| 404 | `GROUP_NOT_FOUND` |
| 404 | `GROUP_MEMBER_NOT_FOUND` |
| 409 | `GROUP_MEMBER_NOT_ACTIVE` |
| 409 | `GROUP_CREATOR_CANNOT_BE_REMOVED` |
---

## 9. Sair voluntariamente do grupo

```http
POST /api/v1/groups/:groupId/leave
```

Permite que um participante ativo saia voluntariamente.

O vínculo não é excluído.

Ele passa de:

```text
ACTIVE
```

para:

```text
LEFT
```

e o campo:

```text
left_at
```

é preenchido.

O limite mínimo de 2 participantes é validado no momento da criação do grupo. Após a criação, remoções e saídas voluntárias podem reduzir a quantidade de membros `ACTIVE`, preservando o vínculo histórico em `conversation_members` com os estados `REMOVED` ou `LEFT`.

### Response — 204 No Content

Não existe corpo de resposta.

### Possíveis erros

| Status | Código |
|---|---|
| 400 | `INVALID_GROUP_ID` |
| 403 | `GROUP_MEMBERSHIP_REQUIRED` |
| 404 | `GROUP_NOT_FOUND` |
| 409 | `GROUP_CREATOR_CANNOT_LEAVE` |

---

## 10. Segurança e autorização

Todos os endpoints são protegidos por autenticação JWT.

A identidade utilizada nas operações é obtida por:

```javascript
req.user.user_id
```

A API não permite que o cliente determine arbitrariamente quem é o criador ou responsável por uma operação.

Operações administrativas do grupo também validam a associação do usuário com:

```text
role   = CREATOR
status = ACTIVE
```

Além disso, `created_by` da conversa precisa corresponder ao criador responsável.

---

## 11. Persistência

Os grupos utilizam as collections existentes no MongoDB.

### `conversations`

Principais campos relacionados ao grupo:

```text
type
name
created_by
created_at
updated_at
```

Para grupos:

```text
type = GROUP
```

O campo `private_key` não é utilizado.

### `conversation_members`

Principais campos:

```text
conversation_id
user_id
role
status
joined_at
left_at
removed_at
removed_by
```

Papéis:

```text
CREATOR
MEMBER
```

Estados:

```text
ACTIVE
LEFT
REMOVED
```

Os UUIDs utilizados em `created_by`, `user_id` e `removed_by` possuem referência lógica aos usuários armazenados no PostgreSQL.

---

## 12. Testes automatizados

A BE-08 possui testes da camada HTTP em:

```text
backend/tests/api/groups.test.js
```

e testes de integração real em:

```text
backend/database/tests/integration/groups-integration.test.js
```

Os testes cobrem criação, autenticação, autorização, alteração de nome, inclusão e remoção de participantes, saída voluntária, estados persistidos, usuários inativos e limites definidos para grupos.

A funcionalidade também é executada durante as regressões gerais da API, integração e persistência.
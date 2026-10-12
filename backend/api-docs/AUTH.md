# API de Autenticação (BE-01/BE-02/BE-12)

## Base URL
`/api/v1/auth`

## Fluxo de Autenticação

### 1. Login

**POST** `/login`

Autentica o usuário com e-mail e senha e retorna um token JWT.

#### Request Body
```json
{
  "email": "user@corp.local",
  "password": "Senha@123"
}
```

#### Responsees

| Status | Code | Descrição |
|--------|------|-----------|
| **200** | - | Login bem-sucedido com token JWT |
| **401** | `INVALID_CREDENTIALS` - E-mail ou senha inválidos |
| **403** | `USER_INACTIVE` - Usuário inativo no PostgreSQL |
| **400** | `VALIDATION_ERROR` - Dados de entrada inválidos |

#### Response (200)
```json
{
  "token": "jwt-token-string",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "user_id": "uuid",
    "name": "Nome do Usuário",
    "email": "user@corp.local",
    "is_admin": false,
    "status": "ACTIVE"
  }
}
```

---

### 2. Validar token (RF02)

**GET** `/me`

Valida o token e retorna os dados do usuário atuais do banco de dados. Isso garante que desativar um usuário ou mudar suas permissões tenha efeito imediato.

#### Headers
`Authorization: Bearer <token>`

#### Responsees

| Status | Code | Descrição |
|--------|------|-----------|
| **200** | - | Token válido, dados do usuário |
| **401** | `TOKEN_EXPIRED` - Token expirado |
| **401** | `TOKEN_INVALID` - Token inválido ou mal formatado |
| **403** | `USER_INACTIVE` - Usuário inativo |

#### Response (200)
```json
{
  "user": {
    "user_id": "uuid",
    "name": "Nome do Usuário",
    "email": "user@corp.local",
    "is_admin": false,
    "status": "ACTIVE"
  }
}
```

---

### 3. Logout / Revogação de Token

**POST** `/logout`

Encerra a sessão atual, revogando o token JWT. Após o logout, o token não pode mais ser usado.

#### Headers
`Authorization: Bearer <token>`

#### Responsees

| Status | Descrição |
|--------|-----------|
| **204** | Logout bem-sucedido |
| **401** | `TOKEN_MISSING` - Token ausente ou mal formatado |
| **401** | `TOKEN_REVOKED` - Sessão já revogada ou inválida |

#### Note
O token JWT continua válido assinaturamente, mas a sessão no PostgreSQL é marcada como `revoked_at`, fazendo com que o `authenticateToken` middleware rejeite a requisição com 401 TOKEN_REVOKED.

---

### 4. Token com JTI revogado

Tokens JWT possuem um `jti` (JWT ID) único. Quando o logout é realizado, o `jti` da sessão é marcado como revogado no banco de dados PostgreSQL (tabela `AuthSession`). O middleware de autenticação verifica esta tabela antes de permitir o acesso.

#### Cenários

- **Token válido, não revogado**: Acesso concedido (200)
- **Token revogado**: Rejeitado com 401 TOKEN_REVOKED
- **Token expirado**: Rejeitado com 401 TOKEN_EXPIRED
- **Token inválido**: Rejeitado com 401 TOKEN_INVALID
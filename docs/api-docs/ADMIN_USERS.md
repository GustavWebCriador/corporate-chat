# Corporate Chat — Administração de Usuários

## 1. Visão geral

A API de administração de usuários do Corporate Chat disponibiliza operações para cadastrar, consultar, listar, ativar, desativar e redefinir senhas de usuários.

Essas funcionalidades são restritas a administradores autenticados, garantindo que operações relacionadas ao gerenciamento de contas sejam realizadas por usuários autorizados.

A implementação utiliza autenticação JWT, controle de autorização e persistência relacional no PostgreSQL.

## 2. Objetivo

Esta documentação tem como objetivos:

- Descrever os endpoints administrativos disponíveis.
- Estabelecer os contratos de requisição e resposta.
- Documentar as regras de validação dos usuários.
- Apresentar os códigos HTTP e erros esperados.
- Orientar a integração com o frontend.
- Garantir rastreabilidade entre documentação e implementação.

## 3. Autenticação e autorização

Todos os endpoints administrativos utilizam o prefixo:

`/api/v1/admin/users`

O acesso exige:

- Token JWT válido enviado pelo header `Authorization`.
- Usuário autenticado com status `ACTIVE`.
- Permissão administrativa `is_admin: true`.

**Exemplo de header:**

`Authorization: Bearer <token>`

A autorização é verificada pelo backend, considerando o estado atual do usuário autenticado.

Respostas administrativas recebem a política HTTP:

`Cache-Control: no-store`

Essa política orienta clientes e intermediários a não armazenarem as respostas em cache.

## 4. Endpoints disponíveis

| Método | Endpoint | Descrição | Sucesso |
|---|---|---|---|
| POST | `/api/v1/admin/users` | Cadastrar usuário | 201 |
| GET | `/api/v1/admin/users` | Listar usuários | 200 |
| GET | `/api/v1/admin/users/:userId` | Consultar usuário | 200 |
| PATCH | `/api/v1/admin/users/:userId/status` | Alterar status | 200 |
| PATCH | `/api/v1/admin/users/:userId/password` | Redefinir senha | 204 |

Todos exigem autorização administrativa.

## 5. Cadastrar usuário

### Endpoint

`POST /api/v1/admin/users`

### Descrição

Permite que um administrador cadastre um novo usuário diretamente no sistema.

O usuário é criado com status `ACTIVE` e sem privilégios administrativos.

### Corpo da requisição

```json
{
  "name": "Maria Oliveira",
  "email": "maria@empresa.com",
  "password": "SenhaExemplo123"
}
```

### Regras de validação

| Campo | Regra |
|---|---|
| name | Obrigatório, string não vazia, até 150 caracteres |
| email | Obrigatório, formato válido, até 150 caracteres |
| password | Obrigatória, entre 8 e 128 caracteres |
| is_admin | Não pode ser informado |

A senha deve conter pelo menos uma letra maiúscula e um número.

O backend normaliza o nome, removendo espaços excedentes, e converte o e-mail para letras minúsculas.

O usuário criado recebe automaticamente:

- `status: ACTIVE`
- `is_admin: false`

### Resposta de sucesso

**HTTP 201 Created**

```json
{
  "data": {
    "user": {
      "user_id": "22222222-2222-4222-8222-222222222222",
      "name": "Maria Oliveira",
      "email": "maria@empresa.com",
      "status": "ACTIVE",
      "is_admin": false,
      "created_at": "2026-10-01T10:00:00.000Z",
      "updated_at": "2026-10-01T10:00:00.000Z",
      "last_login_at": null
    }
  }
}
```

Os valores são ilustrativos.

### Possíveis erros

| HTTP | Código | Situação |
|---|---|---|
| 400 | VALIDATION_ERROR | Campos inválidos |
| 401 | TOKEN_MISSING | Token ausente |
| 401 | TOKEN_INVALID | Token inválido |
| 403 | ADMIN_REQUIRED | Usuário sem privilégio administrativo |
| 409 | EMAIL_ALREADY_EXISTS | E-mail já cadastrado |

## 6. Listar usuários

### Endpoint

`GET /api/v1/admin/users`

### Descrição

Retorna os usuários cadastrados no sistema para consulta administrativa.

A implementação analisada retorna a lista de usuários sem paginação ou filtros HTTP específicos.

### Resposta de sucesso

**HTTP 200 OK**

```json
{
  "data": {
    "users": [
      {
        "user_id": "22222222-2222-4222-8222-222222222222",
        "name": "Maria Oliveira",
        "email": "maria@empresa.com",
        "status": "ACTIVE",
        "is_admin": false,
        "created_at": "2026-10-01T10:00:00.000Z",
        "updated_at": "2026-10-01T10:00:00.000Z",
        "last_login_at": null
      }
    ]
  }
}
```

A listagem não deve expor `password_hash`.

## 7. Consultar usuário por ID

### Endpoint

`GET /api/v1/admin/users/:userId`

### Descrição

Permite recuperar os dados públicos de um usuário específico.

O parâmetro `userId` deve ser um UUID válido.

### Resposta de sucesso

**HTTP 200 OK**

```json
{
  "data": {
    "user": {
      "user_id": "22222222-2222-4222-8222-222222222222",
      "name": "Maria Oliveira",
      "email": "maria@empresa.com",
      "status": "ACTIVE",
      "is_admin": false,
      "created_at": "2026-10-01T10:00:00.000Z",
      "updated_at": "2026-10-01T10:00:00.000Z",
      "last_login_at": null
    }
  }
}
```

### Possíveis erros

| HTTP | Código | Situação |
|---|---|---|
| 400 | INVALID_USER_ID | UUID inválido |
| 404 | USER_NOT_FOUND | Usuário inexistente |

Também se aplicam os erros de autenticação e autorização.

## 8. Alterar status do usuário

### Endpoint

`PATCH /api/v1/admin/users/:userId/status`

### Descrição

Permite ativar ou desativar uma conta de usuário.

### Corpo da requisição

```json
{
  "status": "INACTIVE"
}
```

### Valores permitidos

- `ACTIVE` — conta ativa.
- `INACTIVE` — conta desativada.

### Resposta de sucesso

**HTTP 200 OK**

```json
{
  "data": {
    "user": {
      "user_id": "22222222-2222-4222-8222-222222222222",
      "name": "Maria Oliveira",
      "email": "maria@empresa.com",
      "status": "INACTIVE",
      "is_admin": false,
      "created_at": "2026-10-01T10:00:00.000Z",
      "updated_at": "2026-10-01T11:00:00.000Z",
      "last_login_at": null
    }
  }
}
```

### Possíveis erros

| HTTP | Código | Situação |
|---|---|---|
| 400 | INVALID_USER_ID | UUID inválido |
| 400 | INVALID_USER_STATUS | Status diferente de ACTIVE ou INACTIVE |
| 404 | USER_NOT_FOUND | Usuário inexistente |

A alteração do status afeta o acesso autenticado, pois a aplicação verifica se o usuário permanece ativo.

## 9. Redefinir senha

### Endpoint

`PATCH /api/v1/admin/users/:userId/password`

### Descrição

Permite ao administrador redefinir a senha de um usuário.

### Corpo da requisição

```json
{
  "password": "NovaSenhaExemplo123"
}
```

### Validações

A nova senha deve:

- Possuir entre 8 e 128 caracteres.
- Conter pelo menos uma letra maiúscula.
- Conter pelo menos um número.

O backend utiliza bcrypt para armazenar a senha na forma de hash.

### Resposta de sucesso

**HTTP 204 No Content**

A resposta não possui corpo JSON.

### Possíveis erros

| HTTP | Código | Situação |
|---|---|---|
| 400 | INVALID_USER_ID | UUID inválido |
| 400 | VALIDATION_ERROR | Nova senha inválida |
| 404 | USER_NOT_FOUND | Usuário inexistente |

## 10. Padrão de respostas de erro

Os erros HTTP seguem o contrato da API.

### Exemplo

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados do usuário inválidos.",
    "details": [
      {
        "field": "email",
        "message": "Informe um e-mail válido."
      }
    ]
  }
}
```

O campo `details` é opcional, dependendo do erro.

Erros internos inesperados retornam uma mensagem genérica, sem expor informações técnicas sensíveis.

## 11. Segurança e privacidade

A implementação deve preservar os seguintes controles:

- Autenticação obrigatória para todas as operações administrativas.
- Autorização administrativa validada pelo servidor.
- Validação dos dados recebidos antes da persistência.
- Senhas armazenadas exclusivamente como hash.
- Ausência do campo `password_hash` nas respostas públicas.
- Política `Cache-Control: no-store` nas respostas sensíveis.
- Tratamento padronizado de erros.

A interface frontend não substitui os mecanismos de segurança do backend.

## 12. Integração com o frontend

A interface administrativa deverá consumir os endpoints documentados utilizando o cliente HTTP configurado no frontend.

Recomendações:

- Utilizar o token de autenticação nas requisições protegidas.
- Apresentar mensagens de erro de acordo com `error.code`.
- Não enviar o campo `is_admin` no cadastro de usuário.
- Não registrar senhas ou tokens nos logs.
- Tratar respostas HTTP 204 sem tentar interpretar JSON.
- Exibir as funcionalidades administrativas somente para usuários autorizados.

## 13. Referências técnicas

Arquivos relacionados:

- `backend/src/routes/v1/adminUserRoutes.js`
- `backend/src/controllers/adminUserController.js`
- `backend/src/services/users/userService.js`
- `backend/src/repositories/postgres/userRepository.js`
- `backend/src/validators/passwordPolicy.js`
- `backend/src/middlewares/authenticate.js`
- `backend/src/middlewares/cacheControl.js`

## 14. Considerações finais

A API de administração de usuários fornece as operações essenciais para gerenciamento de contas do Corporate Chat.

Os contratos descritos permitem a integração do frontend com os recursos administrativos existentes, mantendo validações, controle de acesso e proteção das informações dos usuários.
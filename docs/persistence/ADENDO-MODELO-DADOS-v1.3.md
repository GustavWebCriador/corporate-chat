# Corporate Chat — Adendo ao Modelo de Dados v1.3

**Documento base:** Modelo de Dados e Arquitetura de Persistência — v1.3 (31/08/2026)
**Referência de requisitos:** ERS v1.4
**Finalidade:** registrar as alterações de persistência implementadas depois da v1.3, para que o documento oficial seja atualizado (próxima versão do Modelo de Dados) e a cadeia **ERS → Modelo de Dados → código** volte a ficar consistente.

> Este adendo descreve o que já está implementado e versionado nas migrations. Ele não altera o banco de dados.

---

## 1. Resumo das alterações

| # | Alteração | Seção afetada na v1.3 | Migration |
|---|---|---|---|
| A1 | E-mail passa de 50 para **150** caracteres em `users` e `registration_requests` | 11, 12 (USER-R02), 14, 38 | `20261007120000-align-email-length-with-der.js` |
| A2 | Sessões de autenticação **persistidas** na nova tabela `auth_sessions`, com revogação no logout | 30, 32 | `20261010210453-create-auth-sessions.js` |
| A3 | Consistência de estado de `registration_requests` em uma única constraint | 14, 15 | `20261011231000-strengthen-registration-request-state.js` |
| A4 | No máximo uma solicitação `PENDING` por e-mail | 15 | `20261012120000-unique-pending-registration-email.js` |

---

## 2. A1 — Limite do e-mail: 150 caracteres

**Antes (v1.3):** `users.email VARCHAR(50)`; USER-R02 "no máximo 50 caracteres"; `registration_requests.email VARCHAR(50)`.

**Implementado:**

```sql
ALTER TABLE users                 ALTER COLUMN email TYPE VARCHAR(150);
ALTER TABLE registration_requests ALTER COLUMN email TYPE VARCHAR(150);
```

**Texto proposto para a próxima versão:**

- Tabela USERS: `email VARCHAR(150) NOT NULL UNIQUE`.
- **USER-R02** — email deverá possuir no máximo **150** caracteres, ser normalizado pelo backend (minúsculas, sem espaços nas extremidades) e ser único.
- Tabela REGISTRATION_REQUESTS: `email VARCHAR(150) NOT NULL`.

**Impacto na ERS:** a regra de RF01 ("o e-mail deverá possuir no máximo 50 caracteres") e o CA01.7 devem ser atualizados para 150 caracteres na próxima versão da ERS.

**Validação no backend e no frontend:** login, solicitação de cadastro e cadastro administrativo aceitam até 150 caracteres e rejeitam 151 (testes `registration-requests` e `postgres-integrity`).

---

## 3. A2 — Sessões persistidas (`auth_sessions`)

**Antes (v1.3, seção 32):** "sessão JWT stateless sem tabela de sessão persistida"; logout apenas no cliente; lista de revogação somente em evolução futura.

**Implementado:** cada login cria uma sessão no PostgreSQL. O JWT carrega o identificador da sessão no campo `jti`. A cada requisição autenticada (HTTP e Socket.IO), o backend verifica a assinatura, a expiração, a existência da sessão, a revogação e a situação atual do usuário. O logout revoga a sessão no servidor.

### Nova tabela AUTH_SESSIONS

| Campo | Tipo | Obrigatório | Chave/Regra | Descrição |
|---|---|---|---|---|
| `session_id` | UUID | Sim | PK | Identificador da sessão; corresponde ao `jti` do JWT |
| `user_id` | UUID | Sim | FK → `users.user_id` (ON UPDATE/DELETE CASCADE) | Dono da sessão |
| `expires_at` | TIMESTAMPTZ | Sim | — | Fim da validade (igual à expiração do JWT) |
| `revoked_at` | TIMESTAMPTZ | Não | — | Preenchido no logout; sessão revogada não autentica |
| `created_at` | TIMESTAMPTZ | Sim | DEFAULT now() | Criação da sessão |

Índices: `idx_auth_sessions_user_id (user_id)` e `idx_auth_sessions_expires_at (expires_at)`.

### Regras propostas

- **SES-R01** — todo login bem-sucedido cria uma sessão com `expires_at` igual à expiração do token.
- **SES-R02** — o token só é aceito se a sessão existir, não estiver revogada e não estiver expirada.
- **SES-R03** — o logout preenche `revoked_at`; o token deixa de ser aceito imediatamente.
- **SES-R04** — usuário `INACTIVE` não é autenticado, mesmo com sessão válida.
- **SES-R05** — o token não contém senha nem dados sensíveis; contém apenas o identificador do usuário, o indicador administrativo e o `jti`.

### Texto proposto para a seção 32 (Encerramento de Sessão — RF14)

> No MVP, a autenticação utiliza JWT associado a uma sessão persistida na tabela `auth_sessions`. O logout revoga a sessão no servidor (`revoked_at`), e o backend recusa tokens de sessões revogadas, expiradas ou inexistentes. O frontend remove o token da memória, encerra a conexão Socket.IO e redireciona para o login. Não há refresh token no MVP.

**Impacto no diagrama (DER PostgreSQL):** incluir a entidade `auth_sessions` com relacionamento 1:N a partir de `users`.

---

## 4. A3 — Consistência de estado das solicitações de cadastro

**Antes (v1.3):** regras REG-R03 e REG-R04 descritas separadamente (aprovação e rejeição).

**Implementado:** uma única constraint `registration_requests_state_consistency_check` garante:

| Status | `reviewed_at` / `reviewed_by` | `rejection_reason` | `created_user_id` |
|---|---|---|---|
| `PENDING` | nulos | nulo | nulo |
| `APPROVED` | preenchidos | nulo | preenchido |
| `REJECTED` | preenchidos | preenchido e não vazio | nulo |

**Texto proposto:** acrescentar às regras de solicitação de cadastro:

- **REG-R07** — uma solicitação `PENDING` não possui dados de análise nem usuário criado.
- **REG-R08** — `APPROVED` exige `created_user_id` e não possui motivo de rejeição; `REJECTED` exige motivo não vazio e não possui usuário criado.

---

## 5. A4 — Uma solicitação pendente por e-mail

**Implementado:**

```sql
CREATE UNIQUE INDEX idx_registration_requests_pending_email_unique
    ON registration_requests (LOWER(email))
    WHERE status = 'PENDING';
```

**Texto proposto:**

- **REG-R09** — um mesmo e-mail (sem diferenciar maiúsculas e minúsculas) não pode ter mais de uma solicitação `PENDING`. Após rejeição, uma nova solicitação pode ser enviada.

---

## 6. Modelo consolidado — PostgreSQL (após o adendo)

```text
users
  user_id (UUID, PK)
  name (VARCHAR 150)
  email (VARCHAR 150, UNIQUE)
  password_hash
  status (ACTIVE | INACTIVE)
  is_admin
  created_at, updated_at, last_login_at

registration_requests
  request_id (UUID, PK)
  name (VARCHAR 150)
  email (VARCHAR 150; único entre PENDING)
  status (PENDING | APPROVED | REJECTED)
  requested_at, reviewed_at
  reviewed_by → users.user_id
  rejection_reason (VARCHAR 500)
  created_user_id → users.user_id

auth_sessions
  session_id (UUID, PK = jti do JWT)
  user_id → users.user_id
  expires_at, revoked_at, created_at
```

O domínio MongoDB (`conversations`, `conversation_members`, `messages`) não foi alterado.

---

## 7. Próximos passos da equipe

1. Publicar o **Modelo de Dados v1.4** incorporando as seções 2 a 6 deste adendo (texto, tabelas e DER).
2. Atualizar a ERS (RF01 e CA01.7) para o limite de 150 caracteres.
3. Registrar a mudança na seção de controle de versão dos dois documentos e no diário de bordo.
4. Submeter as versões atualizadas à validação do orientador.

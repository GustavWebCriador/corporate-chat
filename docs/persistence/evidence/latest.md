# Evidência Automatizada — Persistência

Gerada em: `2026-10-04T20:28:30.028Z`

## Node.js

Comando:

```text
node --version
```

Exit code: `0`

```text
v24.15.0

```

## npm

Comando:

```text
npm --version
```

Exit code: `0`

```text
11.12.1

```

## Docker Compose

Comando:

```text
docker compose version
```

Exit code: `0`

```text
Docker Compose version v5.3.1

```

## Git branch

Comando:

```text
git branch --show-current
```

Exit code: `0`

```text
main

```

## Git commit

Comando:

```text
git rev-parse --short HEAD
```

Exit code: `128`

```text
fatal: Needed a single revision

```

## Containers

Comando:

```text
docker compose --env-file ".env" -f "../docker-compose.yml" ps
```

Exit code: `0`

```text
NAME                                IMAGE         COMMAND                  SERVICE    CREATED       STATUS                 PORTS
corporate_chat_mongodb_container    mongo:8       "docker-entrypoint.s…"   mongodb    5 hours ago   Up 5 hours (healthy)   0.0.0.0:27017->27017/tcp, [::]:27017->27017/tcp
corporate_chat_postgres_container   postgres:16   "docker-entrypoint.s…"   postgres   5 hours ago   Up 5 hours (healthy)   0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp

```

## Migrations

Comando:

```text
npm run db:migrate:status
```

Exit code: `0`

```text

> backend@1.0.0 db:migrate:status
> sequelize-cli db:migrate:status


Sequelize CLI [Node: 24.15.0, CLI: 6.6.5, ORM: 6.37.8]

Loaded configuration file "src\config\sequelize-cli.js".
Using environment "development".
up 20260923021125-create-users.js
up 20260923022037-enable-pgcrypto.js
up 20260923022359-create-registration-requests.js
up 20261001010632-add-database-constraints-and-indexes.js
up 20261004144551-optimize-critical-queries.js

◇ injected env (0) from .env

```

## Development seed

Comando:

```text
npm run seed:verify
```

Exit code: `0`

```text

> backend@1.0.0 seed:verify
> node scripts/verify-dev-seed.js


========================================
 Development Seed Verification
========================================
[POSTGRES] Users: 4/4 OK
[POSTGRES] Requests: 3/3 OK
[MONGODB] Connection established successfully.
[MONGODB] Conversations: 2/2 OK
[MONGODB] Conversation creators: OK
[MONGODB] Members: 6/6 OK
[MONGODB] Messages: 5/5 OK
[INTEGRATION] PostgreSQL ↔ MongoDB UUID references: OK

========================================
 Development seed: VALID
========================================

◇ injected env (0) from .env

```

## Cross-database integrity

Comando:

```text
npm run integration:verify
```

Exit code: `0`

```text

> backend@1.0.0 integration:verify
> node scripts/verify-cross-db-integrity.js


========================================
 PostgreSQL <-> MongoDB Integrity
========================================
[MONGODB] Connection established successfully.

[INTEGRATION] Referenced users: 4
[INTEGRATION] Missing users: 0

PostgreSQL <-> MongoDB integrity: VALID

◇ injected env (0) from .env

```

## Critical queries

Comando:

```text
npm run queries:verify
```

Exit code: `0`

```text

> backend@1.0.0 queries:verify
> node scripts/verify-critical-queries.js


========================================
 Corporate Chat - Critical Queries
========================================
[MONGODB] Connection established successfully.
[QUERY] User by email: OK
[QUERY] Pending requests: OK
[QUERY] User conversations: 2 OK
[QUERY] Latest messages: 2/2 OK
[QUERY] Unread messages: 1/1 OK

========================================
 Critical persistence queries: VALID
========================================

◇ injected env (0) from .env

```

## Automated tests

Comando:

```text
npm test
```

Exit code: `0`

```text

> backend@1.0.0 test
> npm run test:persistence


> backend@1.0.0 test:persistence
> npm run test:integrity && npm run test:integration && npm run test:queries


> backend@1.0.0 test:integrity
> node scripts/test-integrity.js


========================================
 Corporate Chat - Persistence Integrity
========================================

> node database/mongodb/sync-indexes.js
[MONGODB] Connecting...
[MONGODB] Connection established successfully.
[MONGODB] Synchronizing indexes...
[MONGODB] Indexes synchronized successfully.
[MONGODB] Connection closed.

> node scripts/verify-dev-seed.js

========================================
 Development Seed Verification
========================================
[POSTGRES] Users: 4/4 OK
[POSTGRES] Requests: 3/3 OK
[MONGODB] Connection established successfully.
[MONGODB] Conversations: 2/2 OK
[MONGODB] Conversation creators: OK
[MONGODB] Members: 6/6 OK
[MONGODB] Messages: 5/5 OK
[INTEGRATION] PostgreSQL ↔ MongoDB UUID references: OK

========================================
 Development seed: VALID
========================================

> node --test --test-concurrency=1 database/tests/integrity/postgres-integrity.test.js database/tests/integrity/mongodb-integrity.test.js
◇ injected env (0) from .env
[MONGODB] Connection established successfully.
✔ MONGO: GROUP válido deve ser aceito (263.2376ms)
✔ MONGO: GROUP sem nome deve ser rejeitado (27.2688ms)
✔ MONGO: PRIVATE sem private_key deve ser rejeitado (15.3442ms)
✔ MONGO: PRIVATE não pode possuir name (16.6695ms)
✔ MONGO: created_by inválido deve ser rejeitado (15.7344ms)
✔ MONGO: private_key duplicada deve ser rejeitada (25.3772ms)
✔ MONGO: membro ACTIVE válido deve ser aceito (14.9807ms)
✔ MONGO: mesmo usuário não pode aparecer duas vezes na mesma conversa (17.8487ms)
✔ MONGO: LEFT sem left_at deve ser rejeitado (10.7025ms)
✔ MONGO: REMOVED sem removed_at e removed_by deve ser rejeitado (9.9127ms)
✔ MONGO: user_id inválido deve ser rejeitado (9.7185ms)
✔ MONGO: mensagem válida deve ser aceita (12.8691ms)
✔ MONGO: mensagem vazia deve ser rejeitada (10.9599ms)
✔ MONGO: mensagem acima de 1000 caracteres deve ser rejeitada (8.6915ms)
✔ MONGO: sender_id inválido deve ser rejeitado (12.415ms)
✔ MONGO: mesma mensagem do mesmo remetente não pode ser duplicada (16.2947ms)
✔ MONGO: client_message_id igual é permitido para remetentes diferentes (15.9419ms)
◇ injected env (0) from .env
✔ POSTGRES: usuário válido deve ser aceito (118.7968ms)
✔ POSTGRES: status inválido de usuário deve ser rejeitado (12.7456ms)
✔ POSTGRES: e-mail duplicado deve ser rejeitado (16.507ms)
✔ POSTGRES: solicitação PENDING válida deve ser aceita (10.9133ms)
✔ POSTGRES: solicitação APPROVED válida deve ser aceita (19.8031ms)
✔ POSTGRES: APPROVED sem revisão deve ser rejeitado (7.044ms)
✔ POSTGRES: REJECTED sem motivo deve ser rejeitado (11.2342ms)
✔ POSTGRES: reviewed_by inexistente deve ser rejeitado (8.8853ms)
✔ POSTGRES: usuário referenciado não pode ser removido fisicamente (13.9846ms)
ℹ tests 26
ℹ suites 0
ℹ pass 26
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2213.8512

========================================
 Persistence integrity: VALID
========================================

> backend@1.0.0 test:integration
> node --test --test-concurrency=1 database/tests/integration/persistence-integration.test.js

◇ injected env (0) from .env
[MONGODB] Connection established successfully.
✔ INTEGRATION: usuário ACTIVE deve ser aceito (736.0691ms)
✔ INTEGRATION: usuário inexistente deve ser rejeitado (15.3042ms)
✔ INTEGRATION: usuário INACTIVE deve ser rejeitado (62.2418ms)
✔ INTEGRATION: conversa privada deve usar usuários PostgreSQL válidos (87.6093ms)
✔ INTEGRATION: conversa privada deve ser reutilizada (65.549ms)
✔ INTEGRATION: grupo deve rejeitar usuário INACTIVE (19.0616ms)
✔ INTEGRATION: membro ACTIVE pode enviar mensagem (90.866ms)
✔ INTEGRATION: usuário que não pertence à conversa não pode enviar mensagem (57.8014ms)
✔ INTEGRATION: reenvio deve reutilizar a mesma mensagem (78.8424ms)
✔ INTEGRATION: auditoria deve detectar referência órfã (38.3282ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2518.8294

> backend@1.0.0 test:queries
> node --test --test-concurrency=1 database/tests/queries/persistence-queries.test.js

◇ injected env (0) from .env
[MONGODB] Connection established successfully.
✔ QUERY: usuário deve ser localizado por e-mail normalizado (222.1672ms)
✔ QUERY: solicitações PENDING devem possuir paginação por cursor (39.2219ms)
✔ QUERY: histórico deve carregar últimas 50 e depois mensagens anteriores (132.494ms)
✔ QUERY: conversas devem ser listadas para membro ACTIVE (82.051ms)
✔ QUERY: contador deve retornar somente mensagens não lidas recebidas (92.5794ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1813.9275

◇ injected env (0) from .env
◇ injected env (0) from .env
◇ injected env (0) from .env

```

## Resultado final

❌ 1 verificação(ões) falharam.

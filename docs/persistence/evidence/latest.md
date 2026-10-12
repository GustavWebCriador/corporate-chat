# Evidência Automatizada — Persistência

Gerada em: `2026-10-12T00:49:14.523Z`

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
feat/BE-05-cadastro-usuarios

```

## Git commit

Comando:

```text
git rev-parse --short HEAD
```

Exit code: `0`

```text
17c671e

```

## Containers

Comando:

```text
docker compose --env-file ".env" -f "../docker-compose.yml" ps
```

Exit code: `0`

```text
NAME                                IMAGE         COMMAND                  SERVICE    CREATED          STATUS                    PORTS
corporate_chat_mongodb_container    mongo:8       "docker-entrypoint.s…"   mongodb    31 minutes ago   Up 31 minutes (healthy)   0.0.0.0:27017->27017/tcp, [::]:27017->27017/tcp
corporate_chat_postgres_container   postgres:16   "docker-entrypoint.s…"   postgres   31 minutes ago   Up 31 minutes (healthy)   0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp

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
up 20261007120000-align-email-length-with-der.js
up 20261010210453-create-auth-sessions.js
up 20261011231000-strengthen-registration-request-state.js
up 20261012120000-unique-pending-registration-email.js

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
> npm run test:persistence && npm run test:api


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
✔ MONGO: GROUP válido deve ser aceito (158.7093ms)
✔ MONGO: GROUP sem nome deve ser rejeitado (12.7791ms)
✔ MONGO: PRIVATE sem private_key deve ser rejeitado (14.3463ms)
✔ MONGO: PRIVATE não pode possuir name (14.5291ms)
✔ MONGO: created_by inválido deve ser rejeitado (10.2785ms)
✔ MONGO: private_key duplicada deve ser rejeitada (22.3482ms)
✔ MONGO: membro ACTIVE válido deve ser aceito (13.4339ms)
✔ MONGO: mesmo usuário não pode aparecer duas vezes na mesma conversa (14.9619ms)
✔ MONGO: LEFT sem left_at deve ser rejeitado (9.757ms)
✔ MONGO: REMOVED sem removed_at e removed_by deve ser rejeitado (10.2243ms)
✔ MONGO: user_id inválido deve ser rejeitado (10.2897ms)
✔ MONGO: mensagem válida deve ser aceita (12.1647ms)
✔ MONGO: mensagem vazia deve ser rejeitada (10.3976ms)
✔ MONGO: mensagem acima de 1000 caracteres deve ser rejeitada (9.0048ms)
✔ MONGO: sender_id inválido deve ser rejeitado (8.8649ms)
✔ MONGO: mesma mensagem do mesmo remetente não pode ser duplicada (14.4401ms)
✔ MONGO: client_message_id igual é permitido para remetentes diferentes (14.3958ms)
◇ injected env (0) from .env
✔ POSTGRES: usuário válido deve ser aceito (145.5351ms)
✔ POSTGRES: status inválido de usuário deve ser rejeitado (13.781ms)
✔ POSTGRES: e-mail duplicado deve ser rejeitado (14.3705ms)
✔ POSTGRES: solicitação PENDING válida deve ser aceita (18.1882ms)
✔ POSTGRES: solicitação APPROVED válida deve ser aceita (25.3636ms)
✔ POSTGRES: APPROVED sem revisão deve ser rejeitado (12.0184ms)
✔ POSTGRES: REJECTED sem motivo deve ser rejeitado (12.081ms)
✔ POSTGRES: reviewed_by inexistente deve ser rejeitado (11.0991ms)
✔ POSTGRES: usuário referenciado não pode ser removido fisicamente (18.6419ms)
✔ POSTGRES: e-mail com 150 caracteres deve ser aceito em users e registration_requests (12.1069ms)
✔ POSTGRES: e-mail com 151 caracteres deve ser rejeitado em users (7.0804ms)
✔ POSTGRES: e-mail com 151 caracteres deve ser rejeitado em registration_requests (5.9608ms)
✔ POSTGRES: REJECTED sem reviewed_by deve ser rejeitado (6.0407ms)
✔ POSTGRES: created_user_id inexistente deve ser rejeitado (8.3106ms)
✔ POSTGRES: PENDING com dados de revisão deve ser rejeitado (7.5343ms)
✔ POSTGRES: PENDING com created_user_id deve ser rejeitado (9.5154ms)
✔ POSTGRES: APPROVED sem created_user_id deve ser rejeitado (8.0666ms)
✔ POSTGRES: APPROVED com rejection_reason deve ser rejeitado (10.8328ms)
✔ POSTGRES: REJECTED com created_user_id deve ser rejeitado (9.7189ms)
✔ POSTGRES: somente uma solicitação PENDING por e-mail deve ser permitida (9.6407ms)
ℹ tests 37
ℹ suites 0
ℹ pass 37
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2081.7883

========================================
 Persistence integrity: VALID
========================================

> backend@1.0.0 test:integration
> node --test --test-concurrency=1 database/tests/integration/*.test.js

◇ injected env (0) from .env
✔ BE-12 INTEGRATION: criar sessão no PostgreSQL (160.5818ms)
✔ BE-12 INTEGRATION: consultar sessão pelo repository (16.0593ms)
✔ BE-12 INTEGRATION: revogar sessão atual (20.4303ms)
✔ BE-12 INTEGRATION: não revogar sessão duas vezes (15.5328ms)
✔ BE-12 INTEGRATION: revogação de uma sessão não afeta outra (22.6276ms)
✔ BE-12 INTEGRATION: não revogar sessão pertencente a outro usuário (13.5823ms)
✔ BE-12 INTEGRATION: rejeitar sessão para usuário inexistente (8.6085ms)
◇ injected env (0) from .env
[MONGODB] Connection established successfully.
✔ INTEGRATION: usuário ACTIVE deve ser aceito (239.2067ms)
✔ INTEGRATION: usuário inexistente deve ser rejeitado (4.4962ms)
✔ INTEGRATION: usuário INACTIVE deve ser rejeitado (13.8979ms)
✔ INTEGRATION: conversa privada deve usar usuários PostgreSQL válidos (77.9269ms)
✔ INTEGRATION: conversa privada deve ser reutilizada (59.765ms)
✔ INTEGRATION: grupo deve rejeitar usuário INACTIVE (18.4245ms)
✔ INTEGRATION: membro ACTIVE pode enviar mensagem (76.5918ms)
✔ INTEGRATION: usuário que não pertence à conversa não pode enviar mensagem (52.3825ms)
✔ INTEGRATION: reenvio deve reutilizar a mesma mensagem (64.7282ms)
✔ INTEGRATION: auditoria deve detectar referência órfã (32.2737ms)
◇ injected env (0) from .env
✔ BE-05 INTEGRATION: aprovação cria usuário e atualiza a solicitação atomicamente (1064.1097ms)
✔ BE-05 INTEGRATION: rejeição persiste análise e não cria usuário (41.7441ms)
✔ BE-05 INTEGRATION: falha após criar usuário executa rollback completo (433.05ms)
✔ BE-05 INTEGRATION: duas aprovações concorrentes criam somente um usuário (878.9864ms)
✔ BE-05 INTEGRATION: duas solicitações simultâneas mantêm somente uma PENDING (29.016ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5753.3779

> backend@1.0.0 test:queries
> node --test --test-concurrency=1 database/tests/queries/persistence-queries.test.js

◇ injected env (0) from .env
[MONGODB] Connection established successfully.
✔ QUERY: usuário deve ser localizado por e-mail normalizado (219.0984ms)
✔ QUERY: solicitações PENDING devem possuir paginação por cursor (54.4097ms)
✔ QUERY: histórico deve carregar últimas 50 e depois mensagens anteriores (125.3806ms)
✔ QUERY: conversas devem ser listadas para membro ACTIVE (72.8917ms)
✔ QUERY: contador deve retornar somente mensagens não lidas recebidas (66.7056ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1789.8097

> backend@1.0.0 test:api
> node --test --test-concurrency=1 tests/api/*.test.js

✔ ADMIN USERS: rota sem autenticação retorna 401 (131.3894ms)
✔ ADMIN USERS: usuário comum recebe 403 (67.3395ms)
✔ ADMIN USERS: administrador cadastra usuário (22.2011ms)
✔ ADMIN USERS: e-mail é normalizado antes da persistência (22.3717ms)
✔ ADMIN USERS: senha fraca retorna 400 (20.2696ms)
✔ ADMIN USERS: administrador lista usuários sem expor senha (24.1247ms)
✔ ADMIN USERS: administrador desativa usuário e novo acesso é bloqueado (18.3648ms)
✔ ADMIN USERS: redefinição de senha invalida a senha anterior (16.8929ms)
✔ LOGIN: credenciais válidas retornam 200 com token JWT e dados do usuário (129.9852ms)
✔ LOGIN: e-mail com maiúsculas e espaços é normalizado (22.5669ms)
✔ LOGIN: login bem-sucedido atualiza last_login_at (20.6376ms)
✔ LOGIN: senha errada retorna 401 INVALID_CREDENTIALS e não atualiza last_login_at (18.9566ms)
✔ LOGIN: e-mail inexistente responde igual a senha errada (sem revelar cadastro) (150.2717ms)
✔ LOGIN: usuário INACTIVE com senha correta retorna 403 USER_INACTIVE (14.1211ms)
✔ LOGIN: usuário INACTIVE com senha errada continua 401 (não confirma o status) (14.0331ms)
✔ LOGIN: campos ausentes retornam 400 VALIDATION_ERROR com details (14.2028ms)
✔ LOGIN: requisição sem corpo retorna 400 VALIDATION_ERROR (12.8663ms)
✔ LOGIN: tipos inválidos (número, objeto, array) retornam 400 (21.0456ms)
✔ LOGIN: e-mail com formato inválido ou maior que 150 caracteres retorna 400 (35.8278ms)
✔ LOGIN: e-mail com exatamente 150 caracteres é aceito na validação (DER v1.3) (131.2945ms)
✔ LOGIN: senha acima de 128 caracteres retorna 400 (13.4865ms)
✔ LOGIN: JSON malformado retorna 400 INVALID_JSON (18.6347ms)
✔ LOGIN: JWT_SECRET ausente retorna 500 genérico, sem vazar detalhes nem gravar last_login_at (12.7231ms)
✔ AUTH: fluxo completo, login e depois GET /auth/me com o token (18.3287ms)
✔ AUTH: esquema Bearer é aceito sem diferenciar maiúsculas (14.9519ms)
✔ AUTH: sem header, esquema errado ou Bearer sem token retornam 401 TOKEN_MISSING (18.5854ms)
✔ AUTH: token aleatório retorna 401 TOKEN_INVALID (8.5945ms)
✔ AUTH: token expirado retorna 401 TOKEN_EXPIRED (9.7666ms)
✔ AUTH: token assinado com outro segredo retorna 401 TOKEN_INVALID (23.3632ms)
✔ AUTH: token com algoritmo 'none' é rejeitado (12.8192ms)
✔ AUTH: token com emissor diferente é rejeitado (17.3947ms)
✔ AUTH: token com sub que não é UUID é rejeitado sem consultar o banco (19.9514ms)
✔ AUTH: token de usuário que não existe mais retorna 401 TOKEN_INVALID (15.9911ms)
✔ AUTH: usuário desativado depois do login perde o acesso (403 USER_INACTIVE) (14.5023ms)
✔ ADMIN: administrador acessa rota protegida (200) (9.1308ms)
✔ ADMIN: usuário comum recebe 403 ADMIN_REQUIRED (9.6177ms)
✔ ADMIN: sem token recebe 401 TOKEN_MISSING (e não 403) (8.5567ms)
✔ ADMIN: requireAdmin sem authenticate antes retorna 401 AUTH_REQUIRED (10.4495ms)
✔ ADMIN: a permissão vem do banco, não do token (claim is_admin adulterada não vale) (9.4818ms)
✔ ADMIN: promoção a administrador vale imediatamente, mesmo com token antigo (9.3947ms)
✔ CONFIG: getJwtConfig exige JWT_SECRET (1.2888ms)
✔ CONFIG: em produção, segredo curto é recusado (0.4242ms)
✔ CONFIG: expiração padrão é 1h e pode ser alterada por JWT_EXPIRES_IN (0.2985ms)
✔ GET /api/v1/health retorna 200 quando PostgreSQL e MongoDB estão ativos (134.8693ms)
✔ GET /api/v1/health retorna 503 quando o PostgreSQL está fora (21.3283ms)
✔ GET /api/v1/health retorna 503 quando o MongoDB está fora (17.1782ms)
✔ health marca como down um serviço que excede o timeout (236.3758ms)
✔ health não expõe mensagens de erro internas (11.1477ms)
✔ rota inexistente retorna 404 ROUTE_NOT_FOUND no formato padrão (13.4444ms)
✔ JSON malformado retorna 400 INVALID_JSON (35.0501ms)
✔ corpo acima do limite retorna 413 PAYLOAD_TOO_LARGE (15.4013ms)
✔ a resposta não revela o header X-Powered-By (8.504ms)
✔ errorHandler converte AppError, incluindo details, e oculta erros inesperados (14.0049ms)
✔ AppError expõe statusCode, code e isOperational (0.556ms)
✔ LOGOUT: login cria sessão com jti e expiração (129.7041ms)
✔ LOGOUT: sessão válida retorna 204 No Content (29.62ms)
✔ LOGOUT: token revogado não pode acessar /auth/me (32.5612ms)
✔ LOGOUT: encerrar sessão A não encerra sessão B (56.7977ms)
✔ LOGOUT: repetir logout retorna 401 TOKEN_REVOKED (18.764ms)
✔ LOGOUT: requisição sem token retorna 401 TOKEN_MISSING (9.7515ms)
✔ LOGOUT: JWT sem jti é rejeitado (10.5572ms)
✔ LOGOUT: falha na persistência impede retorno do JWT (15.5625ms)
✔ PASSWORD: senha válida deve ser aceita (1.2473ms)
✔ PASSWORD: senha menor que 8 caracteres deve ser rejeitada (0.3314ms)
✔ PASSWORD: senha sem maiúscula deve ser rejeitada (0.1973ms)
✔ PASSWORD: senha sem número deve ser rejeitada (0.1951ms)
✔ PASSWORD: senha acima de 128 caracteres deve ser rejeitada (0.2685ms)
✔ solicitação pública cria PENDING sem login e ignora campos extras (94.6033ms)
✔ solicitação valida payload e rejeita e-mail já usado ou já pendente (35.2258ms)
✔ rotas administrativas exigem autenticação e perfil de administrador (31.8566ms)
✔ admin lista com filtro/paginação e valida parâmetros (53.5021ms)
✔ aprovar cria usuário ACTIVE que consegue fazer login e bloqueia nova análise (26.1119ms)
✔ rejeitar exige motivo, não cria usuário e permite nova solicitação do e-mail (21.1165ms)
✔ aprovar/rejeitar valida UUID e retorna 404 para solicitação inexistente (15.4433ms)
✔ solicitação aceita e-mail com 150 caracteres e rejeita 151 (10.3384ms)
✔ rejeição aceita motivo com 500 caracteres e rejeita 501 (18.28ms)
ℹ tests 76
ℹ suites 0
ℹ pass 76
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7112.4461

◇ injected env (0) from .env
◇ injected env (0) from .env
◇ injected env (0) from .env

```

## Resultado final

✅ Todas as verificações foram concluídas com sucesso.

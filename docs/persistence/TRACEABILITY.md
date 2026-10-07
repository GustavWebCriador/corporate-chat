# Matriz de Rastreabilidade — Persistência

## Objetivo

Relacionar requisitos do Corporate Chat com as estruturas de persistência implementadas e com suas respectivas evidências de teste.

## Legenda

- ✅ Implementado no escopo da persistência
- 🟡 Parcial — persistência implementada, outras camadas do requisito ainda são necessárias
- ⬜ Fora do escopo desta Sprint de persistência

> Esta matriz não declara que todo o requisito funcional do MVP está concluído. Ela registra a cobertura da camada de persistência.

---

## 1. Requisitos funcionais e não funcionais

| Req. | Aspecto da persistência | Implementação | Teste/Evidência | Cobertura |
|---|---|---|---|---|
| RF01 | Identidade, e-mail e `password_hash` | `User.js`, migrations, `postgresQueryService.js` | query por e-mail + integrity tests | 🟡 JWT/login ainda pendente |
| RF03 | `status`, `is_admin`, `password_hash` | `users`, `User.js` | `postgres-integrity.test.js` | 🟡 API administrativa pendente |
| RF04 | Solicitação de cadastro | `registration_requests`, constraints, queries | integrity + query tests | 🟡 fluxo/API de aprovação pendente |
| RF05 | Dados necessários ao dashboard | `listUserConversations()` | query tests | 🟡 frontend/dashboard pendente |
| RF06 | Conversa PRIVATE 1:1 | `createPrivateConversation()` + `private_key` | integration + integrity tests | ✅ Persistência |
| RF07 | Persistência de mensagem | `Message.js`, `createMessage()` | Mongo integrity + integration | 🟡 Socket.IO/estado visual pendente |
| RF08 | Offline e reenvio | `client_message_id`, entrega/leitura | idempotência + seeds/testes | 🟡 reconexão/cliente pendentes |
| RF09 | Criação de GROUP | `createGroupConversation()` | integration/schema tests | 🟡 gestão completa do grupo ainda não coberta |
| RF10 | Mensagem somente para membro | membership `ACTIVE` + `createMessage()` | integration tests | 🟡 tempo real pendente |
| RF11 | Histórico | `getLatestMessages()`, `getMessageHistory()` | query tests | ✅ Persistência |
| RNF01 | Senha não armazenada em texto puro | `password_hash` | seeds + schema | 🟡 JWT ainda pendente |
| RNF02 | Controle de acesso a conversas | validação de membership `ACTIVE` | integration/query tests | 🟡 proteção HTTP/JWT pendente |
| RNF03 | Isolamento das conversas | `conversation_members` | integration/query tests | ✅ Persistência |
| RNF05 | Desempenho de histórico | índices + limite 50 + cursor | query tests | ✅ Persistência |
| RNF07 | Manutenibilidade | models/services/tests separados | estrutura do repositório | ✅ |
| RNF09 | Persistência poliglota | PostgreSQL + MongoDB | `env:fresh` + testes | ✅ |

---

## 2. Regras de Integridade do Modelo v1.3

| RI | Regra | Implementação | Teste/Evidência |
|---|---|---|---|
| RI01 | `user_id` único | PK `users.user_id` | estrutura PostgreSQL |
| RI02 | e-mail único e máximo de 150 caracteres (DER v1.3) | `VARCHAR(150)` + UNIQUE | integrity tests |
| RI03 | mensagem pertence a uma conversa | `createMessage()` + `conversation_id` | integration |
| RI04 | `sender_id` corresponde a membro autorizado | membership `ACTIVE` | integration |
| RI05 | conteúdo entre 1 e 1.000 caracteres | `Message.js` | Mongo integrity |
| RI06 | membro único por conversa | índice composto UNIQUE | Mongo integrity |
| RI07 | PRIVATE com exatamente dois membros ativos | `createPrivateConversation()` | integration |
| RI08 | GROUP com 2 a 50 membros | `createGroupConversation()` | integration |
| RI09 | GROUP com um único `CREATOR` | criação controlada pelo service | Revisar teste explícito dedicado |
| RI10 | nome de GROUP com no máximo 30 caracteres | schema `Conversation` | integrity |
| RI11 | somente membros `ACTIVE` acessam novas mensagens | services/queries | integration + queries |
| RI12 | `reviewed_by`/`created_user_id` referenciam users | FKs PostgreSQL | PostgreSQL integrity |
| RI13 | reenvio idempotente por remetente | UNIQUE `sender_id + client_message_id` | integrity + integration |

---

## 3. Decisões arquiteturais refletidas no código

| Decisão | Aplicação no projeto |
|---|---|
| PostgreSQL é a fonte da identidade | `users.user_id` é o UUID oficial |
| MongoDB armazena comunicação | `conversations`, `conversation_members`, `messages` |
| Não existe FK física entre os bancos | validação no backend |
| UUID identifica usuário | PostgreSQL UUID e String UUID no MongoDB |
| ObjectId identifica documentos MongoDB | collections MongoDB |
| Conversa privada não deve duplicar | `private_key` UNIQUE |
| Grupo usa `conversations.type = GROUP` | não existe collection separada de grupos |
| Leitura é por participante | `last_read_message_id` / `last_read_at` |
| Histórico inicial = até 50 mensagens | query service com paginação por cursor |
| Reenvio é idempotente | `client_message_id` |

---

## 4. Evidência operacional

```bash
cd backend
npm run seed:verify
npm run integration:verify
npm run queries:verify
npm test
```

Após a PER-10:

```bash
npm run verify:persistence
npm run evidence:persistence
```

O arquivo gerado em `docs/persistence/evidence/latest.md` deverá registrar os resultados da versão/commit validado.

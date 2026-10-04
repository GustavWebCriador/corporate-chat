# Corporate Chat — Persistência de Dados

## 1. Objetivo

Este documento registra a implementação da camada de persistência do Corporate Chat realizada nas PER-01 até PER-10.

A implementação utiliza persistência poliglota:

- PostgreSQL para identidade, cadastro e dados estruturados;
- MongoDB para conversas, participantes, mensagens, histórico, entrega e leitura.

A aplicação backend é responsável pela integração lógica entre os dois bancos.

---

## 2. Documentos de referência

A implementação foi orientada pelos documentos:

- Especificação de Requisitos de Software — Corporate Chat v1.4;
- Modelo de Dados e Arquitetura de Persistência — Corporate Chat v1.3.

A rastreabilidade entre requisitos, implementação e testes está registrada em `docs/persistence/TRACEABILITY.md`.

---

## 3. Arquitetura

```text
                    Corporate Chat
                          │
                          ▼
                    Node.js/Express
                          │
             ┌────────────┴────────────┐
             │                         │
             ▼                         ▼
        PostgreSQL                  MongoDB
             │                         │
       identidade                  comunicação
       cadastro                    conversations
       autenticação                members
       solicitações                messages
```

### PostgreSQL

Responsável por:

- `users`;
- `registration_requests`;
- UUID dos usuários;
- status do usuário;
- indicador administrativo;
- `password_hash`;
- integridade relacional;
- migrations;
- seeders.

### MongoDB

Responsável por:

- `conversations`;
- `conversation_members`;
- `messages`;
- histórico;
- cursores de entrega;
- cursores de leitura.

---

## 4. Fonte oficial da identidade

`users.user_id` no PostgreSQL é a fonte oficial da identidade.

Os campos MongoDB `conversations.created_by`, `conversation_members.user_id`, `conversation_members.removed_by` e `messages.sender_id` armazenam esse UUID como referência lógica.

Não existe Foreign Key física entre PostgreSQL e MongoDB. A integridade é validada pela camada de serviços do backend.

---

## 5. Evolução do Product Backlog

| PER | Entrega | Situação |
|---|---|---|
| PER-01 | Ambiente de persistência | ✅ Done |
| PER-02 | Schema PostgreSQL | ✅ Done |
| PER-03 | Models MongoDB | ✅ Done |
| PER-04 | Constraints e índices | ✅ Done |
| PER-05 | Ambiente reproduzível | ✅ Done |
| PER-06 | Seeds de desenvolvimento | ✅ Done |
| PER-07 | Testes automatizados de integridade | ✅ Done |
| PER-08 | Integração PostgreSQL ↔ MongoDB | ✅ Done |
| PER-09 | Consultas críticas | ✅ Done |
| PER-10 | Documentação e evidências | ✅ Done |

---

## 6. Estruturas implementadas

### PostgreSQL

- `users`;
- `registration_requests`;
- PK UUID;
- FK `reviewed_by`;
- FK `created_user_id`;
- UNIQUE de e-mail;
- CHECKs de status;
- constraints condicionais;
- índices de consulta;
- migrations;
- seeders.

### MongoDB

- `conversations`;
- `conversation_members`;
- `messages`;
- validações Mongoose;
- índices UNIQUE;
- índices compostos;
- idempotência de mensagens;
- seed DEV idempotente.

---

## 7. Serviços de persistência

### Integração

`backend/src/services/integration/`

Responsável por validar identidade no PostgreSQL, impedir novas operações para usuários inválidos/inativos, criar conversas, criar grupos, persistir mensagens, validar participação ativa e verificar referências PostgreSQL ↔ MongoDB.

### Consultas

`backend/src/services/queries/`

Responsável por localizar usuário por e-mail, listar solicitações pendentes, listar conversas do usuário, carregar histórico paginado e calcular mensagens não lidas.

---

## 8. Testes

```text
backend/database/tests/
├── integrity/
├── integration/
└── queries/
```

- `integrity`: constraints, schemas, índices, unicidade e validações;
- `integration`: operações que cruzam PostgreSQL e MongoDB;
- `queries`: consultas críticas e paginação.

Execução completa:

```bash
cd backend
npm test
```

---

## 9. Comandos principais

```bash
cd backend
npm run env:sync
npm run env:fresh -- --confirm
npm run db:migrate:status
npm run seed:verify
npm run integration:verify
npm run queries:verify
npm test
```

Após adicionar os scripts da PER-10 ao `package.json`:

```bash
npm run verify:persistence
npm run evidence:persistence
```

---

## 10. Documentação complementar

- `REPRODUCTION.md` — reconstrução do ambiente;
- `TRACEABILITY.md` — requisito → implementação → teste;
- `EVIDENCE.md` — evidências da Sprint;
- `SPRINT-DEMO.md` — roteiro de demonstração;
- `evidence/README.md` — padrão para armazenar as evidências geradas.

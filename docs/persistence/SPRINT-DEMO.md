# Roteiro de Demonstração — Sprint de Persistência

## Tempo estimado

8 a 12 minutos.

---

## 1. Contexto — aproximadamente 1 minuto

Explicar que o Corporate Chat utiliza persistência poliglota.

### PostgreSQL

- identidade;
- cadastro;
- autenticação;
- solicitações de cadastro.

### MongoDB

- conversas;
- participantes;
- mensagens;
- histórico;
- entrega e leitura.

A integração ocorre por UUID lógico validado no backend.

---

## 2. Estrutura do projeto — aproximadamente 1 minuto

Mostrar:

```text
backend/database
backend/src/models
backend/src/services
backend/database/tests
backend/scripts
docs/persistence
```

Explicar migrations, seeders, models, services, testes, scripts de reprodução e documentação.

---

## 3. Containers — aproximadamente 30 segundos

```bash
docker compose --env-file backend/.env ps
```

Mostrar PostgreSQL e MongoDB disponíveis/saudáveis.

---

## 4. Migrations — aproximadamente 1 minuto

Na pasta `backend`:

```bash
npm run db:migrate:status
```

Mostrar as migrations como executadas e explicar que a estrutura é versionada.

---

## 5. Massa reproduzível — aproximadamente 1 minuto

```bash
npm run seed:verify
```

Explicar UUIDs previsíveis e coerência entre PostgreSQL e MongoDB.

---

## 6. Integração lógica — aproximadamente 1 minuto

```bash
npm run integration:verify
```

Explicar:

```text
PostgreSQL
users.user_id
      │
      ▼
MongoDB
created_by / user_id / removed_by / sender_id
```

---

## 7. Consultas críticas — aproximadamente 1 minuto

```bash
npm run queries:verify
```

Destacar usuário por e-mail, solicitações pendentes, conversas, últimas mensagens, mensagens não lidas e paginação.

---

## 8. Testes automatizados — aproximadamente 2 minutos

```bash
npm test
```

Mostrar as suítes `integrity`, `integration` e `queries` e o critério `fail 0`.

Exemplos de cenários negativos para explicar:

- e-mail duplicado;
- mensagem vazia;
- mensagem acima de 1.000 caracteres;
- usuário fora da conversa;
- usuário INACTIVE;
- reenvio com `client_message_id` duplicado.

---

## 9. Reprodutibilidade — aproximadamente 1 minuto

Explicar:

```bash
npm run env:fresh -- --confirm
```

Não é necessário apagar os bancos ao vivo durante a apresentação se o tempo for curto. Pode-se mostrar a evidência previamente gerada.

---

## 10. Evidência automatizada

```bash
npm run evidence:persistence
```

Arquivo:

```text
docs/persistence/evidence/latest.md
```

Destacar branch, commit, versões, containers, migrations, seeds, integração, queries, testes e exit codes.

---

## 11. Encerramento

```text
PER-01 → ambiente
PER-02 → PostgreSQL
PER-03 → MongoDB
PER-04 → constraints e índices
PER-05 → reprodução
PER-06 → seeds
PER-07 → testes de integridade
PER-08 → integração PostgreSQL ↔ MongoDB
PER-09 → consultas críticas
PER-10 → documentação e evidências
```

> A Sprint de Persistência não entrega apenas os bancos criados. Ela entrega uma estrutura versionada, reproduzível, testável e rastreável aos requisitos e ao modelo de dados do projeto.

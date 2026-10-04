# Evidências Técnicas — Sprint de Persistência

## Objetivo

Consolidar evidências reproduzíveis da implementação das PER-01 até PER-10.

As evidências devem estar associadas a uma versão do código, preferencialmente por branch e commit.

---

## E01 — Containers

A partir da raiz do projeto:

```bash
docker compose --env-file backend/.env ps
```

Critério esperado:

```text
PostgreSQL   healthy
MongoDB      healthy
```

---

## E02 — Migrations

Na pasta `backend`:

```bash
npm run db:migrate:status
```

Todas as migrations da versão atual devem aparecer como executadas (`up`).

---

## E03 — Massa de desenvolvimento

```bash
npm run seed:verify
```

Critério:

```text
Development seed: VALID
```

---

## E04 — Integração PostgreSQL ↔ MongoDB

```bash
npm run integration:verify
```

Critério:

```text
PostgreSQL <-> MongoDB integrity: VALID
```

---

## E05 — Consultas críticas

```bash
npm run queries:verify
```

Critério:

```text
Critical persistence queries: VALID
```

---

## E06 — Testes automatizados

```bash
npm test
```

Critério principal:

```text
fail 0
```

A suíte deve contemplar integridade PostgreSQL, integridade MongoDB, integração entre bancos e consultas críticas.

---

## E07 — Reconstrução completa

```bash
npm run env:fresh -- --confirm
```

Critério:

```text
Environment rebuilt successfully
```

A reconstrução deverá ocorrer sem criação manual de tabelas, collections, índices ou massa DEV em ferramentas gráficas.

---

## E08 — Reprodutibilidade em outra máquina

Outro integrante deverá:

1. clonar o repositório;
2. executar `npm install`;
3. criar e configurar `.env`;
4. executar `npm run env:fresh -- --confirm`;
5. executar `npm run verify:persistence`.

Registrar integrante, data, branch, commit, resultado e observações.

---

## Evidências visuais recomendadas

Armazenar em:

```text
docs/persistence/evidence/screenshots/
```

Sugestão:

```text
01-docker-healthy.png
02-migrations-up.png
03-seed-valid.png
04-cross-database-valid.png
05-critical-queries-valid.png
06-tests-fail-zero.png
07-env-fresh-success.png
```

O arquivo textual automatizado `docs/persistence/evidence/latest.md` deve ser considerado a principal evidência técnica, pois registra comandos, saídas e códigos de retorno.

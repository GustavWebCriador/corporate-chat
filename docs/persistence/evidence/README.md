# Evidências da Persistência

Esta pasta armazena as evidências geradas para a Sprint de Persistência.

## Arquivo automatizado

O comando:

```bash
cd backend
npm run evidence:persistence
```

gera/atualiza:

```text
docs/persistence/evidence/latest.md
```

Esse arquivo deverá registrar:

- data/hora da geração;
- branch;
- commit;
- versões das ferramentas;
- containers;
- status das migrations;
- validação da massa DEV;
- integridade PostgreSQL ↔ MongoDB;
- consultas críticas;
- testes automatizados;
- códigos de retorno.

## Screenshots opcionais

Podem ser armazenados em:

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

> Não incluir senhas, tokens, `.env` ou outras credenciais nas evidências.

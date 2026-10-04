# Reprodução do Ambiente de Persistência

## Objetivo

Este documento descreve como um integrante da equipe pode reconstruir e validar o ambiente de persistência do Corporate Chat a partir do repositório.

## Pré-requisitos

- Git
- Node.js
- npm
- Docker Desktop
- Docker Compose

DBeaver, pgAdmin e MongoDB Compass são opcionais e não devem ser necessários para criar manualmente estruturas do projeto.

---

## 1. Primeira instalação

```bash
git clone https://github.com/GustavWebCriador/corporate-chat.git
cd corporate-chat/backend
npm install
```

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### Linux/macOS

```bash
cp .env.example .env
```

Configure o `.env` e não o versione.

---

## 2. Construção completa

```bash
npm run env:fresh -- --confirm
```

Esse comando remove os volumes locais antes de reconstruir o ambiente.

Fluxo esperado:

1. remover containers e volumes locais;
2. subir PostgreSQL e MongoDB;
3. aguardar disponibilidade;
4. aplicar migrations PostgreSQL;
5. aplicar seeders;
6. sincronizar índices MongoDB;
7. gerar massa DEV;
8. validar bancos;
9. validar consultas críticas;
10. executar testes automatizados;
11. exibir status das migrations.

---

## 3. Atualização diária

```bash
git pull
cd backend
npm install
npm run env:sync
```

`env:sync` não deve remover os volumes locais.

---

## 4. Validações individuais

```bash
npm run db:migrate:status
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

---

## 5. Resultado esperado

```text
PostgreSQL                 ✅
MongoDB                    ✅
Migrations                 ✅
Seeders                    ✅
MongoDB indexes            ✅
DEV fixtures               ✅
Cross-database integrity   ✅
Critical queries           ✅
Automated tests            ✅
```

---

## 6. Fluxo recomendado para outro integrante

```text
git clone
   │
   ▼
npm install
   │
   ▼
criar .env
   │
   ▼
npm run env:fresh -- --confirm
   │
   ▼
npm run verify:persistence
   │
   ▼
ambiente validado
```

# Corporate Chat

Sistema de comunicação corporativa desenvolvido com o objetivo de disponibilizar um ambiente seguro, organizado e evolutivo para troca de mensagens entre colaboradores.

O projeto utiliza uma arquitetura de persistência híbrida:

- **PostgreSQL** para dados estruturados, identidade, autenticação e informações cadastrais;
- **MongoDB** para conversas, participantes, mensagens e histórico;
- **Node.js + Express** no backend;
- **React** no frontend;
- **Socket.IO** para comunicação em tempo real;
- **Docker + Docker Compose** para padronização do ambiente de desenvolvimento.

```markdown
> **Status da persistência:** infraestrutura de persistência implementada com PostgreSQL e MongoDB, migrations, seeders, constraints, índices, ambiente reproduzível, massa DEV idempotente, testes automatizados de integridade, integração lógica entre bancos, consultas críticas, rastreabilidade e evidências técnicas.
```
---

## Tecnologias utilizadas

### Backend

- Node.js
- Express
- Sequelize
- Sequelize CLI
- PostgreSQL 16
- MongoDB 8
- Mongoose
- `pg`
- `pg-hstore`
- CORS
- dotenv
- Nodemon

### Frontend

- React

### Comunicação em tempo real

- Socket.IO

### Infraestrutura

- Docker
- Docker Compose

---

# Arquitetura de persistência

O Corporate Chat utiliza dois bancos de dados, cada um responsável por um tipo de informação.

```text
Corporate Chat
│
├── PostgreSQL
│   ├── usuários
│   ├── solicitações de cadastro
│   ├── autenticação
│   ├── dados estruturados
│   ├── migrations
│   └── seeders
│
└── MongoDB
    ├── conversations
    ├── conversation_members
    ├── messages
    ├── índices
    └── seeds de desenvolvimento
```

Essa separação permite utilizar um banco relacional para informações que exigem maior integridade estrutural e um banco orientado a documentos para o domínio de conversas e mensagens.

---

# Pré-requisitos

Antes de executar o projeto, instale:

- Git
- Node.js
- npm
- Docker Desktop

Ferramentas opcionais para inspeção dos bancos:

- DBeaver
- pgAdmin
- MongoDB Compass

> **Importante:** DBeaver, pgAdmin e MongoDB Compass **não são necessários para criar a estrutura do ambiente**.
> Migrations, seeders e índices devem ser criados automaticamente pelos scripts do projeto.

---

# Estrutura do projeto

A estrutura pode evoluir conforme novas funcionalidades forem implementadas, mas a organização principal de persistência é:

```text
corporate-chat/
│
├── backend/
│   │
│   ├── database/
│   │   ├── mongodb/
│   │   │   ├── seeds/
│   │   │   ├── health-test.js
│   │   │   ├── smoke-test.js
│   │   │   └── sync-indexes.js
│   │   │
│   │   └── postgres/
│   │       ├── migrations/
│   │       ├── seeders/
│   │       └── health-test.js
│   │
│   ├── scripts/
│   │   ├── sync-dev.js
│   │   └── fresh-dev.js
│   │
│   ├── src/
│   │   ├── config/
│   │   │   └── db/
│   │   │       ├── mongodb.js
│   │   │       └── postgres.js
│   │   ├── controllers/
│   │   ├── models/
│   │   │   ├── mongodb/
│   │   │   └── postgres/
│   │   ├── routes/
│   │   ├── services/
│   │   └── server.js
│   │
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

# Instalação

## 1. Clonar o repositório

```bash
git clone https://github.com/GustavWebCriador/corporate-chat.git
cd corporate-chat
```

## 2. Instalar as dependências do backend

```bash
cd backend
npm install
```

---

# Configuração das variáveis de ambiente

O projeto utiliza o arquivo:

```text
backend/.env
```

Copie o arquivo de exemplo:

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### Linux/macOS

```bash
cp .env.example .env
```

Depois, configure os valores necessários.

Exemplo:

```env
NODE_ENV=development
PORT=3000

POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5433
POSTGRES_USER=<seu_usuario_postgres>
POSTGRES_PASSWORD=<sua_senha_postgres>
POSTGRES_DB=<seu_banco_postgres>

MONGO_HOST=127.0.0.1
MONGO_PORT=27017
MONGO_USER=<seu_usuario_mongodb>
MONGO_PASSWORD=<sua_senha_mongodb>
MONGO_DB=<seu_banco_mongodb>

JWT_SECRET=<sua_chave_secreta>
```

> Nunca envie o arquivo `.env` para o repositório.

O `.gitignore` deve conter, no mínimo:

```gitignore
.env
node_modules/
```

---

# Docker

Os bancos PostgreSQL e MongoDB são executados por meio do Docker Compose.

Serviços utilizados:

```text
PostgreSQL 16
MongoDB 8
```

Para validar a configuração:

```bash
docker compose config
```

Para visualizar os containers:

```bash
docker compose ps
```

---

# Sincronização do ambiente de desenvolvimento

Depois de realizar um `git pull`, execute:

```bash
cd backend
npm install
npm run env:sync
```

O comando `env:sync` é o fluxo padrão para atualizar um ambiente de desenvolvimento já existente.

Ele deve executar automaticamente:

1. Inicialização dos containers Docker;
2. Aguardo do PostgreSQL e MongoDB ficarem saudáveis;
3. Execução das migrations pendentes do PostgreSQL;
4. Execução dos seeders de desenvolvimento necessários;
5. Sincronização dos índices do MongoDB;
6. Validação das conexões com PostgreSQL e MongoDB;
7. Exibição do status das migrations.

```text
git pull
   │
   ▼
npm install
   │
   ▼
npm run env:sync
   │
   ├── Docker Compose
   ├── PostgreSQL
   ├── MongoDB
   ├── Migrations
   ├── Seeders
   ├── Índices MongoDB
   ├── Health checks
   └── Status das migrations
```

## Característica do `env:sync`

O comando é **não destrutivo**.

Ele deve sincronizar o ambiente sem remover os volumes locais e sem apagar dados já existentes.

---

# Reconstrução completa do ambiente

Para recriar os bancos locais do zero:

```bash
cd backend
npm run env:fresh -- --confirm
```

O `env:fresh` deve:

1. Validar a confirmação explícita `--confirm`;
2. Remover os containers do ambiente;
3. Remover os volumes locais do PostgreSQL e MongoDB;
4. Subir novamente os serviços;
5. Aguardar os bancos ficarem disponíveis;
6. Executar todas as migrations do PostgreSQL;
7. Executar os seeders de desenvolvimento;
8. Criar/sincronizar os índices do MongoDB;
9. Executar os seeds do MongoDB;
10. Validar o funcionamento dos dois bancos;
11. Exibir o status final das migrations.

> [!WARNING]
> `npm run env:fresh -- --confirm` remove os dados locais do PostgreSQL e MongoDB.
> Utilize somente quando realmente desejar reconstruir o ambiente do zero.

O parâmetro `--confirm` existe como proteção contra exclusões acidentais.

---

# Ambiente de desenvolvimento reproduzível

O ambiente de persistência foi estruturado para que qualquer integrante da equipe consiga reproduzir a mesma estrutura de banco sem criação manual.

Os principais pontos da entrega são:

- migrations versionadas no PostgreSQL;
- controle de migrations pelo `SequelizeMeta`;
- seeders de desenvolvimento;
- controle de seeders pelo `SequelizeData`;
- schemas e índices do MongoDB reproduzíveis;
- seeds do MongoDB;
- testes de saúde dos dois bancos;
- smoke tests;
- script de sincronização sem perda de dados;
- script de reconstrução completa com confirmação;
- documentação do fluxo no README.

## Scripts de persistência e automação

A configuração do `package.json` deve disponibilizar scripts equivalentes a:

```text
db:migrate
db:migrate:status
db:migrate:undo

db:seed
db:seed:undo

postgres:test

mongo:indexes
mongo:seed
mongo:health
mongo:test

env:sync
env:fresh

seed:dev
verify:dev-seed

test:integrity
test
```

Para verificar os scripts disponíveis na versão atual:

```bash
npm run
```

---

# PostgreSQL

O PostgreSQL utiliza **Sequelize + Sequelize CLI** para controle da estrutura.

## Executar migrations

```bash
npm run db:migrate
```

## Verificar status das migrations

```bash
npm run db:migrate:status
```

O resultado permite identificar migrations:

```text
up
down
```

- `up`: migration já executada;
- `down`: migration ainda pendente.

## Executar seeders

```bash
npm run db:seed
```

> As migrations devem ser executadas antes dos seeders.

Fluxo correto:

```text
db:migrate:status
        │
        ▼
db:migrate
        │
        ▼
db:seed
```

## Tabelas de controle do Sequelize

O Sequelize utiliza tabelas internas para registrar o que já foi executado.

### Migrations

```text
SequelizeMeta
```

### Seeders

```text
SequelizeData
```

Essas tabelas permitem que os scripts sejam executados repetidamente sem reaplicar operações já registradas.

---

# Schema PostgreSQL (PER-02)

O PostgreSQL implementa o domínio de identidade do **DER PostgreSQL v1.3**. `users` é a fonte oficial da identidade, e as referências de usuário no MongoDB usam o `user_id` (UUID) do PostgreSQL.

## Tabela `users`

| Coluna | Tipo | Regras |
|---|---|---|
| `user_id` | UUID | PK, `gen_random_uuid()` |
| `name` | VARCHAR(150) | obrigatório |
| `email` | VARCHAR(150) | obrigatório, **UNIQUE** |
| `password_hash` | VARCHAR(255) | obrigatório (nunca senha em texto puro) |
| `status` | VARCHAR(20) | `ACTIVE` (padrão) ou `INACTIVE` (CHECK) |
| `is_admin` | BOOLEAN | padrão `false` |
| `created_at` / `updated_at` | TIMESTAMPTZ | padrão `CURRENT_TIMESTAMP` |
| `last_login_at` | TIMESTAMPTZ | opcional |

## Tabela `registration_requests`

| Coluna | Tipo | Regras |
|---|---|---|
| `request_id` | UUID | PK, `gen_random_uuid()` |
| `name` | VARCHAR(150) | obrigatório |
| `email` | VARCHAR(150) | obrigatório |
| `status` | VARCHAR(20) | `PENDING` (padrão), `APPROVED` ou `REJECTED` (CHECK) |
| `requested_at` | TIMESTAMPTZ | padrão `CURRENT_TIMESTAMP` |
| `reviewed_at` | TIMESTAMPTZ | opcional |
| `reviewed_by` | UUID | FK → `users.user_id` (`ON DELETE RESTRICT`) |
| `rejection_reason` | VARCHAR(500) | obrigatório quando `REJECTED` |
| `created_user_id` | UUID | FK → `users.user_id` (`ON DELETE RESTRICT`) |

Constraints de coerência: `APPROVED` exige `reviewed_by` e `reviewed_at`; `REJECTED` exige também `rejection_reason` não vazio.

## Models e associações Sequelize

- `User` e `RegistrationRequest` em `backend/src/models/postgres/`.
- `RegistrationRequest.belongsTo(User, { as: "reviewer", foreignKey: "reviewed_by" })`.
- `RegistrationRequest.belongsTo(User, { as: "createdUser", foreignKey: "created_user_id" })`.

## Fluxo de trabalho em equipe

- Quem criar coluna, constraint ou tabela cria uma **migration**, envia no Pull Request e os demais executam `npm run db:migrate`.
- Se todos precisarem dos mesmos usuários fictícios de desenvolvimento, cria-se um **seeder** versionado e os demais executam `npm run db:seed`.
- Um usuário cadastrado apenas para teste local **não** aparece automaticamente no banco dos demais.
- **Não edite migrations já enviadas ao repositório**: crie uma nova migration.

## Rollback

```bash
cd backend
npm run db:migrate:status   # ver o que está up/down
npm run db:migrate:undo     # desfaz a última migration
npm run db:migrate          # reaplica
```

Para desfazer seeders: `npm run db:seed:undo`.

---

# Estruturas PostgreSQL já cobertas pelo ambiente

A reprodução do ambiente deve gerar as estruturas previstas pelas migrations do projeto, incluindo, conforme a versão atual:

```text
users
registration_requests
constraints
indexes
seed users
migrations
```

Nenhuma dessas estruturas deve depender de criação manual via DBeaver ou pgAdmin.

---

# MongoDB

O MongoDB armazena o domínio de conversas e mensagens.

Estruturas principais:

```text
conversations
conversation_members
messages
```

## Sincronizar índices

```bash
npm run mongo:indexes
```

## Executar seed de desenvolvimento

```bash
npm run mongo:seed
```

## Validar saúde do MongoDB

```bash
npm run mongo:health
```

## Executar smoke test

```bash
npm run mongo:test
```

A reprodução correta deve garantir:

```text
conversations
conversation_members
messages
indexes
seed
```

---

# Testes de saúde

O projeto possui validações para garantir que os dois bancos estejam acessíveis antes da continuidade do fluxo.

## PostgreSQL

```bash
npm run postgres:test
```

## MongoDB

```bash
npm run mongo:health
```

ou:

```bash
npm run mongo:test
```

Esses testes ajudam a identificar falhas de:

- conexão;
- credenciais;
- porta;
- disponibilidade do container;
- banco inexistente;
- configuração incorreta do ambiente.

---

# Executando o backend

Com o ambiente sincronizado:

```bash
npm run dev
```

Quando as conexões estiverem corretas, o backend deverá apresentar mensagens equivalentes a:

```text
[DATABASE] Connecting...
[POSTGRES] Connection established successfully.
[MONGODB] Connection established successfully.
[DATABASE] Persistence environment ready.
[SERVER] Listening on port 3000
```

---

# Testando a API

Com o backend em execução:

```text
http://localhost:3000
```

Retorno esperado:

```json
{
  "application": "Corporate Chat API",
  "status": "running"
}
```

---

# Validação do ambiente reproduzível

A validação do ambiente reproduzível deve ser realizada preferencialmente em uma máquina que ainda não possua o ambiente configurado pelo responsável pela implementação.

## 1. Clonar o projeto

```bash
git clone https://github.com/GustavWebCriador/corporate-chat.git
cd corporate-chat
cd backend
```

## 2. Instalar dependências

```bash
npm install
```

## 3. Criar o `.env`

Copie:

```text
.env.example
```

para:

```text
.env
```

Configure as variáveis necessárias.

## 4. Reconstruir o ambiente

```bash
npm run env:fresh -- --confirm
```

Durante esse teste, **não utilizar DBeaver, pgAdmin ou MongoDB Compass para criar tabelas, collections, índices ou dados manualmente**.

O objetivo é comprovar que o repositório é suficiente para reproduzir todo o ambiente.

## Resultado esperado

### PostgreSQL

```text
users                     ✅
registration_requests     ✅
constraints               ✅
indexes                   ✅
seed users                ✅
migrations                ✅
```

### MongoDB

```text
conversations             ✅
conversation_members      ✅
messages                  ✅
indexes                   ✅
seed                      ✅
```

Se a execução for concluída dessa forma, o projeto possui um:

# Ambiente de desenvolvimento reproduzível

---

# Fluxo recomendado para a equipe

## Primeira instalação

```bash
git clone https://github.com/GustavWebCriador/corporate-chat.git
cd corporate-chat/backend
npm install
```

Criar e configurar:

```text
.env
```

Depois:

```bash
npm run env:fresh -- --confirm
npm run dev
```

## Atualização diária

Depois de receber alterações do repositório:

```bash
git pull
cd backend
npm install
npm run env:sync
npm run dev
```

---

# Comandos úteis

## Ver containers

```bash
docker compose ps
```

## Logs de todos os serviços

Na raiz do projeto:

```bash
docker compose logs
```

## Logs do PostgreSQL

```bash
docker compose logs postgres
```

## Logs do MongoDB

```bash
docker compose logs mongodb
```

## Acompanhar logs

```bash
docker compose logs -f
```

## Parar os containers preservando dados

```bash
docker compose down
```

## Remover containers e volumes manualmente

```bash
docker compose down -v
```

> Esse comando apaga os dados locais armazenados nos volumes.

Para a reconstrução controlada do ambiente, prefira:

```bash
npm run env:fresh -- --confirm
```

---

# Acesso manual ao PostgreSQL

Para inspeção técnica:

```bash
docker exec -it corporate_chat_postgres_container psql -U <usuario> -d <banco>
```

Dentro do PostgreSQL:

```sql
SELECT current_database();
```

No `psql`, alguns comandos úteis:

```text
\dt
\d users
```

Para verificar migrations executadas:

```sql
SELECT * FROM "SequelizeMeta";
```

Para sair:

```text
\q
```

---

# PostgreSQL no DBeaver

Uso opcional para inspeção:

```text
Host: 127.0.0.1
Porta: 5433
Banco: <POSTGRES_DB>
Usuário: <POSTGRES_USER>
Senha: <POSTGRES_PASSWORD>
```

A porta pode ser alterada no `docker-compose.yml` caso exista outro PostgreSQL utilizando a mesma porta na máquina.

---

# Acesso manual ao MongoDB

Para inspeção técnica pelo container:

```bash
docker exec -it corporate_chat_mongodb_container mongosh \
  -u <usuario> \
  -p <senha> \
  --authenticationDatabase admin
```

Teste:

```javascript
db.runCommand({ ping: 1 })
```

Retorno esperado:

```javascript
{ ok: 1 }
```

---

# Problemas comuns

## Docker Desktop não está em execução

Verifique se o Docker Desktop foi iniciado antes de executar:

```bash
npm run env:sync
```

ou:

```bash
npm run env:fresh -- --confirm
```

---

## PostgreSQL — `ECONNREFUSED`

Exemplo:

```text
connect ECONNREFUSED 127.0.0.1:5433
```

Verifique:

- se o container está ativo;
- se o healthcheck terminou;
- se a porta no `.env` corresponde à porta publicada pelo Docker;
- se outro PostgreSQL já está utilizando a porta.

```bash
docker compose ps
```

No Windows:

```powershell
Get-NetTCPConnection -LocalPort 5433 -State Listen
```

---

## PostgreSQL — `28P01`

Exemplo:

```text
password authentication failed
```

Verifique se:

```text
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
```

correspondem às configurações utilizadas pelo Docker.

---

## Seeder retorna `relation "users" does not exist`

Isso indica que os seeders foram executados antes da migration responsável pela criação da tabela.

Execute:

```bash
npm run db:migrate:status
npm run db:migrate
npm run db:seed
```

No fluxo normal do projeto, `env:sync` e `env:fresh` devem garantir essa ordem automaticamente.

---

## MongoDB — `Authentication failed`

Confira:

```text
MONGO_USER
MONGO_PASSWORD
MONGO_DB
```

A autenticação administrativa criada pelo Docker normalmente utiliza:

```text
authSource=admin
```

---

## MongoDB — erro relacionado a `authSource`

Confira a URI de conexão e certifique-se de que o parâmetro esteja corretamente formatado:

```text
?authSource=admin
```

---

## Índices duplicados no MongoDB

Caso um índice antigo tenha sido criado com configuração diferente da versão atual, inspecione os índices existentes antes de alterar dados manualmente.

O fluxo normal deve utilizar:

```bash
npm run mongo:indexes
```

para manter os índices definidos pelo projeto sincronizados.

---

# Boas práticas do projeto

- Não criar tabelas manualmente no PostgreSQL;
- Não criar collections ou índices manualmente como requisito para o sistema funcionar;
- Toda alteração estrutural do PostgreSQL deve possuir migration;
- Dados iniciais de desenvolvimento devem utilizar seeders;
- Alterações de índices do MongoDB devem ser versionadas no código;
- Não versionar `.env`;
- Não versionar credenciais reais;
- Executar `npm install` após alterações de dependências;
- Executar `npm run env:sync` após atualizar a branch;
- Utilizar `env:fresh` somente quando uma reconstrução completa for necessária.

---

# Critério de ambiente reproduzível

Um ambiente pode ser considerado reproduzível quando um integrante da equipe consegue:

```text
1. clonar o repositório
2. instalar as dependências
3. configurar o .env
4. executar um único fluxo automatizado
5. obter PostgreSQL e MongoDB completamente estruturados
6. iniciar a aplicação
```

sem precisar:

```text
- criar banco manualmente no DBeaver;
- criar tabelas manualmente no pgAdmin;
- criar collections ou índices pelo MongoDB Compass;
- executar SQL manual para preparar a aplicação;
- copiar estruturas de banco de outra máquina.
```

Esse ambiente reproduzível foi evoluído com massa de desenvolvimento integrada e testes automatizados de integridade.

---


# Massa de dados de desenvolvimento integrada

O projeto utiliza uma massa de dados de desenvolvimento previsível, integrada e reproduzível entre PostgreSQL e MongoDB.

O objetivo é permitir que qualquer integrante da equipe tenha dados coerentes para desenvolvimento e testes sem precisar cadastrar registros manualmente.

## Estrutura da massa de desenvolvimento

Os dados compartilhados entre os dois bancos utilizam identificadores determinísticos.

Arquivo de fixtures compartilhadas:

```text
backend/database/shared/dev-fixtures.js
```

Esse arquivo centraliza os identificadores utilizados pela massa de desenvolvimento, evitando divergências entre PostgreSQL e MongoDB.

Entre os principais pontos dessa estrutura estão:

- usuários de desenvolvimento no PostgreSQL;
- solicitações de cadastro no PostgreSQL;
- conversas privadas e em grupo no MongoDB;
- participantes das conversas;
- mensagens de desenvolvimento;
- UUIDs compartilhados entre os bancos;
- seed idempotente;
- verificação automática da massa criada.

## Massa de dados esperada

Após a execução completa do seed de desenvolvimento, o ambiente deve possuir:

### PostgreSQL

```text
4 usuários
3 solicitações de cadastro
```

### MongoDB

```text
2 conversas
6 participantes
5 mensagens
```

As mensagens incluem:

```text
2 mensagens de conversa privada
3 mensagens de conversa em grupo
```

A massa é criada apenas para ambiente de desenvolvimento.

---

## Seed integrado de desenvolvimento

Para criar ou atualizar a massa de desenvolvimento:

```bash
cd backend
npm run seed:dev
```

O script:

```text
backend/scripts/seed-dev.js
```

orquestra o processo de seed dos dois bancos.

Fluxo esperado:

```text
npm run seed:dev
        │
        ├── PostgreSQL
        │      └── Sequelize seeders
        │
        ├── MongoDB
        │      └── development seed
        │
        └── Verificação da massa
               └── verify-dev-seed.js
```

O processo inclui:

1. execução dos seeders do PostgreSQL;
2. conexão com o MongoDB;
3. criação/atualização dos documentos de desenvolvimento;
4. preservação da idempotência;
5. validação dos dados criados.

---

## Verificação da massa

Para validar a massa de desenvolvimento:

```bash
npm run seed:verify
```

O script responsável é:

```text
backend/scripts/verify-dev-seed.js
```

A verificação confirma se os registros esperados estão presentes nos dois bancos e se os identificadores compartilhados permanecem coerentes.

---

## Idempotência

Uma exigência central da massa de desenvolvimento é permitir múltiplas execuções do seed sem gerar dados duplicados.

O MongoDB utiliza operações equivalentes a `upsert`, evitando recriação desnecessária dos mesmos documentos.

O seed não deve depender de:

```text
deleteMany()
```

como estratégia normal para garantir consistência.

### Teste de idempotência

Execute três vezes:

```bash
npm run mongo:seed
npm run mongo:seed
npm run mongo:seed
```

O resultado deve permanecer estável:

```text
conversations             2
conversation_members      6
messages                  5
```

Não devem ocorrer erros:

```text
E11000 duplicate key
```

Esse comportamento garante que o seed possa ser executado repetidamente durante o desenvolvimento.

---

## Integração lógica PostgreSQL ↔ MongoDB

Os documentos do MongoDB que representam usuários utilizam os mesmos UUIDs existentes no PostgreSQL.

Exemplo conceitual:

```text
PostgreSQL
users.id (UUID)
     │
     └───────────────┐
                     ▼
MongoDB
conversation_members.user_id
messages.sender_id
```

Não existe foreign key física entre PostgreSQL e MongoDB.

A integridade entre os bancos é mantida pela aplicação, pelas fixtures compartilhadas, pelos seeds e pelos testes automatizados.

---

## Proteção de ambiente

Os seeds de desenvolvimento devem ser executados apenas quando:

```env
NODE_ENV=development
```

A massa de desenvolvimento não deve ser carregada automaticamente em produção.

---

# Testes automatizados de integridade da persistência

O projeto possui uma suíte automatizada destinada a validar as regras de integridade implementadas no PostgreSQL e MongoDB.

Os testes utilizam o módulo nativo:

```text
node:test
```

e foram organizados para validar tanto cenários positivos quanto cenários negativos.

Estrutura prevista:

```text
backend/database/tests/integrity/
├── postgres-integrity.test.js
└── mongodb-integrity.test.js
```

O orquestrador da suíte é:

```text
backend/scripts/test-integrity.js
```

---

## Executando os testes

Antes dos testes, sincronize o ambiente:

```bash
cd backend
npm run env:sync
```

Depois execute:

```bash
npm run test:integrity
```

ou:

```bash
npm test
```

O script `npm test` utiliza a suíte de integridade como teste principal da persistência nesta etapa do projeto.

---

## O que os testes validam

### PostgreSQL

Os testes verificam, entre outros:

- constraints;
- unicidade de e-mail;
- foreign keys;
- estados válidos de usuários;
- estados válidos de solicitações de cadastro;
- regras condicionais para `APPROVED`;
- regras condicionais para `REJECTED`;
- consistência dos relacionamentos;
- comportamento esperado das migrations e estruturas criadas.

### MongoDB

Os testes verificam:

- schemas Mongoose;
- validações dos documentos;
- unicidade de conversas privadas;
- unicidade de participantes;
- idempotência de mensagens;
- limite de 1.000 caracteres;
- consistência de identificadores;
- índices definidos para as collections.

### Integração lógica

A suíte também valida regras relacionadas à integração:

```text
PostgreSQL ↔ MongoDB
```

principalmente nos campos utilizados para representar usuários no domínio de conversas e mensagens.

---

## Isolamento dos testes

Os testes PostgreSQL utilizam transações e rollback quando aplicável.

Fluxo conceitual:

```text
BEGIN
  │
  ├── cria dados do teste
  ├── executa validações
  └── verifica resultado
  │
ROLLBACK
```

Isso evita contaminar a massa padrão de desenvolvimento.

No MongoDB, os documentos utilizados pelos testes são identificados especificamente para a suíte e removidos de forma controlada quando necessário.

O objetivo é garantir:

```text
teste executado
      │
      ▼
resultado validado
      │
      ▼
ambiente preservado
```

---

## Cenários positivos e negativos

A suíte de testes não valida apenas operações válidas.

Também são executados cenários que **devem falhar** quando uma regra de integridade é violada.

Exemplos:

```text
e-mail duplicado                     → deve falhar
foreign key inválida                 → deve falhar
status não permitido                 → deve falhar
APPROVED sem dados obrigatórios      → deve falhar
REJECTED sem motivo obrigatório      → deve falhar
participante duplicado               → deve falhar
mensagem acima do limite             → deve falhar
```

Isso comprova que as regras do modelo de dados não existem apenas na documentação, mas estão efetivamente protegidas no banco e na aplicação.

---

## Fluxo de validação da persistência

O fluxo recomendado de validação da persistência é:

```text
git pull
   │
   ▼
npm install
   │
   ▼
npm run env:sync
   │
   ├── containers
   ├── migrations
   ├── seeders
   ├── índices
   └── health checks
   │
   ▼
npm run seed:dev
   │
   ├── massa PostgreSQL
   ├── massa MongoDB
   └── verificação
   │
   ▼
npm run test:integrity
   │
   ├── PostgreSQL
   ├── MongoDB
   └── integração lógica
   │
   ▼
ambiente validado
```

---

## Critérios de validação da persistência

A camada de persistência pode ser considerada validada nesta etapa quando:

```text
Ambiente
✅ ambiente reproduzível
✅ migrations automatizadas
✅ seeders automatizados
✅ índices sincronizados
✅ env:sync
✅ env:fresh

Massa de desenvolvimento
✅ fixtures compartilhadas
✅ seed integrado PostgreSQL + MongoDB
✅ IDs determinísticos
✅ seed idempotente
✅ verificação da massa
✅ dados coerentes entre os bancos

Testes
✅ testes PostgreSQL
✅ testes MongoDB
✅ testes positivos
✅ testes negativos
✅ isolamento da suíte
✅ validação de integridade entre os bancos
```

---

# Status atual

O Corporate Chat possui uma base de persistência reproduzível, populável e testável automaticamente.

```text
Corporate Chat
│
├── Docker Compose
│   ├── PostgreSQL 16
│   └── MongoDB 8
│
├── PostgreSQL
│   ├── migrations
│   ├── seeders
│   ├── constraints
│   ├── indexes
│   ├── health test
│   └── integrity tests
│
├── MongoDB
│   ├── schemas
│   ├── indexes
│   ├── development seed
│   ├── health test
│   ├── smoke test
│   └── integrity tests
│
├── Massa de desenvolvimento
│   ├── shared fixtures
│   ├── UUIDs determinísticos
│   ├── seed integrado
│   ├── idempotência
│   └── verificação automática
│
└── Automação
    ├── env:sync
    ├── env:fresh
    ├── seed:dev
    ├── verify:dev-seed
    └── test:integrity
```

A camada de persistência deixa de depender apenas da criação automática da estrutura e passa também a possuir dados previsíveis e testes capazes de comprovar as principais regras de integridade.

---

# Credenciais de desenvolvimento

As credenciais de acesso aos bancos e demais serviços não devem ser versionadas.

Utilize:

```text
backend/.env.example
```

como referência para criar:

```text
backend/.env
```

Caso sejam necessárias credenciais específicas do ambiente da equipe, solicite-as ao responsável pelo ambiente de persistência e desenvolvimento.

---


# Comandos consolidados

Na pasta `backend`:

```bash
# Atualizar ambiente existente
npm run env:sync

# Reconstruir todo o ambiente local
npm run env:fresh -- --confirm

# Executar migrations PostgreSQL
npm run db:migrate

# Verificar migrations
npm run db:migrate:status

# Executar seeders PostgreSQL
npm run db:seed

# Sincronizar índices MongoDB
npm run mongo:indexes

# Executar seed MongoDB
npm run mongo:seed

# Criar/atualizar massa integrada de desenvolvimento
npm run seed:dev

# Validar a massa de desenvolvimento
npm run seed:verify

# Executar testes de integridade
npm run test:integrity

# Executar a suíte padrão de testes
npm test

# Iniciar API em desenvolvimento
npm run dev
```

```bash
cd backend
npm run env:sync
npm run env:fresh -- --confirm
npm run db:migrate:status
npm run seed:verify
npm run integration:verify
npm run queries:verify
npm test
npm run verify:persistence
npm run evidence:persistence
```


> Utilize `npm run` para conferir os scripts disponíveis na versão da branch em uso.

---

# Projeto acadêmico

O **Corporate Chat** é um projeto acadêmico desenvolvido para proporcionar uma solução de comunicação corporativa organizada, segura e preparada para evolução futura.

O projeto também tem como objetivo aplicar boas práticas de desenvolvimento de software, incluindo:

- versionamento;
- arquitetura;
- persistência híbrida;
- migrations;
- seeders;
- containers;
- automação do ambiente;
- documentação técnica;
- trabalho colaborativo.

---

## Repositório

https://github.com/GustavWebCriador/corporate-chat

````markdown
# Corporate Chat

Sistema de comunicação corporativa desenvolvido com o objetivo de disponibilizar um ambiente seguro e organizado para troca de mensagens entre colaboradores.

O projeto utiliza uma arquitetura com persistência híbrida:

- PostgreSQL para dados estruturados, como usuários e autenticação;
- MongoDB para armazenamento de mensagens e histórico de conversas;
- Node.js e Express no backend;
- React no frontend;
- Socket.IO para comunicação em tempo real.

---

## Tecnologias utilizadas

### Backend

- Node.js
- Express
- PostgreSQL
- MongoDB
- Mongoose
- node-postgres (`pg`)
- CORS
- dotenv
- Nodemon

### Frontend

- React

### Infraestrutura

- Docker
- Docker Compose

---

# Pré-requisitos

Antes de executar o projeto, certifique-se de possuir as seguintes ferramentas instaladas:

- Node.js
- npm
- Docker Desktop
- Git

Opcionalmente:

- DBeaver para administração do PostgreSQL;
- MongoDB Compass para administração do MongoDB.

---

## Estrutura básica do projeto

```text
corporate-chat/
│
├── backend/
│   │
│   ├── database/
│   │   ├── mongodb/
│   │   │   └── seeds/
│   │   │
│   │   └── postgres/
│   │       ├── migrations/
│   │       └── seeds/
│   │
│   ├── src/
│   │   ├── config/
│   │   │   └── db/
│   │   │       ├── mongodb.js
│   │   │       └── postgres.js
│   │   │
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
│
├── .gitignore
├── docker-compose.yml
└── README.md

Descrição das principais pastas
backend/ — responsável pela API, regras de negócio e acesso aos bancos.
backend/database/ — estrutura destinada às migrations e seeds.
backend/src/config/db/ — configuração das conexões com PostgreSQL e MongoDB.
backend/src/controllers/ — controladores da aplicação.
backend/src/models/ — modelos relacionados aos bancos de dados.
backend/src/routes/ — definição das rotas da API.
backend/src/services/ — serviços e regras de negócio.
backend/src/server.js — inicialização do servidor.
docker-compose.yml — configuração dos containers PostgreSQL e MongoDB.
README.md — documentação principal do projeto.

````
---

# Instalação

## 1. Clonar o repositório

Clone o projeto utilizando o Git:

```bash
git clone <URL_DO_REPOSITORIO>
```

Acesse a pasta:

```bash
cd corporate-chat
```

---

## 2. Instalar as dependências do backend

Entre na pasta do backend:

```bash
cd backend
```

Instale as dependências:

```bash
npm install
```

Após a instalação, retorne para a raiz do projeto:

```bash
cd ..
```

---

# Configuração das variáveis de ambiente

Na pasta:

```text
corporate-chat/backend/
```

crie um arquivo chamado:

```text
.env
```

Exemplo de configuração para ambiente de desenvolvimento:

```env
NODE_ENV=development

PORT=3000

POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5433
POSTGRES_USER=<seu_usuario_postgres>
POSTGRES_PASSWORD=<sua_senha_postgres>
POSTGRES_DB=

MONGO_HOST=127.0.0.1
MONGO_PORT=27017
MONGO_USER=<seu_usuario_mongodb>
MONGO_PASSWORD=<sua_senha_mongodb>
MONGO_DB=

JWT_SECRET=SUBSTITUA_POR_UMA_CHAVE_SECRETA_SEGURA
```

> **Importante:** o arquivo `.env` contém informações sensíveis e não deve ser enviado ao repositório Git.

Adicione ao `.gitignore`:

```gitignore
.env
node_modules/
```

Para projetos compartilhados entre desenvolvedores, recomenda-se disponibilizar um arquivo `.env.example` sem senhas reais.

---

# Configuração dos bancos de dados

Os bancos PostgreSQL e MongoDB são executados através do Docker Compose.

O arquivo `docker-compose.yml` deve estar localizado na raiz do projeto.

```
services:

  postgres:
    image: postgres:16
    container_name: corporate_chat_postgres_container
    restart: unless-stopped

    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}

    ports:
      - "5433:5432"

    volumes:
      - postgres_data:/var/lib/postgresql/data

    healthcheck:
      test:
      [
      "CMD-SHELL",
      "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
      ]
      interval: 5s
      timeout: 5s
      retries: 10

  mongodb:
    image: mongo:8
    container_name: corporate_chat_mongodb_container
    restart: unless-stopped

    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
      MONGO_INITDB_DATABASE: ${MONGO_DB}

    ports:
      - "27017:27017"

    volumes:
      - mongodb_data:/data/db

volumes:
  postgres_data:
  mongodb_data:

```

---

# Inicialização do ambiente

## 1. Iniciar o Docker Desktop

Antes de iniciar os bancos de dados, certifique-se de que o Docker Desktop esteja em execução.

---

## 2. Validar o Docker Compose

Na raiz do projeto execute:

```bash
docker compose config
```

Caso não sejam apresentados erros, prossiga para a inicialização.

---

## 3. Inicializar PostgreSQL e MongoDB

Execute:

```bash
docker compose up -d
```

O parâmetro `-d` inicia os containers em segundo plano.

---

## 4. Verificar os containers

Execute:

```bash
docker compose ps
```

O resultado deverá apresentar os dois containers em execução:

```text
corporate_chat_postgres_container
corporate_chat_mongodb_container
```

O PostgreSQL deverá apresentar o status:

```text
healthy
```

---

# Executando o backend

Acesse a pasta:

```bash
cd backend
```

Execute:

```bash
npm run dev
```

O Nodemon será iniciado.

Quando todas as conexões estiverem funcionando corretamente, o terminal deverá apresentar:

```text
[DATABASE] Connecting...
[POSTGRES] Connection established successfully.
[MONGODB] Connection established successfully.
[DATABASE] Persistence environment ready.
[SERVER] Listening on port 3000
```

---

# Testando a API

Com o servidor em execução, acesse:

```text
http://localhost:3000
```

A API deverá retornar:

```json
{
  "application": "Corporate Chat API",
  "status": "running"
}
```

Isso confirma que o backend está ativo.

---

# Testando o PostgreSQL

Para acessar diretamente o PostgreSQL através do container:

```bash
docker exec -it <nome_do_container_postgres> psql -U <seu_usuario_postgres> -d <seu_banco_postgres>
```

Após conectar, é possível verificar o banco atual:

```sql
SELECT current_database();
```

Para sair:

```text
\q
```

---

# PostgreSQL no DBeaver

Para conectar ao banco através do DBeaver, utilize:

```text
Host: 127.0.0.1
Porta: 5433
Banco: 
Usuário: <seu_usuario_postgres>
Senha: <sua_senha_postgres>
```

> A porta externa pode ser alterada no `docker-compose.yml` caso exista outro PostgreSQL instalado na máquina.

---

# Testando o MongoDB

Para acessar o MongoDB diretamente pelo container:

```bash
docker exec -it <nome_do_container_mongodb> mongosh -u <seu_usuario_mongodb> -p <sua_senha_mongodb> --authenticationDatabase admin
```

Após conectar:

```javascript
db.runCommand({ ping: 1 })
```

O retorno esperado é:

```javascript
{ ok: 1 }
```

Para sair:

```javascript
exit
```

---

# Parando os containers

Para parar os serviços:

```bash
docker compose down
```

Os dados armazenados nos volumes serão preservados.

Para iniciar novamente:

```bash
docker compose up -d
```

---

# Atenção ao uso de volumes

O comando:

```bash
docker compose down -v
```

remove também os volumes dos bancos de dados.

Isso significa que os dados armazenados no PostgreSQL e MongoDB serão apagados.

Utilize esse comando somente quando realmente desejar recriar os bancos do zero.

Durante o desenvolvimento normal, utilize:

```bash
docker compose down
```

---

# Logs dos containers

Para visualizar os logs de todos os serviços:

```bash
docker compose logs
```

PostgreSQL:

```bash
docker compose logs postgres
```

MongoDB:

```bash
docker compose logs mongodb
```

Para acompanhar os logs continuamente:

```bash
docker compose logs -f
```

---

# Problemas comuns

## PostgreSQL — `ECONNREFUSED`

Exemplo:

```text
connect ECONNREFUSED 127.0.0.1:5432
```

Verifique se:

* o container está em execução;
* a porta configurada no `.env` corresponde à porta publicada pelo Docker;
* não existe outro PostgreSQL utilizando a mesma porta.

Verifique:

```bash
docker compose ps
```

No Windows:

```powershell
Get-NetTCPConnection -LocalPort 5432 -State Listen
```

---

## PostgreSQL — erro `28P01`

Exemplo:

```text
password authentication failed
```

Verifique se usuário e senha do `.env` correspondem aos definidos no `docker-compose.yml`.

---

## MongoDB — `Authentication failed`

Confira:

```env
MONGO_USER=<seu_usuario_mongodb>
MONGO_PASSWORD=<sua_senha_mongodb>
```

A conexão utiliza:

```text
authSource=admin
```

porque o usuário administrativo é criado através das variáveis:

```text
MONGO_INITDB_ROOT_USERNAME
MONGO_INITDB_ROOT_PASSWORD
```

---

## MongoDB — `authsource is not supported`

Certifique-se de que a URI esteja formatada corretamente:

```text
?authSource=admin
```

Não utilize espaços entre `?` e `authSource`.

---

# Reinicialização do ambiente

Para reiniciar o ambiente mantendo os dados:

```bash
docker compose down
docker compose up -d
```

Depois:

```bash
cd backend
npm run dev
```

---

# Fluxo de inicialização

O ambiente deve seguir esta sequência:

```text
Docker Desktop
      │
      ▼
Docker Compose
      │
      ├── PostgreSQL
      │
      └── MongoDB
              │
              ▼
         Backend Node.js
              │
              ├── PostgreSQL
              ├── MongoDB
              └── API Express
```

---

# Status atual da infraestrutura

O ambiente de desenvolvimento está preparado para utilizar:

```text
Backend
└── Node.js + Express
      │
      ├── PostgreSQL
      │    └── Dados estruturados
      │
      └── MongoDB
           └── Mensagens e histórico
```

A próxima etapa do desenvolvimento consiste na implementação da estrutura de dados, autenticação, usuários, conversas, mensagens e comunicação em tempo real.

---

## Corporate Chat

Projeto acadêmico desenvolvido para proporcionar uma solução de comunicação corporativa organizada, segura e preparada para evolução futura.

## Credenciais de desenvolvimento

As credenciais de acesso aos bancos de dados e demais serviços do ambiente de desenvolvimento **não são versionadas no repositório**.

Para obter as credenciais necessárias para execução local do projeto, entre em contato com o responsável pelo ambiente de persistência e desenvolvimento:

**Gustavo Medeiros**

Utilize o arquivo `.env.example` como referência para configurar o seu arquivo `.env`.


```env
NODE_ENV=development
PORT=3000

POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5433
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=

MONGO_HOST=127.0.0.1
MONGO_PORT=27017
MONGO_USER=
MONGO_PASSWORD=
MONGO_DB=

JWT_SECRET=
````
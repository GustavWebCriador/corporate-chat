# Corporate Chat — Documentação da API

## 1. Visão geral

A API do Corporate Chat é responsável por disponibilizar os serviços de backend necessários ao funcionamento do sistema de comunicação corporativa.

Desenvolvida com **Node.js e Express**, a aplicação utiliza PostgreSQL para persistência dos dados relacionais e MongoDB para armazenamento das informações de comunicação.

A API adota uma arquitetura organizada em rotas, controllers, services, repositories e models, buscando separar responsabilidades, facilitar a manutenção e permitir a evolução incremental das funcionalidades.

## 2. Objetivo

Esta documentação tem como objetivos:

- Apresentar os recursos disponíveis na API.
- Descrever os mecanismos de autenticação e autorização.
- Estabelecer padrões para os contratos HTTP.
- Orientar a execução dos testes automatizados.
- Facilitar a integração entre backend e frontend.
- Servir como referência técnica para manutenção e desenvolvimento.

## 3. Tecnologias principais

| Tecnologia | Responsabilidade |
|---|---|
| Node.js | Ambiente de execução do backend |
| Express | Servidor HTTP e roteamento |
| PostgreSQL | Persistência de dados relacionais |
| Sequelize | Modelagem e acesso ao PostgreSQL |
| MongoDB | Persistência de mensagens e conversas |
| Mongoose | Modelagem e acesso ao MongoDB |
| JWT | Autenticação baseada em tokens |
| bcryptjs | Verificação de senhas protegidas por hash |
| Docker Compose | Infraestrutura de desenvolvimento |
| Node.js Test Runner | Execução de testes automatizados |

## 4. Organização da API

O código-fonte do backend encontra-se no diretório `backend/`.

A organização lógica inclui:

| Diretório | Responsabilidade |
|---|---|
| `src/routes/` | Definição dos endpoints |
| `src/controllers/` | Tratamento das requisições e respostas HTTP |
| `src/services/` | Regras de negócio |
| `src/repositories/` | Acesso à persistência |
| `src/models/` | Modelos de dados |
| `src/middlewares/` | Autenticação, autorização e tratamento de erros |
| `src/config/` | Configurações da aplicação |
| `tests/api/` | Testes automatizados da API |
| `database/tests/` | Testes de integridade e integração de persistência |

## 5. Versionamento de endpoints

Os endpoints HTTP são organizados sob o prefixo:

**`/api/v1`**

O uso de versionamento permite evoluir os contratos da API com maior controle sobre a compatibilidade entre clientes e servidor.

## 6. Recursos disponíveis

### 6.1. Saúde da aplicação

**`GET /api/v1/health`**

Verifica a disponibilidade das dependências monitoradas pela aplicação, incluindo PostgreSQL e MongoDB.

### 6.2. Autenticação

| Método | Endpoint | Autenticação | Finalidade |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Não | Autenticar usuário e criar sessão |
| GET | `/api/v1/auth/me` | Sim | Consultar o usuário autenticado |
| POST | `/api/v1/auth/logout` | Sim | Encerrar a sessão atual |

### 6.3. Administração de usuários

A API também possui funcionalidades administrativas para gerenciamento de usuários, incluindo cadastro, listagem, desativação e redefinição de senhas.

Essas operações são protegidas por autenticação e exigem permissões administrativas.

Os caminhos e contratos completos desses endpoints devem ser consultados na implementação de `backend/src/routes/`.

## 7. Autenticação e autorização

O Corporate Chat utiliza autenticação por JWT (*JSON Web Token*).

Após o login:

1. O servidor valida as credenciais.
2. Uma sessão é criada no PostgreSQL.
3. Um JWT é emitido com identificador exclusivo `jti`.
4. O cliente utiliza o token no cabeçalho `Authorization`.
5. A API verifica o token e o estado da sessão em requisições protegidas.

As permissões administrativas são verificadas com base nos dados atuais do usuário, e não exclusivamente nas informações presentes no token.

O logout realiza a revogação da sessão correspondente ao JWT apresentado.

Consulte a documentação detalhada:

**[Autenticação e gerenciamento de sessões](AUTHENTICATION.md)**

## 8. Padrões de comunicação HTTP

A API utiliza JSON para os corpos de requisições e respostas que contêm dados.

As respostas bem-sucedidas podem conter um objeto `data`, enquanto os erros seguem um padrão com informações como:

- `error.code`: código identificador do erro.
- `error.message`: descrição do erro.
- `error.details`: informações complementares de validação, quando aplicável.

Respostas HTTP `204 No Content` não possuem corpo.

## 9. Testes automatizados

A aplicação possui testes automatizados para:

- Integridade dos modelos e regras de persistência.
- Integração PostgreSQL e MongoDB.
- Consultas e relacionamentos de dados.
- Login e autenticação JWT.
- Autorização administrativa.
- Gerenciamento de sessões e logout.
- Tratamento de erros e validações da API.

Os testes da API utilizam o Node.js Test Runner. Os testes de integração de persistência executam operações controladas nos bancos do ambiente de desenvolvimento.

Consulte:

**[Guia de testes automatizados](TESTING.md)**

## 10. Documentação relacionada

| Documento | Finalidade |
|---|---|
| [Autenticação e gerenciamento de sessões](AUTHENTICATION.md) | Descrever JWT, login, logout, persistência e segurança das sessões |
| [Testes automatizados](TESTING.md) | Orientar a execução e validação dos testes |
| [Documentação de persistência](../persistence/README.md) | Descrever a arquitetura e as operações de persistência |

## 11. Evolução da documentação

A documentação deve ser atualizada sempre que forem introduzidos:

- Novos endpoints.
- Alterações nos contratos HTTP.
- Novos mecanismos de autenticação e autorização.
- Mudanças relevantes nos modelos de persistência.
- Novos procedimentos de teste.
- Alterações de comportamento que impactem consumidores da API.

O objetivo é manter a documentação alinhada à implementação e permitir que novos integrantes da equipe compreendam o funcionamento do sistema sem depender exclusivamente da leitura do código-fonte.

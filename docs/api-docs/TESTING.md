# Corporate Chat — Guia de Testes Automatizados da API

## 1. Objetivo

Este documento apresenta os procedimentos utilizados para validar o funcionamento do backend do Corporate Chat.

Os testes automatizados verificam regras de negócio, respostas HTTP, segurança da autenticação, gerenciamento de sessões e integração com os mecanismos de persistência.

O objetivo é identificar regressões e garantir maior confiança antes da integração de novas funcionalidades ao repositório principal.

## 2. Tecnologias de teste

A aplicação utiliza o **Node.js Test Runner**, com as bibliotecas nativas `node:test` e `node:assert/strict`.

Os testes da API executam a aplicação Express utilizando portas HTTP locais e requisições realizadas por `fetch`.

Sempre que adequado, as dependências de persistência são substituídas por repositories simulados em memória, mantendo o isolamento entre os cenários.

Os testes de integração utilizam PostgreSQL e MongoDB reais no ambiente de desenvolvimento.

## 3. Organização dos testes

| Diretório | Finalidade |
|---|---|
| `backend/tests/api/` | Testes HTTP da API |
| `backend/tests/helpers/` | Ferramentas auxiliares e mocks |
| `backend/database/tests/integrity/` | Regras de integridade dos bancos |
| `backend/database/tests/integration/` | Integração com persistência real |
| `backend/database/tests/queries/` | Consultas e operações de leitura |
| `backend/tests/realtime/` | Testes da infraestrutura Socket.IO |

### Arquivos relacionados à autenticação

| Arquivo | Responsabilidade |
|---|---|
| `tests/api/auth.test.js` | Login, validação JWT e autorização |
| `tests/api/admin-users.test.js` | Funcionalidades administrativas |
| `tests/api/logout.test.js` | Gerenciamento e revogação de sessões |
| `tests/helpers/mockAuthSessionRepository.js` | Simulação de sessões persistidas |
| `database/tests/integration/auth-sessions-integration.test.js` | Integração real com PostgreSQL |

### Arquivos relacionados à solicitação de cadastro

| Arquivo | Responsabilidade |
|---|---|
| `tests/api/registration-requests.test.js` | Contratos HTTP da BE-05 |
| `database/tests/integration/registration-requests-integration.test.js` | Persistência real, rollback e concorrência |
| `database/tests/integrity/postgres-integrity.test.js` | Constraints e regras de integridade PostgreSQL |

### Arquivos relacionados ao dashboard

| Arquivo | Responsabilidade |
|---|---|
| `tests/api/dashboard.test.js` | Contrato HTTP do dashboard |
| `database/tests/integration/dashboard-integration.test.js` | Integração real PostgreSQL + MongoDB |


## 4. Pré-requisitos

Para executar a suíte completa:

1. Node.js e dependências do backend instalados.
2. Arquivo `.env` do ambiente de desenvolvimento configurado.
3. Containers PostgreSQL e MongoDB em execução.
4. Migrations necessárias aplicadas.
5. Massa de dados de desenvolvimento disponível.
6. Tabela `auth_sessions` criada pela migration correspondente.

Os testes da API que utilizam repositories simulados podem ser executados sem depender de acesso aos bancos reais.

Os testes de integração dependem dos serviços de persistência configurados.

## 5. Execução dos testes

Todos os comandos devem ser executados a partir do diretório `backend/`.

### 5.1. Suíte completa

**Comando:** `npm test`

Executa sequencialmente as validações de persistência, os testes da API e os testes da infraestrutura realtime.

É o principal comando para verificação de regressão antes de concluir uma entrega.

### 5.2. Testes da API

**Comando:** `npm run test:api`

Executa os arquivos `tests/api/*.test.js`.

A suíte contempla:

- Login e autenticação.
- Validação de tokens.
- Permissões administrativas.
- Gerenciamento de usuários.
- Logout e revogação.
- Tratamento de erros.
- Validação de senhas.
- Endpoint de saúde da aplicação.
- Solicitação de cadastro.
- Aprovação e rejeição por administrador.

### 5.3. Testes de integração

**Comando:** `npm run test:integration`

Executa os arquivos `database/tests/integration/*.test.js`.

A suíte verifica integrações reais com PostgreSQL e MongoDB, incluindo gerenciamento de sessões, solicitações de cadastro, dashboard, conversas, grupos, mensagens e autenticação Socket.IO utilizando JWT e sessões persistidas.



### 5.4. Testes de integridade

**Comando:** `npm run test:integrity`

Valida as restrições, relacionamentos e regras de integridade aplicadas aos modelos PostgreSQL e MongoDB.

### 5.5. Testes de consultas

**Comando:** `npm run test:queries`

Verifica consultas relevantes à camada de persistência, incluindo usuários, solicitações, conversas e mensagens.

### 5.6. Testes realtime

**Comando:** `npm run test:realtime`

Valida autenticação da conexão Socket.IO, segurança do handshake, ciclo de vida das conexões, múltiplos sockets por usuário, rooms privadas e o registry de conexões.

## 6. Execução de arquivos individuais

Durante o desenvolvimento, é possível executar somente os testes necessários.

| Objetivo | Comando |
|---|---|
| Autenticação | `node --test --test-concurrency=1 tests/api/auth.test.js` |
| Administração de usuários | `node --test --test-concurrency=1 tests/api/admin-users.test.js` |
| Logout | `node --test --test-concurrency=1 tests/api/logout.test.js` |
| Integração de sessões | `node --test --test-concurrency=1 database/tests/integration/auth-sessions-integration.test.js` |
| Solicitação de cadastro — API | `node --test --test-concurrency=1 tests/api/registration-requests.test.js` |
| Solicitação de cadastro — integração | `node --test --test-concurrency=1 database/tests/integration/registration-requests-integration.test.js` |
| Integridade PostgreSQL | `node --test --test-concurrency=1 database/tests/integrity/postgres-integrity.test.js` |
| Dashboard — API | `node --test --test-concurrency=1 tests/api/dashboard.test.js` |
| Dashboard — integração | `node --test --test-concurrency=1 database/tests/integration/dashboard-integration.test.js` |
| Socket.IO — autenticação | `node --test --test-concurrency=1 tests/realtime/socket-auth.test.js` |
| Socket.IO — lifecycle | `node --test --test-concurrency=1 tests/realtime/socket-lifecycle.test.js` |
| Socket.IO — registry | `node --test --test-concurrency=1 tests/realtime/connection-registry.test.js` |
| Socket.IO — integração real | `node --test --test-concurrency=1 database/tests/integration/socket-auth-integration.test.js` |

O uso de `--test-concurrency=1` mantém a execução sequencial dos arquivos selecionados, reduzindo interferências entre testes que utilizam recursos ou configurações compartilhadas.

## 7. Testes de autenticação

O arquivo `auth.test.js` verifica:

- Login com credenciais válidas.
- Normalização de e-mail.
- Atualização de último acesso.
- Rejeição de senhas incorretas.
- Rejeição de usuários inativos.
- Validação dos dados de entrada.
- Tratamento de JSON inválido.
- Assinatura e expiração JWT.
- Rejeição de tokens inválidos.
- Rejeição de tokens com emissor incorreto.
- Rejeição de algoritmo JWT não permitido.
- Validação dos identificadores do usuário.
- Recuperação dos dados atuais do usuário.
- Restrições administrativas.
- Configuração do segredo e da expiração JWT.

A suíte utiliza repositories simulados para executar esses cenários sem modificar o banco.

## 8. Testes de logout e gerenciamento de sessões

O arquivo `logout.test.js` cobre oito cenários.

| Cenário | Resultado esperado |
|---|---|
| Login cria sessão | JWT contém `jti`, com sessão persistida no mock |
| Logout com sessão válida | HTTP 204 e corpo vazio |
| Reutilização de token revogado | HTTP 401, `TOKEN_REVOKED` |
| Sessões simultâneas | Revogar A não invalida B |
| Logout repetido | HTTP 401, `TOKEN_REVOKED` |
| Logout sem token | HTTP 401, `TOKEN_MISSING` |
| JWT sem `jti` | HTTP 401, `TOKEN_INVALID` |
| Erro ao criar sessão | HTTP 500, sem disponibilizar JWT |

Esses testes verificam o comportamento HTTP e a integração entre controller, service, autenticação e repository simulado.

## 9. Integração real de sessões

O arquivo `auth-sessions-integration.test.js` utiliza PostgreSQL real.

Os cenários implementados verificam:

1. Criação de sessão.
2. Consulta de sessão por identificador.
3. Revogação de sessão.
4. Impedimento de revogação duplicada.
5. Independência entre sessões.
6. Proteção contra revogação por outro usuário.
7. Rejeição de sessões vinculadas a usuários inexistentes.

Os testes criam registros temporários e executam limpeza dos registros identificados durante a execução.

## 10. Testes da solicitação de cadastro

A BE-05 possui cobertura em três níveis.

### API

O arquivo `registration-requests.test.js` verifica:

- criação pública de solicitação;
- validações de entrada;
- proteção das rotas administrativas;
- listagem;
- aprovação;
- rejeição;
- tentativa de analisar solicitação já revisada;
- limite de 150 caracteres para e-mail;
- limite de 500 caracteres para motivo da rejeição.

### Integração PostgreSQL

O arquivo `registration-requests-integration.test.js` verifica:

- aprovação real;
- rejeição real;
- rollback quando ocorre falha durante aprovação;
- concorrência de aprovação;
- concorrência de criação de solicitação.

### Integridade PostgreSQL

O arquivo `postgres-integrity.test.js` verifica:

- consistência dos estados;
- foreign keys;
- limites dos campos;
- unicidade de solicitação PENDING.

### Cuidados de execução

O teste de integração deve executar somente em ambiente `development`.

Ele depende da presença do usuário de desenvolvimento definido no código de teste.

Antes da execução, confirme que o PostgreSQL configurado corresponde ao banco de desenvolvimento e não a um banco de produção.

A execução da suíte de testes de integração não substitui os procedimentos de backup e isolamento do ambiente.
## 11. Testes do dashboard

A funcionalidade de dashboard possui cobertura de API e integração real.

### API

O arquivo `dashboard.test.js` possui 12 cenários, incluindo:

- autenticação obrigatória;
- acesso por usuário comum;
- contatos ACTIVE;
- exclusão do próprio usuário;
- proteção contra exposição de dados sensíveis;
- identificação de PRIVATE;
- identificação de GROUP;
- última mensagem;
- validação de limit;
- proteção contra tentativa de substituir a identidade autenticada.

### Integração

O arquivo `dashboard-integration.test.js` possui 4 cenários executados com PostgreSQL e MongoDB reais.

A suíte valida:

- contatos ACTIVE e exclusão do próprio usuário;
- resolução pública de UUIDs;
- integração entre PostgreSQL e MongoDB;
- composição de PRIVATE e GROUP;
- preservação da identificação de participante INACTIVE no histórico.

## 12. Configuração do ambiente de testes

Os testes da API utilizam valores fictícios para configurações sensíveis, incluindo `JWT_SECRET`.

Esses valores existem exclusivamente para validação automatizada e não devem ser reutilizados nos ambientes publicados.

Os testes que dependem de PostgreSQL real utilizam a configuração do ambiente de desenvolvimento carregada pelo backend.

É importante manter separados:

- Segredos de desenvolvimento.
- Segredos utilizados nos testes.
- Credenciais de produção.

Arquivos `.env` com credenciais não devem ser incluídos no repositório.

## 13. Resultado da validação integrada

**Referência:** validação final após reconstrução completa do ambiente de desenvolvimento em 12/10/2026.

| Suíte | Executados | Aprovados | Falhas |
|---|---:|---:|---:|
| Integridade PostgreSQL e MongoDB | 37 | 37 | 0 |
| Integração com persistência | 26 | 26 | 0 |
| Consultas de persistência | 5 | 5 | 0 |
| API | 88 | 88 | 0 |
| **Total** | **156** | **156** | **0** |


A execução também confirmou:

- Sincronização dos índices MongoDB.
- Validação da massa de dados de desenvolvimento.
- Disponibilidade da comunicação entre PostgreSQL e MongoDB.
- Execução dos testes de sessões com PostgreSQL real.
- Ausência de falhas na suíte automatizada existente.

Esse resultado representa a situação da versão validada na data indicada e deverá ser atualizado conforme novos testes forem acrescentados.

## 14. Procedimento recomendado antes de Pull Requests

Antes de integrar alterações ao repositório principal:

1. Confirmar que as migrations necessárias estão aplicadas.
2. Executar os testes relacionados à funcionalidade modificada.
3. Executar `npm test`.
4. Corrigir todas as falhas identificadas.
5. Inspecionar arquivos modificados e não rastreados.
6. Executar `git diff --check`.
7. Revisar a presença de dados sensíveis.
8. Atualizar a documentação correspondente.
9. Registrar os resultados da validação no Pull Request.

A aprovação dos testes constitui uma evidência de validação, mas não substitui a revisão de código e de segurança.

## 15. Evolução dos testes

Sempre que uma nova funcionalidade for incorporada, deverá ser avaliada a necessidade de adicionar:

- Testes de comportamento esperado.
- Testes de validação de entrada.
- Testes de falha e tratamento de erros.
- Testes de autenticação e autorização.
- Testes de integração quando houver persistência.
- Testes de regressão das funcionalidades relacionadas.

A suíte automatizada deverá evoluir juntamente com os serviços e contratos da API.

## 16. Documentação relacionada

- [Visão geral da API](README.md)
- [Autenticação e gerenciamento de sessões](AUTHENTICATION.md)
- [Arquitetura de persistência](../persistence/README.md)
- [Dashboard](DASHBOARD.md)
- [Comunicação em tempo real](docs/api-docs/REALTIME.md)

A manutenção contínua desses documentos contribui para a rastreabilidade das decisões técnicas, a padronização do desenvolvimento e a qualidade das entregas do Corporate Chat.

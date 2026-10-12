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

### Arquivos relacionados à autenticação

| Arquivo | Responsabilidade |
|---|---|
| `tests/api/auth.test.js` | Login, validação JWT e autorização |
| `tests/api/admin-users.test.js` | Funcionalidades administrativas |
| `tests/api/logout.test.js` | Gerenciamento e revogação de sessões |
| `tests/helpers/mockAuthSessionRepository.js` | Simulação de sessões persistidas |
| `database/tests/integration/auth-sessions-integration.test.js` | Integração real com PostgreSQL |

### Arquivos relacionados às conversas (BE-07)

| Arquivo | Responsabilidade |
|---|---|
| `tests/api/conversations.test.js` | Contratos HTTP, segurança JWT e cenários negativos de `/conversations/private`, `/conversations` e `/conversations/:id/messages` |
| `database/tests/integration/conversations-integration.test.js` | Integração end-to-end real (JWT + PostgreSQL + MongoDB): criação, listagem, histórico e restrições de acesso |

### Arquivos relacionados à solicitação de cadastro

| Arquivo | Responsabilidade |
|---|---|
| `tests/api/registration-requests.test.js` | Contratos HTTP da BE-05 |
| `database/tests/integration/registration-requests-integration.test.js` | Persistência real, rollback e concorrência |
| `database/tests/integrity/postgres-integrity.test.js` | Constraints e regras de integridade PostgreSQL |

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

Executa sequencialmente as validações de persistência e os testes da API.

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
- Conversas privadas, listagem e histórico de mensagens (BE-07).

### 5.3. Testes de integração

**Comando:** `npm run test:integration`

Executa os arquivos `database/tests/integration/*.test.js`.

A suíte verifica as integrações de persistência existentes e o gerenciamento real das sessões integrações de persistência, gerenciamento de sessões
e fluxo de solicitação de cadastro com PostgreSQL real

### 5.4. Testes de integridade

**Comando:** `npm run test:integrity`

Valida as restrições, relacionamentos e regras de integridade aplicadas aos modelos PostgreSQL e MongoDB.

### 5.5. Testes de consultas

**Comando:** `npm run test:queries`

Verifica consultas relevantes à camada de persistência, incluindo usuários, solicitações, conversas e mensagens.

## 6. Execução de arquivos individuais

Durante o desenvolvimento, é possível executar somente os testes necessários.

| Objetivo | Comando |
|---|---|
| Autenticação | `node --test --test-concurrency=1 tests/api/auth.test.js` |
| Administração de usuários | `node --test --test-concurrency=1 tests/api/admin-users.test.js` |
| Logout | `node --test --test-concurrency=1 tests/api/logout.test.js` |
| Conversas (BE-07) | `node --test --test-concurrency=1 tests/api/conversations.test.js` |
| Integração de sessões | `node --test --test-concurrency=1 database/tests/integration/auth-sessions-integration.test.js` |
| Integração de conversas (BE-07) | `node --test --test-concurrency=1 database/tests/integration/conversations-integration.test.js` |
| Solicitação de cadastro — API | `node --test --test-concurrency=1 tests/api/registration-requests.test.js` |
| Solicitação de cadastro — integração | `node --test --test-concurrency=1 database/tests/integration/registration-requests-integration.test.js` |
| Integridade PostgreSQL | `node --test --test-concurrency=1 database/tests/integrity/postgres-integrity.test.js` |

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

## 9.1. Testes de conversas (BE-07)

Os endpoints de conversas são cobertos em dois níveis.

### API (`tests/api/conversations.test.js`)

Valida os contratos HTTP com serviços simulados:

- criação de conversa privada (201);
- listagem de conversas do usuário autenticado (200);
- histórico com paginação por cursor (200);
- criação sem `otherUserId` (400 `OTHER_USER_ID_REQUIRED`);
- JSON malformado (400 `INVALID_JSON`);
- JWT ausente, inválido ou mal formatado nos três endpoints (401);
- rejeições do serviço sem vazamento de detalhes (500 `INTERNAL_ERROR`);
- restrição de histórico: usuário não membro não recebe mensagens.

### Integração (`database/tests/integration/conversations-integration.test.js`)

Executa requisições HTTP reais contra a aplicação montada com os serviços
reais de autenticação e conversas, utilizando PostgreSQL e MongoDB de
desenvolvimento. O fluxo real de login emite JWT e cria sessão em
`auth_sessions`.

Cenários cobertos:

1. Criação de conversa privada cria o documento e os dois membros.
2. Criação repetida para o mesmo par reutiliza o documento (chave canônica).
3. Listagem retorna apenas conversas do usuário autenticado (isolamento).
4. Histórico respeita ordem cronológica, `limit` e cursor (`before`).
5. Usuário autenticado fora da conversa não acessa o histórico.
6. Membro com status `LEFT` não lista a conversa nem acessa o histórico.
7. Token inválido é rejeitado (401 `TOKEN_INVALID`) nos três endpoints.
8. Requisição sem token é rejeitada (401 `TOKEN_MISSING`) nos três endpoints.

O teste executa somente em ambiente `development` e remove os registros
criados durante a execução (usuários, sessões, conversas, membros e
mensagens).

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

## 10. Configuração do ambiente de testes

Os testes da API utilizam valores fictícios para configurações sensíveis, incluindo `JWT_SECRET`.

Esses valores existem exclusivamente para validação automatizada e não devem ser reutilizados nos ambientes publicados.

Os testes que dependem de PostgreSQL real utilizam a configuração do ambiente de desenvolvimento carregada pelo backend.

É importante manter separados:

- Segredos de desenvolvimento.
- Segredos utilizados nos testes.
- Credenciais de produção.

Arquivos `.env` com credenciais não devem ser incluídos no repositório.

## 11. Resultado da validação integrada

**Referência:** execução de `npm test` em 12/10/2026, no ambiente local de desenvolvimento.
execução após a expansão da cobertura BE-07 (conversas privadas e histórico)

| Suíte | Executados | Aprovados | Falhas |
|---|---:|---:|---:|
| Integridade PostgreSQL e MongoDB | 37 | 37 | 0 |
| Integração com persistência | 30 | 30 | 0 |
| Consultas de persistência | 5 | 5 | 0 |
| API e autenticação | 92 | 92 | 0 |
| **Total** | **164** | **164** | **0** |


A execução também confirmou:

- Sincronização dos índices MongoDB.
- Validação da massa de dados de desenvolvimento.
- Disponibilidade da comunicação entre PostgreSQL e MongoDB.
- Execução dos testes de sessões com PostgreSQL real.
- Ausência de falhas na suíte automatizada existente.
- Cobertura BE-07: contratos HTTP, segurança JWT, cenários negativos e integração end-to-end dos endpoints de conversas e histórico.

Esse resultado representa a situação da versão validada na data indicada e deverá ser atualizado conforme novos testes forem acrescentados.

## 12. Procedimento recomendado antes de Pull Requests

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

## 13. Evolução dos testes

Sempre que uma nova funcionalidade for incorporada, deverá ser avaliada a necessidade de adicionar:

- Testes de comportamento esperado.
- Testes de validação de entrada.
- Testes de falha e tratamento de erros.
- Testes de autenticação e autorização.
- Testes de integração quando houver persistência.
- Testes de regressão das funcionalidades relacionadas.

A suíte automatizada deverá evoluir juntamente com os serviços e contratos da API.

## 14. Documentação relacionada

- [Visão geral da API](README.md)
- [Autenticação e gerenciamento de sessões](AUTHENTICATION.md)
- [Arquitetura de persistência](../persistence/README.md)

A manutenção contínua desses documentos contribui para a rastreabilidade das decisões técnicas, a padronização do desenvolvimento e a qualidade das entregas do Corporate Chat.

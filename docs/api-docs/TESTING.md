# Corporate Chat — Guia de Testes Automatizados do Backend

## 1. Objetivo

Este documento apresenta os procedimentos utilizados para validar o funcionamento do backend do Corporate Chat.

Os testes automatizados verificam regras de negócio, contratos HTTP, segurança da autenticação, gerenciamento de sessões, persistência, integração entre PostgreSQL e MongoDB e comunicação em tempo real por Socket.IO.

O objetivo é identificar regressões e garantir maior confiança antes da integração de novas funcionalidades ao repositório principal.

---

## 2. Tecnologias de teste

A aplicação utiliza o **Node.js Test Runner**, com as bibliotecas nativas:

- `node:test`;
- `node:assert/strict`.

Os testes da API executam a aplicação Express utilizando portas HTTP locais e requisições realizadas por `fetch`.

Os testes realtime utilizam `socket.io-client` para estabelecer conexões reais contra servidores HTTP locais criados durante a execução dos testes.

Sempre que adequado, dependências de persistência e serviços são substituídos por mocks controlados, mantendo isolamento entre cenários.

Os testes de integração utilizam PostgreSQL e MongoDB reais no ambiente de desenvolvimento.

---

## 3. Organização dos testes

| Diretório | Finalidade |
|---|---|
| `backend/tests/api/` | Testes HTTP da API |
| `backend/tests/helpers/` | Ferramentas auxiliares e mocks |
| `backend/tests/realtime/` | Testes da camada Socket.IO |
| `backend/database/tests/integrity/` | Regras de integridade dos bancos |
| `backend/database/tests/integration/` | Integração com persistência real |
| `backend/database/tests/queries/` | Consultas e operações de leitura |

### 3.1. Arquivos relacionados à autenticação

| Arquivo | Responsabilidade |
|---|---|
| `tests/api/auth.test.js` | Login, validação JWT e autorização |
| `tests/api/admin-users.test.js` | Funcionalidades administrativas |
| `tests/api/logout.test.js` | Gerenciamento e revogação de sessões |
| `tests/helpers/mockAuthSessionRepository.js` | Simulação de sessões persistidas |
| `database/tests/integration/auth-sessions-integration.test.js` | Integração real com PostgreSQL |

### 3.2. Arquivos relacionados à solicitação de cadastro

| Arquivo | Responsabilidade |
|---|---|
| `tests/api/registration-requests.test.js` | Contratos HTTP de solicitação e análise |
| `database/tests/integration/registration-requests-integration.test.js` | Persistência real, rollback e concorrência |
| `database/tests/integrity/postgres-integrity.test.js` | Constraints e regras de integridade PostgreSQL |

### 3.3. Arquivos relacionados ao dashboard

| Arquivo | Responsabilidade |
|---|---|
| `tests/api/dashboard.test.js` | Contrato HTTP do dashboard |
| `database/tests/integration/dashboard-integration.test.js` | Integração real PostgreSQL + MongoDB |

### 3.4. Arquivos relacionados a conversas, grupos e mensagens

| Arquivo | Responsabilidade |
|---|---|
| `tests/api/conversations.test.js` | Contratos HTTP de conversas e histórico |
| `tests/api/groups.test.js` | Contratos HTTP de gerenciamento de grupos |
| `tests/api/messages.test.js` | Contratos HTTP de mensagens, entrega e leitura |
| `database/tests/integration/messages-integration.test.js` | Persistência real, checkpoints e sincronização |
| `database/tests/integration/socket-auth-integration.test.js` | Autenticação Socket.IO com JWT e sessão reais |

### 3.5. Arquivos relacionados ao realtime

| Arquivo | Responsabilidade |
|---|---|
| `tests/realtime/connection-registry.test.js` | Registry de conexões por usuário |
| `tests/realtime/socket-auth.test.js` | Autenticação e segurança do handshake |
| `tests/realtime/socket-lifecycle.test.js` | Ciclo de vida, múltiplos sockets e rooms |
| `tests/realtime/socket-messages.test.js` | Envio, broadcast, idempotência e segurança |
| `tests/realtime/socket-message-status.test.js` | Entrega, leitura e checkpoints |
| `tests/realtime/socket-sync.test.js` | Sincronização incremental, snapshot e segurança |
| `tests/realtime/socket-reconnection.test.js` | Reconexão automática e retomada do realtime |

---

## 4. Pré-requisitos

Para executar a suíte completa:

1. Node.js e dependências do backend instalados;
2. arquivo `.env` do ambiente de desenvolvimento configurado;
3. containers PostgreSQL e MongoDB em execução;
4. migrations necessárias aplicadas;
5. índices MongoDB sincronizados;
6. massa de dados de desenvolvimento disponível quando necessária;
7. tabela `auth_sessions` criada pela migration correspondente.

Os testes isolados da API e de Socket.IO que utilizam serviços simulados podem ser executados sem depender dos bancos reais.

Os testes de integração dependem dos serviços de persistência configurados.

---

## 5. Execução dos testes

Todos os comandos devem ser executados a partir do diretório `backend/`.

### 5.1. Suíte completa

**Comando:**

```bash
npm test
```

Executa sequencialmente:

```text
test:persistence
test:api
test:realtime
```

O `test:persistence` agrega as validações de integridade, integração e consultas de persistência.

`npm test` é o principal comando de regressão antes da conclusão de uma entrega.

### 5.2. Testes da API

**Comando:**

```bash
npm run test:api
```

Executa os arquivos:

```text
tests/api/*.test.js
```

A suíte contempla, entre outros cenários:

- login e autenticação;
- validação de tokens;
- permissões administrativas;
- gerenciamento de usuários;
- logout e revogação;
- tratamento de erros;
- validação de senhas;
- health check;
- solicitação de cadastro;
- aprovação e rejeição;
- dashboard;
- conversas privadas;
- histórico de mensagens;
- grupos;
- mensagens;
- confirmação de entrega e leitura.

### 5.3. Testes de integração

**Comando:**

```bash
npm run test:integration
```

Executa:

```text
database/tests/integration/*.test.js
```

A suíte verifica integrações reais com PostgreSQL e MongoDB, incluindo:

- gerenciamento e revogação de sessões;
- solicitação e aprovação de cadastro;
- rollback e concorrência;
- dashboard;
- conversas privadas;
- grupos;
- persistência de mensagens;
- idempotência;
- checkpoints de entrega e leitura;
- proteção contra regressão dos checkpoints;
- concorrência de ACKs;
- autenticação Socket.IO com sessão real;
- sincronização de mensagens após desconexão;
- proteção da sincronização por membership;
- paginação incremental da sincronização.

Na última validação confirmada desta suíte:

```text
69 testes
69 aprovados
0 falhas
```

### 5.4. Testes de integridade

**Comando:**

```bash
npm run test:integrity
```

Valida restrições, relacionamentos e regras de integridade aplicadas aos modelos PostgreSQL e MongoDB.

### 5.5. Testes de consultas

**Comando:**

```bash
npm run test:queries
```

Verifica consultas relevantes à camada de persistência, incluindo usuários, solicitações, conversas e mensagens.

### 5.6. Testes realtime

**Comando:**

```bash
npm run test:realtime
```

Executa:

```text
tests/realtime/*.test.js
```

A suíte realtime valida:

- autenticação Socket.IO;
- segurança do handshake;
- identidade armazenada em `socket.data.user`;
- rejeição de token ausente, inválido, expirado ou revogado;
- rejeição de usuário inativo;
- proteção contra códigos internos;
- múltiplas conexões por usuário;
- rooms privadas;
- ciclo de vida das conexões;
- `connectionRegistry`;
- envio realtime de mensagens;
- broadcast para membros `ACTIVE`;
- proteção contra falsificação de identidade;
- idempotência de mensagens;
- confirmação de entrega;
- confirmação de leitura;
- checkpoints monotônicos;
- redistribuição do estado autoritativo;
- sincronização incremental;
- sincronização por snapshot;
- sanitização de erros;
- reconexão automática;
- nova autenticação depois da reconexão;
- retomada das operações realtime após reconexão.

Na última validação confirmada desta suíte:

```text
36 testes
36 aprovados
0 falhas
```

---

## 6. Execução de arquivos individuais

Durante o desenvolvimento, é possível executar somente os testes relacionados à funcionalidade modificada.

| Objetivo | Comando |
|---|---|
| Autenticação | `node --test --test-concurrency=1 tests/api/auth.test.js` |
| Administração de usuários | `node --test --test-concurrency=1 tests/api/admin-users.test.js` |
| Logout | `node --test --test-concurrency=1 tests/api/logout.test.js` |
| Solicitação de cadastro — API | `node --test --test-concurrency=1 tests/api/registration-requests.test.js` |
| Dashboard — API | `node --test --test-concurrency=1 tests/api/dashboard.test.js` |
| Conversas — API | `node --test --test-concurrency=1 tests/api/conversations.test.js` |
| Grupos — API | `node --test --test-concurrency=1 tests/api/groups.test.js` |
| Mensagens — API | `node --test --test-concurrency=1 tests/api/messages.test.js` |
| Integração de sessões | `node --test --test-concurrency=1 database/tests/integration/auth-sessions-integration.test.js` |
| Solicitação de cadastro — integração | `node --test --test-concurrency=1 database/tests/integration/registration-requests-integration.test.js` |
| Mensagens — integração | `node --test --test-concurrency=1 database/tests/integration/messages-integration.test.js` |
| Socket.IO — integração real | `node --test --test-concurrency=1 database/tests/integration/socket-auth-integration.test.js` |
| Integridade PostgreSQL | `node --test --test-concurrency=1 database/tests/integrity/postgres-integrity.test.js` |
| Socket.IO — autenticação | `node --test --test-concurrency=1 tests/realtime/socket-auth.test.js` |
| Socket.IO — lifecycle | `node --test --test-concurrency=1 tests/realtime/socket-lifecycle.test.js` |
| Socket.IO — registry | `node --test --test-concurrency=1 tests/realtime/connection-registry.test.js` |
| Realtime — mensagens | `node --test --test-concurrency=1 tests/realtime/socket-messages.test.js` |
| Realtime — entrega e leitura | `node --test --test-concurrency=1 tests/realtime/socket-message-status.test.js` |
| Realtime — sincronização | `node --test --test-concurrency=1 tests/realtime/socket-sync.test.js` |
| Realtime — reconexão | `node --test --test-concurrency=1 tests/realtime/socket-reconnection.test.js` |

O uso de `--test-concurrency=1` mantém a execução sequencial dos arquivos selecionados, reduzindo interferências entre testes que utilizam recursos ou configurações compartilhadas.

---

## 7. Testes de autenticação

O arquivo `auth.test.js` verifica:

- login com credenciais válidas;
- normalização de e-mail;
- atualização de último acesso;
- rejeição de senhas incorretas;
- rejeição de usuários inativos;
- validação dos dados de entrada;
- tratamento de JSON inválido;
- assinatura e expiração JWT;
- rejeição de tokens inválidos;
- rejeição de tokens com emissor incorreto;
- rejeição de algoritmo JWT não permitido;
- validação dos identificadores do usuário;
- recuperação dos dados atuais do usuário;
- restrições administrativas;
- configuração do segredo e da expiração JWT.

A suíte utiliza repositories simulados para executar esses cenários sem modificar o banco.

---

## 8. Testes de logout e gerenciamento de sessões

O arquivo `logout.test.js` cobre o comportamento de encerramento e revogação de sessões.

Entre os cenários validados estão:

| Cenário | Resultado esperado |
|---|---|
| Login cria sessão | JWT contém `jti`, com sessão persistida |
| Logout com sessão válida | HTTP 204 e corpo vazio |
| Reutilização de token revogado | HTTP 401, `TOKEN_REVOKED` |
| Sessões simultâneas | Revogar uma sessão não invalida outra |
| Logout repetido | Token anteriormente revogado é rejeitado |
| Logout sem token | HTTP 401, `TOKEN_MISSING` |
| JWT sem `jti` | HTTP 401, `TOKEN_INVALID` |
| Erro ao criar sessão | HTTP 500 sem disponibilizar JWT |

Esses testes verificam o comportamento HTTP e a integração entre controller, service, autenticação e repository.

---

## 9. Integração real de sessões

O arquivo `auth-sessions-integration.test.js` utiliza PostgreSQL real.

Os cenários implementados verificam:

1. criação de sessão;
2. consulta de sessão por identificador;
3. revogação de sessão;
4. impedimento de revogação duplicada;
5. independência entre sessões;
6. proteção contra revogação por outro usuário;
7. rejeição de sessões vinculadas a usuários inexistentes.

Os testes criam registros temporários e executam limpeza dos registros identificados durante a execução.

---

## 10. Testes da solicitação de cadastro

A solicitação de cadastro possui cobertura em três níveis.

### 10.1. API

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

### 10.2. Integração PostgreSQL

O arquivo `registration-requests-integration.test.js` verifica:

- aprovação real;
- rejeição real;
- rollback quando ocorre falha durante aprovação;
- concorrência de aprovação;
- concorrência de criação de solicitação.

### 10.3. Integridade PostgreSQL

O arquivo `postgres-integrity.test.js` verifica:

- consistência dos estados;
- foreign keys;
- limites dos campos;
- unicidade de solicitação `PENDING`.

### 10.4. Cuidados de execução

Os testes de integração devem utilizar somente ambiente controlado de desenvolvimento/teste.

Antes da execução, confirme que PostgreSQL e MongoDB configurados correspondem aos bancos destinados ao desenvolvimento e não a ambientes de produção.

---

## 11. Testes do dashboard

A funcionalidade de dashboard possui cobertura de API e integração real.

### 11.1. API

O arquivo `dashboard.test.js` verifica cenários como:

- autenticação obrigatória;
- acesso por usuário comum;
- contatos `ACTIVE`;
- exclusão do próprio usuário;
- proteção contra exposição de dados sensíveis;
- identificação de conversas `PRIVATE`;
- identificação de conversas `GROUP`;
- última mensagem;
- validação de `limit`;
- proteção contra tentativa de substituir a identidade autenticada.

### 11.2. Integração

O arquivo `dashboard-integration.test.js` utiliza PostgreSQL e MongoDB reais para validar:

- contatos ativos e exclusão do próprio usuário;
- resolução pública de UUIDs;
- integração entre PostgreSQL e MongoDB;
- composição de `PRIVATE` e `GROUP`;
- preservação da identificação de participante `INACTIVE` no histórico.

---

## 12. Testes de mensagens, entrega e leitura

A funcionalidade de mensagens possui testes de API e integração.

São validados:

- envio por membro `ACTIVE`;
- rejeição de usuário fora da conversa;
- mensagens em conversas privadas e grupos;
- obrigatoriedade de `clientMessageId`;
- rejeição de conteúdo vazio;
- limite de 1000 caracteres;
- idempotência de reenvio;
- avanço de checkpoint de entrega;
- avanço de checkpoint de leitura;
- idempotência dos ACKs;
- proteção contra regressão de checkpoints;
- mensagem pertencente a outra conversa;
- concorrência entre ACKs.

Os checkpoints de entrega e leitura são persistidos por membro da conversa.

---

## 13. Testes realtime

A camada realtime possui cobertura separada por responsabilidade.

### 13.1. Autenticação e lifecycle

São verificados:

- handshake autenticado;
- armazenamento da identidade;
- rejeição de tokens inválidos;
- sessões revogadas;
- usuários inativos;
- múltiplas conexões;
- rooms privadas;
- remoção após disconnect.

### 13.2. Mensagens

`socket-messages.test.js` verifica:

- persistência antes do broadcast;
- distribuição para membros ativos;
- identidade do remetente derivada da autenticação;
- ACK seguro;
- ausência de broadcast em falha;
- sanitização de erro interno;
- reenvio idempotente.

### 13.3. Entrega e leitura

`socket-message-status.test.js` verifica:

- propagação de checkpoint de entrega;
- identidade autenticada;
- propagação de checkpoint de leitura;
- não regressão;
- redistribuição do estado autoritativo;
- ausência de broadcast quando ocorre erro de autorização.

### 13.4. Sincronização

`socket-sync.test.js` verifica:

- identidade derivada da conexão autenticada;
- sincronização incremental;
- snapshot sem cursor;
- sanitização de erros internos.

A integração real também verifica:

- retorno somente de mensagens posteriores ao cursor;
- bloqueio de usuário sem membership;
- paginação incremental de mensagens perdidas.

### 13.5. Reconexão

`socket-reconnection.test.js` verifica:

- queda real de transporte;
- reconexão automática;
- nova autenticação;
- retorno do usuário ao registry;
- emissão de `realtime:ready`;
- continuidade do `realtime:sync` após reconexão.

---

## 14. Configuração do ambiente de testes

Os testes da API utilizam valores fictícios para configurações sensíveis, incluindo `JWT_SECRET`.

Esses valores existem exclusivamente para validação automatizada e não devem ser reutilizados nos ambientes publicados.

Os testes que dependem de PostgreSQL e MongoDB reais utilizam a configuração do ambiente de desenvolvimento.

É importante manter separados:

- segredos de desenvolvimento;
- segredos utilizados nos testes;
- credenciais de produção.

Arquivos `.env` com credenciais não devem ser incluídos no repositório.

---

## 15. Resultado das validações recentes

Os resultados abaixo correspondem às execuções confirmadas durante o fechamento da comunicação realtime e sincronização após reconexão.

| Suíte | Executados | Aprovados | Falhas |
|---|---:|---:|---:|
| Integração | 69 | 69 | 0 |
| Realtime | 36 | 36 | 0 |

Também foram validados individualmente:

- `socket-messages.test.js`: 5 testes aprovados;
- `socket-message-status.test.js`: 5 testes aprovados;
- `socket-sync.test.js`: 4 testes aprovados;
- `socket-reconnection.test.js`: 2 testes aprovados.

Os totais gerais das suítes de integridade, consultas e API devem ser atualizados quando for executada a regressão completa mais recente através de:

```bash
npm test
```

Esta seção deve registrar apenas resultados efetivamente executados e confirmados, evitando totais estimados.

---

## 16. Procedimento recomendado antes de Pull Requests

Antes de integrar alterações ao repositório principal:

1. confirmar que as migrations necessárias estão aplicadas;
2. confirmar que os containers necessários estão disponíveis;
3. executar os testes relacionados à funcionalidade modificada;
4. executar `npm test`;
5. corrigir todas as falhas identificadas;
6. inspecionar arquivos modificados e não rastreados;
7. executar `git diff --check`;
8. revisar a presença de dados sensíveis;
9. atualizar a documentação correspondente;
10. revisar o staging antes do commit;
11. registrar os resultados da validação no Pull Request.

A aprovação dos testes constitui evidência de validação, mas não substitui revisão de código, autorização, segurança e coerência arquitetural.

---

## 17. Evolução dos testes

Sempre que uma nova funcionalidade for incorporada, deverá ser avaliada a necessidade de adicionar:

- testes de comportamento esperado;
- testes de validação de entrada;
- testes de falha e tratamento de erros;
- testes de autenticação e autorização;
- testes de integração quando houver persistência;
- testes de concorrência quando houver atualização compartilhada;
- testes de reconexão quando houver comportamento distribuído ou realtime;
- testes de regressão das funcionalidades relacionadas.

A suíte automatizada deve evoluir juntamente com os serviços, contratos HTTP e eventos Socket.IO.

---

## 18. Documentação relacionada

- [Visão geral da API](README.md)
- [Autenticação e gerenciamento de sessões](AUTHENTICATION.md)
- [Solicitação de cadastro](REGISTRATION.md)
- [Dashboard](DASHBOARD.md)
- [Conversas](CONVERSATION.md)
- [Grupos](GROUPS.md)
- [Mensagens, entrega e leitura](MESSAGES.md)
- [Comunicação em tempo real](REALTIME.md)
- [Arquitetura de persistência](../persistence/README.md)

A manutenção contínua desses documentos contribui para a rastreabilidade das decisões técnicas, a padronização do desenvolvimento e a qualidade das entregas do Corporate Chat.

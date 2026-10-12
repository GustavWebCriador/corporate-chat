# Corporate Chat — Autenticação e Gerenciamento de Sessões

## 1. Objetivo

Este documento descreve a arquitetura de autenticação, autorização e gerenciamento de sessões do Corporate Chat.

A implementação utiliza JWT para identificação de usuários e PostgreSQL para persistência e revogação de sessões.

O objetivo é permitir autenticação segura, validação de permissões atualizadas e encerramento efetivo de sessões, mesmo antes do vencimento natural do token.

## 2. Arquitetura da autenticação

A implementação está distribuída em componentes com responsabilidades específicas.

| Componente | Responsabilidade |
|---|---|
| `authRoutes.js` | Registrar os endpoints de autenticação |
| `authController.js` | Processar requisições e respostas HTTP |
| `authService.js` | Executar as regras de autenticação e revogação |
| `jwt.js` | Assinar e verificar tokens JWT |
| `authenticate.js` | Validar autenticação e autorização |
| `authSessionRepository.js` | Criar, consultar e revogar sessões |
| `AuthSession.js` | Representar sessões por meio do Sequelize |
| PostgreSQL | Persistir o estado das sessões |

O controle de sessões mantém uma relação entre o token apresentado pelo cliente e um registro persistido no banco de dados.

## 3. Login e criação de sessão

### 3.1. Endpoint

**`POST /api/v1/auth/login`**

Não exige autenticação prévia.

### 3.2. Corpo da requisição

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `email` | string | Sim | E-mail cadastrado do usuário |
| `password` | string | Sim | Senha do usuário |

Exemplo de corpo JSON:

`{"email":"usuario@empresa.com","password":"Senha@123"}`

### 3.3. Processamento

O serviço executa as seguintes etapas:

1. Valida os campos recebidos.
2. Normaliza o e-mail informado.
3. Localiza o usuário.
4. Verifica a senha por meio do hash armazenado.
5. Confirma se o usuário está ativo.
6. Gera um identificador UUID exclusivo para a sessão.
7. Emite o JWT contendo o identificador `jti`.
8. Registra a sessão no PostgreSQL com a data de expiração.
9. Atualiza a informação de último acesso do usuário.
10. Retorna o token e os dados públicos necessários ao cliente.

**Regra de segurança:** a aplicação não deve disponibilizar um JWT ao cliente quando ocorrer falha na persistência da sessão.

### 3.4. Resposta bem-sucedida

**HTTP 200 OK**

A resposta possui um objeto `data` com as informações principais:

| Campo | Descrição |
|---|---|
| `token` | JWT para autenticação |
| `tokenType` | Tipo de autenticação, `Bearer` |
| `expiresIn` | Duração de validade, em segundos |
| `user` | Dados públicos do usuário autenticado |

O hash da senha nunca deve integrar a resposta.

## 4. Estrutura e validação do JWT

Os tokens são assinados utilizando o algoritmo **HS256**.

As informações principais são:

| Claim | Responsabilidade |
|---|---|
| `sub` | UUID do usuário autenticado |
| `jti` | UUID exclusivo da sessão |
| `is_admin` | Informação de perfil no momento da emissão |
| `iss` | Identificador do emissor, `corporate-chat` |
| `iat` | Momento da emissão |
| `exp` | Momento da expiração |

A configuração depende da variável `JWT_SECRET`.

O tempo de expiração pode ser configurado por `JWT_EXPIRES_IN`. Na ausência dessa configuração, o padrão implementado é de uma hora.

A API valida assinatura, algoritmo, emissor e expiração, além da integridade dos identificadores esperados.

O campo `jti` é obrigatório para vincular o JWT a uma sessão registrada.

**Importante:** o JWT identifica a sessão, mas não substitui a consulta ao estado atual do usuário e da sessão no banco.

## 5. Persistência das sessões

### 5.1. Banco de dados

O gerenciamento de sessões utiliza o PostgreSQL por meio do Sequelize.

**Tabela: `auth_sessions`**

| Campo | Tipo lógico | Finalidade |
|---|---|---|
| `session_id` | UUID | Chave primária; corresponde ao `jti` |
| `user_id` | UUID | Identificador do usuário |
| `expires_at` | data/hora | Expiração da sessão |
| `revoked_at` | data/hora, nullable | Momento da revogação |
| `created_at` | data/hora | Registro de criação |

A estrutura definitiva, incluindo restrições e índices, é definida pela migration e pelo model Sequelize.

### 5.2. Regras de relacionamento

Cada sessão pertence a um usuário.

Um usuário pode possuir múltiplas sessões, permitindo autenticação em dispositivos ou navegadores diferentes.

O campo `user_id` possui vínculo com o cadastro de usuários.

### 5.3. Estados de sessão

**Ativa:** sessão existente, ainda não revogada e com expiração futura.

**Revogada:** sessão com `revoked_at` preenchido.

**Expirada:** sessão cuja data `expires_at` já foi atingida ou ultrapassada.

A revogação impede novas autenticações com o token correspondente, mesmo que a assinatura JWT continue criptograficamente válida.

### 5.4. Operações de persistência

O `authSessionRepository` fornece operações para:

- Criar uma sessão (`createSession`).
- Localizar uma sessão pelo identificador (`findSessionById`).
- Revogar uma sessão específica (`revokeSession`).

A revogação considera o identificador da sessão e o usuário proprietário.

## 6. Validação de requisições autenticadas

Os endpoints protegidos utilizam o cabeçalho HTTP:

`Authorization: Bearer <JWT>`

O processo de autenticação compreende:

1. Extrair o token do cabeçalho.
2. Validar assinatura e claims do JWT.
3. Verificar a presença de `sub` e `jti` válidos.
4. Consultar a sessão no PostgreSQL.
5. Confirmar que a sessão pertence ao usuário identificado.
6. Confirmar que a sessão não foi revogada.
7. Confirmar que a sessão não expirou.
8. Consultar os dados atuais do usuário.
9. Verificar se o usuário permanece ativo.
10. Liberar a execução da operação solicitada.

A ausência de uma sessão correspondente impede a utilização do JWT.

## 7. Consulta ao usuário autenticado

### 7.1. Endpoint

**`GET /api/v1/auth/me`**

Exige JWT válido e sessão ativa.

### 7.2. Finalidade

Retornar os dados públicos e atuais do usuário autenticado.

Esse endpoint permite que o frontend identifique o usuário associado à sessão e obtenha seu estado atual.

### 7.3. Resposta

**HTTP 200 OK**

A resposta contém `data.user`.

Informações sensíveis, como o hash da senha, não devem ser expostas.

## 8. Logout e revogação de sessão

### 8.1. Endpoint

**`POST /api/v1/auth/logout`**

Exige autenticação.

### 8.2. Requisição

Cabeçalho obrigatório:

`Authorization: Bearer <JWT>`

Não é necessário enviar um corpo JSON.

### 8.3. Processamento

O serviço executa:

1. Autenticação do JWT recebido.
2. Identificação da sessão pelo claim `jti`.
3. Confirmação de que a sessão pertence ao usuário.
4. Revogação da sessão correspondente.
5. Registro da data de revogação no PostgreSQL.
6. Retorno da resposta HTTP de sucesso.

### 8.4. Resposta de sucesso

**HTTP 204 No Content**

A resposta não possui corpo.

O endpoint define `Cache-Control: no-store`.

### 8.5. Comportamento após logout

O token revogado deixa de ser aceito nos endpoints protegidos.

Uma nova tentativa de utilizar o token resulta em erro de autenticação.

Efetuar logout novamente utilizando o mesmo token revogado também resulta em erro.

### 8.6. Independência entre sessões

O encerramento de uma sessão não implica o encerramento automático das outras sessões pertencentes ao mesmo usuário.

Exemplo:

- Sessão A: navegador do computador.
- Sessão B: navegador de outro dispositivo.
- Logout realizado pela sessão A.
- Sessão A: revogada.
- Sessão B: permanece válida, desde que satisfaça as demais regras de autenticação.

Essa característica permite controlar individualmente as sessões autenticadas.

## 9. Autorização administrativa

A autenticação confirma a identidade do usuário; a autorização determina as operações permitidas.

Rotas administrativas exigem a aplicação das verificações de autenticação e privilégio administrativo.

O sistema consulta a condição atual do usuário no banco.

Consequentemente:

- Um usuário sem privilégio administrativo recebe acesso negado às rotas administrativas.
- Um usuário que recebe permissão administrativa pode utilizar as permissões atualizadas sem depender exclusivamente da claim antiga do JWT.
- Um usuário desativado perde acesso às rotas protegidas, mesmo quando possui um JWT ainda não expirado.

## 10. Códigos HTTP e erros

| HTTP | Código da aplicação | Significado |
|---|---|---|
| 200 | — | Login ou consulta autenticada realizada com sucesso |
| 204 | — | Sessão encerrada com sucesso |
| 400 | `VALIDATION_ERROR` | Dados da requisição inválidos |
| 401 | `INVALID_CREDENTIALS` | Credenciais de login inválidas |
| 401 | `TOKEN_MISSING` | Token não informado |
| 401 | `TOKEN_INVALID` | JWT inválido, não reconhecido ou sem identificador válido |
| 401 | `TOKEN_EXPIRED` | JWT expirado |
| 401 | `TOKEN_REVOKED` | Sessão anteriormente revogada |
| 403 | `USER_INACTIVE` | Usuário inativo |
| 403 | `ADMIN_REQUIRED` | Operação exige autorização administrativa |
| 500 | `INTERNAL_ERROR` | Falha interna da aplicação |

As respostas de erro utilizam o padrão adotado pela API, com `error.code`, `error.message` e, quando aplicável, `error.details`.

## 11. Regras de segurança

A implementação adota as seguintes regras:

- Não expor o hash da senha nas respostas.
- Não incluir dados sensíveis desnecessários no JWT.
- Utilizar segredo de assinatura configurado por ambiente.
- Restringir os algoritmos JWT aceitos.
- Verificar a validade e a origem do token.
- Rejeitar tokens sem `jti` válido.
- Persistir cada sessão antes de retornar o JWT ao cliente.
- Validar a sessão em requisições protegidas.
- Verificar o estado atual do usuário.
- Não confiar exclusivamente na claim `is_admin`.
- Impedir reutilização de tokens revogados.
- Encerrar somente a sessão selecionada no logout.
- Não armazenar tokens ou senhas diretamente nos registros da tabela de sessões.

O frontend deve remover o token de seu armazenamento após receber a confirmação de logout.

O uso de HTTPS é necessário nos ambientes publicados para proteger o tráfego de autenticação.

## 12. Limitações e evolução futura

A implementação atual realiza revogação individual das sessões.

Melhorias que poderão ser consideradas posteriormente incluem:

- Encerrar todas as sessões de um usuário.
- Listar dispositivos ou sessões autenticadas.
- Limpeza periódica de sessões expiradas.
- Revogação automática de sessões em eventos adicionais de segurança.
- Monitoramento e auditoria de eventos de autenticação.
- Proteção adicional contra tentativas repetidas de login.

Esses itens representam possibilidades de evolução e não devem ser interpretados como funcionalidades já implementadas.

## 13. Arquivos de implementação

| Arquivo | Responsabilidade |
|---|---|
| `backend/src/config/jwt.js` | Assinatura e validação do JWT |
| `backend/src/services/auth/authService.js` | Login, autenticação e logout |
| `backend/src/controllers/authController.js` | Operações HTTP de autenticação |
| `backend/src/routes/v1/authRoutes.js` | Rotas de autenticação |
| `backend/src/middlewares/authenticate.js` | Proteção das rotas |
| `backend/src/models/postgres/AuthSession.js` | Model Sequelize |
| `backend/src/repositories/postgres/authSessionRepository.js` | Persistência e revogação de sessões |
| `database/postgres/migrations/20261010210453-create-auth-sessions.js` | Migration da tabela de sessões |

## 14. Testes e validação

A autenticação e o controle de sessões são verificados por testes automatizados da API e de integração com PostgreSQL.

**Referência:** [Guia de testes automatizados](TESTING.md)

A implementação de sessões foi validada com testes de login, criação de sessões, revogação, acesso após logout, sessões simultâneas e persistência real no PostgreSQL.

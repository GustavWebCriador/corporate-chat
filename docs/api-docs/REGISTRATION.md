# Corporate Chat — Solicitação de Cadastro

## 1. Objetivo

Este documento descreve o fluxo de **Solicitação de Cadastro** do Corporate Chat, implementado no backend pela **BE-05** e relacionado ao requisito funcional **RF04**.

O objetivo desse fluxo é permitir que uma pessoa ainda não cadastrada solicite acesso ao sistema sem que isso resulte na criação automática de uma conta.

Uma solicitação de cadastro deve ser analisada por um administrador antes que o usuário possa utilizar o Corporate Chat.

O fluxo segue as seguintes regras gerais:

- uma pessoa não cadastrada pode enviar uma solicitação de acesso;
- toda nova solicitação é criada inicialmente com status `PENDING`;
- a criação da solicitação não cria um usuário automaticamente;
- a criação da solicitação não autentica o solicitante;
- somente um administrador autenticado pode aprovar ou rejeitar uma solicitação;
- a aprovação cria o usuário correspondente;
- a rejeição não cria usuário;
- somente após a aprovação e criação da conta o usuário poderá realizar login utilizando suas credenciais.

### Situação da implementação

A implementação backend da **BE-05 encontra-se concluída**.

Ela contempla:

- criação pública da solicitação;
- consulta administrativa;
- aprovação;
- rejeição;
- criação do usuário após aprovação;
- regras de integridade;
- segurança;
- controle de concorrência;
- transações;
- rollback;
- testes automatizados.

A conclusão integral do **RF04 no produto** ainda depende da implementação da interface correspondente no frontend, responsável por disponibilizar visualmente ao usuário a opção de solicitar cadastro e os respectivos fluxos administrativos.

---

## 2. Fluxo de solicitação

O fluxo geral da solicitação de cadastro é:

```text
Pessoa não cadastrada
        │
        ▼
POST /api/v1/registration-requests
        │
        ▼
     PENDING
        │
        ▼
Administrador analisa
      /       \
     /         \
 APPROVED     REJECTED
     │           │
     ▼           ▼
Usuário        Nenhum
ACTIVE         usuário
criado         criado
     │
     ▼
Login permitido
```

A criação de uma solicitação não representa autorização de acesso.

Enquanto a solicitação permanecer como `PENDING`, nenhuma conta é criada para o solicitante.

O administrador pode então tomar uma das seguintes decisões:

- **APPROVED:** a solicitação é aprovada e um novo usuário é criado;
- **REJECTED:** a solicitação é rejeitada e nenhum usuário é criado.

---

## 3. Estados da solicitação

Uma solicitação de cadastro pode possuir três estados:

```text
PENDING
APPROVED
REJECTED
```

### 3.1. PENDING

Representa uma solicitação enviada e que ainda não foi analisada por um administrador.

Nesse estado:

```text
status            = PENDING
reviewed_at       = NULL
reviewed_by       = NULL
rejection_reason  = NULL
created_user_id   = NULL
```

Nenhum usuário é criado enquanto a solicitação estiver pendente.

---

### 3.2. APPROVED

Representa uma solicitação aprovada por um administrador.

Nesse estado:

```text
status            = APPROVED
reviewed_at       != NULL
reviewed_by       != NULL
rejection_reason  = NULL
created_user_id   != NULL
```

O campo `created_user_id` referencia o usuário criado como consequência da aprovação.

A aprovação somente é considerada concluída quando tanto o usuário quanto a atualização da solicitação são persistidos com sucesso.

---

### 3.3. REJECTED

Representa uma solicitação analisada e recusada por um administrador.

Nesse estado:

```text
status            = REJECTED
reviewed_at       != NULL
reviewed_by       != NULL
rejection_reason  != NULL
created_user_id   = NULL
```

O motivo da rejeição deve possuir conteúdo válido e não pode ser vazio.

Nenhum usuário é criado para uma solicitação rejeitada.

---

## 4. Solicitação pública de cadastro

### 4.1. Endpoint

```http
POST /api/v1/registration-requests
```

### 4.2. Autenticação

Não é necessária autenticação.

Esse endpoint é público porque é destinado justamente a pessoas que ainda não possuem conta no Corporate Chat.

---

### 4.3. Corpo da requisição

Exemplo:

```json
{
  "name": "Maria Silva",
  "email": "maria@empresa.com"
}
```

Campos aceitos:

| Campo | Obrigatório | Limite | Descrição |
|---|---|---:|---|
| `name` | Sim | 150 caracteres | Nome da pessoa solicitante |
| `email` | Sim | 150 caracteres | E-mail utilizado para identificação |

---

### 4.4. Normalização

Antes da validação, os dados passam por normalização.

O nome:

- tem espaços externos removidos;
- sequências de espaços internos são normalizadas.

O e-mail:

- tem espaços externos removidos;
- é convertido para letras minúsculas.

Exemplo:

```text
Entrada:
  "  Maria   Silva  "
  "Maria@Empresa.COM"

Resultado:
  "Maria Silva"
  "maria@empresa.com"
```

---

### 4.5. Regras

Uma nova solicitação:

- sempre é criada com status `PENDING`;
- não cria usuário automaticamente;
- não concede autenticação;
- não permite que o cliente determine o status;
- não permite que o cliente determine privilégios administrativos;
- não utiliza campos adicionais enviados pelo cliente para alterar o fluxo de aprovação.

Campos adicionais como:

```text
status
is_admin
password
```

não são utilizados para definir o estado inicial da solicitação.

---

### 4.6. Usuário já cadastrado

Uma solicitação não pode ser criada quando já existe um usuário utilizando o mesmo e-mail.

Nesse caso, a operação é rejeitada com conflito de dados.

Código de erro:

```text
EMAIL_ALREADY_EXISTS
```

---

### 4.7. Solicitação pendente duplicada

Não é permitida mais de uma solicitação `PENDING` para o mesmo e-mail.

Código de erro:

```text
REGISTRATION_REQUEST_ALREADY_PENDING
```

Essa regra é protegida tanto pela camada de serviço quanto pelo PostgreSQL.

---

### 4.8. Resposta

Uma solicitação criada com sucesso retorna:

```text
HTTP 201 Created
```

A visualização pública retorna somente os dados necessários ao solicitante:

```text
request_id
name
email
status
requested_at
```

Dados internos da análise administrativa não são expostos nessa resposta.

---

## 5. Listagem administrativa

### 5.1. Endpoint

```http
GET /api/v1/admin/registration-requests
```

### 5.2. Autenticação e autorização

A rota administrativa exige:

```text
JWT válido
        +
usuário ACTIVE
        +
is_admin = true
```

As rotas administrativas utilizam os middlewares:

```text
authenticate
requireAdmin
```

Um usuário comum não pode acessar a listagem ou analisar solicitações.

---

### 5.3. Parâmetros

A listagem aceita:

```text
status
limit
offset
```

#### status

Valores permitidos:

```text
PENDING
APPROVED
REJECTED
ALL
```

Quando não informado:

```text
status = PENDING
```

#### limit

Faixa permitida:

```text
1 até 100
```

Valor padrão:

```text
20
```

#### offset

Faixa permitida:

```text
0 até 1000000
```

Valor padrão:

```text
0
```

---

### 5.4. Ordenação

As solicitações são apresentadas da mais antiga para a mais recente.

Esse comportamento permite que o administrador visualize primeiro as solicitações que aguardam análise há mais tempo.

---

### 5.5. Finalidade

A listagem administrativa é utilizada para permitir que o administrador identifique solicitações e tome uma decisão sobre cada uma delas.

A visualização administrativa pode incluir:

```text
request_id
name
email
status
requested_at
reviewed_at
reviewed_by
rejection_reason
created_user_id
```

---

## 6. Aprovação da solicitação

### 6.1. Endpoint

```http
POST /api/v1/admin/registration-requests/:requestId/approve
```

A operação exige autenticação e privilégios administrativos.

---

### 6.2. Corpo da requisição

```json
{
  "password": "SenhaInicial1"
}
```

A senha informada será utilizada como senha inicial do novo usuário.

---

### 6.3. Validação da senha

A senha utiliza a política compartilhada do backend.

Atualmente são verificadas as seguintes regras:

- mínimo de 8 caracteres;
- máximo de 128 caracteres;
- pelo menos uma letra maiúscula;
- pelo menos um número.

A senha nunca é persistida em texto puro.

---

### 6.4. Fluxo interno da aprovação

O fluxo executado pelo backend é:

```text
1. Validar o requestId.
2. Validar a senha informada.
3. Gerar o hash bcrypt da senha.
4. Iniciar a transação PostgreSQL.
5. Buscar a solicitação com bloqueio para atualização.
6. Confirmar que a solicitação ainda está PENDING.
7. Normalizar novamente o e-mail.
8. Confirmar que ainda não existe usuário com o e-mail.
9. Criar o novo usuário dentro da transação.
10. Atualizar a solicitação para APPROVED.
11. Registrar reviewed_by.
12. Registrar reviewed_at.
13. Registrar created_user_id.
14. Finalizar a transação com sucesso.
```

O hash da senha é calculado **antes da abertura da transação**, evitando manter o bloqueio do banco durante o processamento do bcrypt.

A criação do usuário e a atualização da solicitação são executadas dentro da mesma transação.

---

### 6.5. Usuário criado

O usuário criado através da aprovação recebe:

```text
status   = ACTIVE
is_admin = false
```

O solicitante não recebe privilégios administrativos automaticamente.

---

### 6.6. Atomicidade

A criação do usuário e a aprovação da solicitação são tratadas como uma única operação lógica.

O comportamento esperado é:

```text
Usuário criado
        +
Solicitação APPROVED
        │
        ▼
      COMMIT
```

ou, em caso de falha:

```text
Falha em qualquer etapa
        │
        ▼
     ROLLBACK
        │
        ├── usuário não permanece criado
        └── solicitação permanece PENDING
```

Isso evita estados parcialmente persistidos.

---

### 6.7. Solicitação já analisada

Somente solicitações com status `PENDING` podem ser aprovadas.

Caso a solicitação já esteja:

```text
APPROVED
```

ou:

```text
REJECTED
```

a nova tentativa de análise é rejeitada.

Código:

```text
REGISTRATION_REQUEST_ALREADY_REVIEWED
```

---

## 7. Rejeição da solicitação

### 7.1. Endpoint

```http
POST /api/v1/admin/registration-requests/:requestId/reject
```

A operação exige autenticação e privilégios administrativos.

---

### 7.2. Corpo da requisição

```json
{
  "reason": "Dados insuficientes."
}
```

---

### 7.3. Regras

O campo:

```text
reason
```

é obrigatório.

Seu tamanho máximo é:

```text
500 caracteres
```

Espaços externos são removidos antes da validação.

Um motivo vazio não é aceito.

---

### 7.4. Resultado da rejeição

Após a rejeição:

```text
status            = REJECTED
reviewed_by       = administrador responsável
reviewed_at       = data/hora da análise
rejection_reason  = motivo informado
created_user_id   = NULL
```

Nenhum usuário é criado.

---

### 7.5. Solicitação rejeitada não pode ser aprovada posteriormente

Uma vez que a solicitação tenha sido analisada e esteja como:

```text
REJECTED
```

ela não pode posteriormente ser alterada para:

```text
APPROVED
```

Uma nova tentativa de análise retorna:

```text
REGISTRATION_REQUEST_ALREADY_REVIEWED
```

---

### 7.6. Nova solicitação após rejeição

A rejeição não bloqueia permanentemente o e-mail.

Depois que uma solicitação foi rejeitada, o mesmo e-mail pode realizar uma nova solicitação.

Exemplo:

```text
Solicitação A
    │
    ▼
 REJECTED
    │
    ▼
Nova solicitação permitida
    │
    ▼
 PENDING
```

Isso é possível porque a regra de unicidade considera somente solicitações com status `PENDING`.

---

## 8. Regras de negócio

As principais regras de negócio relacionadas ao fluxo são:

### REG-R01 — Nova solicitação

Toda nova solicitação deve ser criada com:

```text
status = PENDING
```

---

### REG-R02 — Análise administrativa

Somente usuário autenticado e com privilégio administrativo pode aprovar ou rejeitar solicitações.

---

### REG-R03 — Solicitação aprovada

Uma solicitação `APPROVED` deve possuir:

```text
reviewed_by
reviewed_at
created_user_id
```

e não deve possuir:

```text
rejection_reason
```

---

### REG-R04 — Solicitação rejeitada

Uma solicitação `REJECTED` deve possuir:

```text
reviewed_by
reviewed_at
rejection_reason
```

e não deve possuir:

```text
created_user_id
```

---

### REG-R05 — Criação do usuário

A aprovação da solicitação deve criar e autorizar o usuário antes que ele possa realizar seu primeiro login.

---

### REG-R06 — Solicitação não concede acesso

O simples envio de uma solicitação:

```text
não cria usuário
não autentica
não concede acesso
```

A autorização acontece somente após análise e aprovação administrativa.

---

## 9. Integridade PostgreSQL

Além das validações realizadas pela aplicação, regras críticas da BE-05 são protegidas diretamente pelo PostgreSQL.

Essa estratégia reduz o risco de estados inválidos mesmo em situações de:

- concorrência;
- falhas de aplicação;
- chamadas simultâneas;
- acesso à persistência por diferentes fluxos.

---

### 9.1. Consistência dos estados

Migration:

```text
20261011231000-strengthen-registration-request-state.js
```

Responsabilidade:

garantir a consistência completa entre:

```text
PENDING
APPROVED
REJECTED
```

A constraint:

```text
registration_requests_state_consistency_check
```

garante que cada estado tenha exatamente os dados compatíveis com seu significado.

#### PENDING

```text
reviewed_at       IS NULL
reviewed_by       IS NULL
rejection_reason  IS NULL
created_user_id   IS NULL
```

#### APPROVED

```text
reviewed_at       IS NOT NULL
reviewed_by       IS NOT NULL
rejection_reason  IS NULL
created_user_id   IS NOT NULL
```

#### REJECTED

```text
reviewed_at       IS NOT NULL
reviewed_by       IS NOT NULL
rejection_reason  IS NOT NULL
rejection_reason  não vazio
created_user_id   IS NULL
```

---

### 9.2. Solicitação PENDING única por e-mail

Migration:

```text
20261012120000-unique-pending-registration-email.js
```

Responsabilidade:

impedir que duas solicitações pendentes coexistam para o mesmo e-mail.

O PostgreSQL utiliza um índice único parcial baseado em:

```sql
LOWER(email)
```

aplicado somente quando:

```sql
status = 'PENDING'
```

Conceitualmente:

```sql
UNIQUE LOWER(email)
WHERE status = 'PENDING'
```

Isso fornece proteção case-insensitive.

Exemplo:

```text
usuario@empresa.com
USUARIO@EMPRESA.COM
```

são considerados o mesmo e-mail para a regra de solicitação pendente.

Ao mesmo tempo, solicitações:

```text
APPROVED
REJECTED
```

não fazem parte desse índice.

Por isso, após uma rejeição, uma nova solicitação para o mesmo e-mail continua permitida.

---

## 10. Concorrência e transações

O fluxo de análise administrativa possui proteção contra operações simultâneas.

---

### 10.1. Aprovação transacional

A aprovação utiliza transação PostgreSQL.

Dentro da transação são executadas as operações críticas:

```text
buscar e bloquear solicitação
        │
        ▼
confirmar PENDING
        │
        ▼
validar usuário existente
        │
        ▼
criar usuário
        │
        ▼
marcar solicitação APPROVED
        │
        ▼
COMMIT
```

Se uma etapa falhar:

```text
ROLLBACK
```

é executado pelo mecanismo transacional.

---

### 10.2. Bloqueio da solicitação

A solicitação é consultada para atualização dentro da transação.

Esse comportamento impede que duas análises concorrentes processem a mesma solicitação como válida ao mesmo tempo.

---

### 10.3. Duas aprovações simultâneas

Quando duas aprovações são realizadas simultaneamente:

```text
Aprovação A ──┐
              ├── mesma solicitação
Aprovação B ──┘
```

o resultado esperado é:

```text
1 aprovação concluída
1 aprovação rejeitada
1 usuário criado
```

A segunda operação encontra a solicitação já analisada e retorna:

```text
REGISTRATION_REQUEST_ALREADY_REVIEWED
```

---

### 10.4. Duas solicitações públicas simultâneas

A camada de serviço verifica previamente se já existe uma solicitação pendente.

Entretanto, duas requisições simultâneas poderiam executar essa consulta praticamente no mesmo instante.

Por isso existe também a proteção no PostgreSQL através do índice único parcial.

O resultado esperado é:

```text
2 requisições simultâneas
        │
        ▼
1 PENDING criada
1 requisição rejeitada
```

Código de negócio:

```text
REGISTRATION_REQUEST_ALREADY_PENDING
```

---

### 10.5. Rollback

Existe teste de integração específico para comprovar que uma falha ocorrida depois da criação do usuário, mas antes da conclusão da aprovação, não deixa dados parcialmente persistidos.

Resultado esperado:

```text
falha durante aprovação
        │
        ▼
ROLLBACK
        │
        ├── usuário removido pela transação
        └── solicitação continua PENDING
```

---

## 11. Segurança

A BE-05 utiliza os mecanismos de segurança já existentes no backend do Corporate Chat.

---

### 11.1. Proteção das rotas administrativas

As rotas:

```text
GET  /api/v1/admin/registration-requests
POST /api/v1/admin/registration-requests/:requestId/approve
POST /api/v1/admin/registration-requests/:requestId/reject
```

utilizam:

```text
authenticate
requireAdmin
```

Portanto:

```text
sem autenticação → acesso negado
usuário comum    → acesso negado
administrador    → operação permitida
```

---

### 11.2. Identificação do administrador

O administrador responsável pela análise não é informado pelo cliente.

O controller utiliza:

```javascript
req.user.user_id
```

como identificador do responsável.

Assim:

```text
reviewed_by
```

não pode ser definido arbitrariamente pelo body da requisição.

---

### 11.3. Proteção da senha

A senha inicial:

- utiliza a política compartilhada de senhas do backend;
- é processada com `bcrypt`;
- utiliza custo configurado de 12 rounds;
- não é armazenada em texto puro;
- é persistida somente através do campo `password_hash`;
- não é retornada na representação pública do usuário.

---

### 11.4. Privilégios do usuário criado

Usuários criados através da aprovação recebem obrigatoriamente:

```text
is_admin = false
```

A aprovação de uma solicitação pública não pode ser utilizada para criar administradores.

---

## 12. Testes automatizados

A BE-05 possui cobertura automatizada em três níveis principais:

```text
API
Integração PostgreSQL
Integridade PostgreSQL
```

---

### 12.1. Testes da API

Arquivo:

```text
backend/tests/api/registration-requests.test.js
```

Responsabilidade:

validar o comportamento HTTP da funcionalidade.

Entre os cenários verificados estão:

- criação pública da solicitação;
- criação automática como `PENDING`;
- normalização dos dados;
- campos extras ignorados;
- validação de payload;
- usuário já existente;
- solicitação pendente duplicada;
- autenticação das rotas administrativas;
- autorização administrativa;
- listagem com filtro;
- paginação;
- aprovação;
- validação da senha;
- criação de usuário `ACTIVE`;
- usuário criado sem privilégio administrativo;
- login após aprovação;
- rejeição;
- obrigatoriedade do motivo;
- tentativa de analisar solicitação já revisada;
- UUID inválido;
- solicitação inexistente;
- e-mail com exatamente 150 caracteres;
- rejeição de e-mail com 151 caracteres;
- motivo com exatamente 500 caracteres;
- rejeição de motivo com 501 caracteres.

---

### 12.2. Testes de integração PostgreSQL

Arquivo:

```text
backend/database/tests/integration/registration-requests-integration.test.js
```

Responsabilidade:

validar a BE-05 utilizando PostgreSQL real.

Os cenários incluem:

```text
aprovação real
rejeição real
rollback
aprovação concorrente
solicitação pública concorrente
```

Esses testes comprovam que a integração entre:

```text
service
repository
Sequelize
PostgreSQL
```

funciona de acordo com as regras da funcionalidade.

---

### 12.3. Testes de integridade PostgreSQL

Arquivo:

```text
backend/database/tests/integrity/postgres-integrity.test.js
```

Responsabilidade:

validar diretamente as regras de integridade protegidas pelo banco.

Entre os cenários relacionados à solicitação de cadastro estão:

- `PENDING` válida;
- `APPROVED` válida;
- `REJECTED` válida;
- `APPROVED` sem dados de revisão;
- `REJECTED` sem motivo;
- `REJECTED` sem `reviewed_by`;
- `reviewed_by` inexistente;
- `created_user_id` inexistente;
- `PENDING` com dados de revisão;
- `PENDING` com `created_user_id`;
- `APPROVED` sem `created_user_id`;
- `APPROVED` com `rejection_reason`;
- `REJECTED` com `created_user_id`;
- e-mail com 150 caracteres;
- rejeição de e-mail com 151 caracteres;
- unicidade de solicitação `PENDING` por e-mail.

---

## 13. Validação final

Após a conclusão da implementação técnica da BE-05, o ambiente de desenvolvimento foi reconstruído completamente utilizando:

```bash
npm run env:fresh -- --confirm
```

O processo realizou:

```text
remoção dos containers e volumes
        │
        ▼
recriação do PostgreSQL e MongoDB
        │
        ▼
execução de todas as migrations
        │
        ▼
execução dos seeds
        │
        ▼
sincronização dos índices
        │
        ▼
verificação da massa de desenvolvimento
        │
        ▼
health checks
        │
        ▼
queries críticas
        │
        ▼
suíte automatizada completa
```

As migrations da aplicação foram aplicadas com sucesso, incluindo:

```text
20261011231000-strengthen-registration-request-state.js
20261012120000-unique-pending-registration-email.js
```

Após a reconstrução completa do ambiente, foi executado:

```bash
npm test
```

Resultado:

| Suíte | Executados | Aprovados | Falhas |
|---|---:|---:|---:|
| Integridade PostgreSQL e MongoDB | 37 | 37 | 0 |
| Integração com persistência | 22 | 22 | 0 |
| Consultas de persistência | 5 | 5 | 0 |
| API | 76 | 76 | 0 |
| **Total** | **140** | **140** | **0** |

Resultado final:

```text
140 testes executados
140 testes aprovados
0 falhas
0 cancelados
0 ignorados
```

A reconstrução do ambiente também confirmou:

- PostgreSQL disponível;
- MongoDB disponível;
- migrations executadas desde um banco vazio;
- seeds de desenvolvimento válidos;
- índices MongoDB sincronizados;
- integração lógica PostgreSQL ↔ MongoDB válida;
- queries críticas válidas;
- regras de integridade da BE-05 válidas;
- rollback funcionando;
- concorrência controlada;
- ausência de regressões detectadas pela suíte automatizada.

---

## 14. Situação da entrega

A situação da BE-05 no backend é:

```text
Criação pública da solicitação          ✅
Status PENDING automático               ✅
Validação de nome e e-mail              ✅
E-mail máximo de 150 caracteres         ✅
Bloqueio de usuário existente           ✅
Bloqueio de PENDING duplicada           ✅
Listagem administrativa                 ✅
Autenticação administrativa             ✅
Autorização administrativa              ✅
Aprovação                               ✅
Rejeição                                ✅
Criação do usuário após aprovação       ✅
Senha protegida com bcrypt              ✅
Usuário criado como ACTIVE              ✅
Usuário criado sem privilégio admin     ✅
Transação PostgreSQL                    ✅
Rollback                                ✅
Controle de concorrência                ✅
Constraints PostgreSQL                  ✅
Foreign keys                            ✅
Testes de API                           ✅
Testes de integração                    ✅
Testes de integridade                   ✅
Regressão completa                      ✅
Ambiente reconstruído do zero           ✅
```

Portanto:

```text
BE-05 — Backend: CONCLUÍDA
```

A conclusão completa do RF04 no produto dependerá também da implementação da interface correspondente no frontend, incluindo a apresentação da opção de solicitação de acesso ao usuário.
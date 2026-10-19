# Contribuindo com o Corporate Chat

## 1. Objetivo

Este documento define o fluxo de desenvolvimento, revisão e integração utilizado no projeto **Corporate Chat**.

As alterações destinadas à branch `main` devem ser realizadas por meio de branches próprias e Pull Requests.

O objetivo é manter o desenvolvimento organizado, rastreável e compatível com o trabalho realizado pelos demais integrantes da equipe.

---

## 2. Fluxo de desenvolvimento

O fluxo padrão do projeto é:

```text
main atualizada
      │
      ▼
branch da tarefa
      │
      ▼
implementação
      │
      ▼
testes locais
      │
      ▼
push
      │
      ▼
Pull Request
      │
      ▼
CI
      │
      ▼
revisão por outro integrante da equipe
      │
      ▼
merge
```

Alterações destinadas à `main` devem passar por esse fluxo antes de serem consideradas integradas ao projeto.

---

## 3. Antes de iniciar uma tarefa

Antes de iniciar uma nova atividade, atualize a branch principal:

```bash
git switch main
git pull --ff-only origin main
git status
```

Confirme que a `main` está sincronizada antes de criar a nova branch.

A branch da tarefa deve ser criada a partir dessa versão atualizada.

Exemplo:

```bash
git switch -c feat/BE-XX-descricao
```

---

## 4. Nomenclatura de branches

As branches devem indicar claramente o tipo e o objetivo da alteração.

### Funcionalidades

```text
feat/BE-XX-descricao
```

Exemplo:

```text
feat/BE-07-conversas-privadas-historico
```

### Correções

```text
fix/descricao
```

### Testes

```text
test/descricao
```

### Documentação

```text
docs/descricao
```

### Infraestrutura, CI e governança

```text
chore/descricao
```

Exemplo:

```text
chore/ci-governance
```

Branches já concluídas podem permanecer no repositório para fins de controle histórico do projeto.

---

## 5. Commits

As mensagens de commit devem indicar claramente a intenção da alteração.

O padrão recomendado é:

```text
tipo(escopo): descrição
```

Exemplos:

```text
feat(dashboard): expose authenticated dashboard API
fix(auth): reject inactive user session
test(messages): add authorization coverage
docs(api): document conversation endpoints
ci: add backend validation workflow
docs(governance): define contribution and review workflow
```

Evite mensagens genéricas como:

```text
alterações
ajustes
update
teste
corrigido
```

O histórico deve permitir compreender a evolução do projeto sem depender exclusivamente do conteúdo dos arquivos.

---

## 6. Escopo da tarefa

Cada branch deve permanecer restrita ao objetivo para o qual foi criada.

Evite incluir no mesmo Pull Request:

```text
funcionalidade não relacionada
refatoração desnecessária
arquivos temporários
backups
credenciais
alterações experimentais
```

Quando uma nova necessidade independente for identificada, prefira registrá-la separadamente.

---

### 6.1. Convenção de organização do backend

O backend utiliza uma **estrutura híbrida**: `routes`, `controllers`, `models`, `repositories` e `middlewares` são separados por responsabilidade técnica, enquanto os serviços específicos são agrupados por **domínio funcional** dentro de `src/services/`.

Para novos serviços, adote preferencialmente a seguinte organização:

```text
backend/src/
├── controllers/
│   └── conversationController.js
├── routes/v1/
│   └── conversationRoutes.js
├── services/
│   ├── auth/
│   │   └── authService.js
│   ├── conversations/
│   │   └── conversationService.js
│   ├── dashboard/
│   │   └── dashboardService.js
│   ├── integration/
│   │   └── chatPersistenceService.js
│   ├── queries/
│   │   ├── conversationQueryService.js
│   │   └── messageQueryService.js
│   ├── registrationRequests/
│   │   └── registrationRequestService.js
│   └── users/
│       └── userService.js
└── models/
    ├── mongodb/
    └── postgres/
```

A estrutura acima ilustra a **convenção desejada**; uma pasta ou um arquivo de exemplo pode ainda não existir na `main`. Não é necessário mover módulos antigos sem uma justificativa técnica.

#### Responsabilidades

| Camada ou diretório | Responsabilidade |
|---|---|
| `routes/v1/` | Declarar endpoints, middlewares e encaminhar requisições aos controllers. |
| `controllers/` | Interpretar requisições HTTP e encaminhar os resultados e erros para o tratamento padronizado. |
| `services/<dominio>/` | Orquestrar casos de uso e aplicar regras de negócio específicas do domínio. |
| `services/queries/` | Concentrar consultas reutilizáveis, paginação e leitura de dados. |
| `services/integration/` | Coordenar operações de persistência e integração entre bancos ou serviços. |
| `repositories/` | Encapsular operações de acesso a dados quando adotado pelo módulo. |
| `models/` | Definir estruturas, validações e mapeamentos dos dados. |
| `middlewares/` | Implementar preocupações transversais, como autenticação e tratamento de erros. |

#### Reutilização e prevenção de duplicidade

- **Não duplique** consultas ou regras já disponíveis em serviços compartilhados. Antes de criar um novo método, verifique se existe uma implementação equivalente.
- Um serviço de domínio pode **orquestrar** serviços de consulta ou persistência sem reproduzir internamente as mesmas consultas MongoDB/PostgreSQL.
- No domínio de conversas, `conversationService.js` coordena os casos de uso da API, `chatPersistenceService.js` cuida da criação/reutilização, `conversationQueryService.js` centraliza consultas de conversas e `messageQueryService.js` fornece o histórico paginado.
- Se um arquivo novo apenas repassar chamadas sem acrescentar regras, adaptação de contrato ou coordenação, avalie se essa camada é realmente necessária; registre a decisão na revisão do PR.
- Preserve contratos, respostas HTTP e comportamento das funcionalidades existentes ao reutilizar ou refatorar um serviço.

#### Alteração de diretórios e imports

- Ao criar um serviço específico, utilize `src/services/<dominio>/` e nomes coerentes com os demais módulos.
- Ao mover arquivos, atualize todos os `require`/imports e testes afetados; em especial, confira caminhos relativos e diferenças entre maiúsculas e minúsculas em ambientes Linux.
- Não mova arquivos compartilhados nem reorganize todo o backend como parte de uma BE específica sem necessidade: refatorações amplas devem ser discutidas e, quando independentes, propostas em PR próprio.
- Confirme o resultado com `node --check` nos arquivos alterados, `npm test` e `git diff --check` antes de solicitar a integração.

**Critério de revisão:** o Pull Request deve demonstrar organização coerente por domínio, responsabilidade única por módulo, reutilização de lógica existente e ausência de mudanças estruturais fora do escopo da tarefa.

---

## 7. Antes do push

Antes de enviar alterações para o repositório remoto, revise o estado da branch.

Para alterações do backend:

```bash
cd backend
npm test
cd ..
git diff --check
git status
```

Também é recomendado verificar:

```bash
git diff --stat
git diff
```

O desenvolvedor deve saber exatamente quais arquivos serão enviados antes de executar o commit e o push.

Nenhuma alteração deve ser enviada deliberadamente com testes quebrados.

---

## 8. Validação de persistência

Quando a alteração envolver persistência, integração entre bancos ou comportamento dependente da massa de desenvolvimento, utilize os scripts existentes do projeto.

Conforme o escopo, podem ser executados:

```bash
npm run env:sync
npm run db:migrate
npm run db:migrate:status
npm run seed:verify
npm run integration:verify
npm run queries:verify
npm run verify:persistence
```

Mudanças estruturais no banco devem permanecer reproduzíveis através dos arquivos versionados do projeto.

---

## 9. Pull Requests

Toda alteração destinada à `main` deve utilizar Pull Request.

O PR deve:

- possuir objetivo claro;
- informar o requisito ou tarefa relacionada quando aplicável;
- estar restrito ao escopo proposto;
- informar os testes executados;
- informar impactos em banco de dados;
- informar alterações relevantes de contrato;
- registrar questões de segurança quando aplicável;
- apresentar evidências quando necessárias;
- atualizar a documentação;
- passar pela integração contínua;
- receber revisão antes do merge.

O template oficial está disponível em:

```text
.github/pull_request_template.md
```

---

## 10. Atualização com a main

Quando a `main` receber alterações enquanto uma branch ainda estiver em desenvolvimento, a branch deve ser atualizada antes da integração quando houver risco de incompatibilidade.

Exemplo:

```bash
git switch main
git pull --ff-only origin main

git switch nome-da-branch
git merge main
```

Após a atualização, execute novamente os testes relevantes.

Conflitos devem ser resolvidos conscientemente, preservando funcionalidades já integradas na `main`.

---

## 11. Revisão

O autor da alteração é responsável pela implementação e pelas evidências apresentadas.

Outro integrante da equipe deve revisar o Pull Request antes do merge.

A revisão deve considerar, conforme aplicável:

- escopo;
- arquitetura;
- regras de negócio;
- autenticação;
- autorização;
- persistência;
- contratos da API;
- exposição de dados;
- tratamento de erros;
- testes;
- regressões;
- documentação.

Comentários bloqueadores devem ser resolvidos antes da integração.

---

## 12. Branch main

A `main` representa a versão oficialmente integrada do projeto.

Não devem ser realizados:

```text
push direto sem o fluxo definido
force push
merge com CI quebrada
versionamento de .env
versionamento de credenciais reais
versionamento de tokens ou segredos
integração de código não revisado
```

A branch principal deve permanecer protegida contra alterações que não cumpram os critérios mínimos definidos pela equipe.

---

## 13. Estratégia de merge

O projeto utiliza preferencialmente **Pull Requests com merge commit**.

Essa estratégia mantém:

```text
commits da implementação
histórico da branch
registro do Pull Request
contexto da integração
```

As branches concluídas podem permanecer no repositório para fins de rastreabilidade e controle acadêmico.

---

## 14. Persistência

Mudanças estruturais devem utilizar os mecanismos versionados já existentes.

### PostgreSQL

```text
migrations
seeders
constraints
indexes
```

### MongoDB

```text
schemas
indexes
seeds
```

Alterações realizadas somente de forma manual no banco local não constituem implementação versionada.

Outro integrante da equipe deve conseguir reproduzir a estrutura utilizando o próprio repositório.

---

## 15. Migrations

Migrations já utilizadas e compartilhadas pela equipe não devem ser editadas para alterar o histórico do banco.

Quando uma mudança estrutural adicional for necessária, crie uma nova migration.

O objetivo é preservar a evolução incremental e reproduzível da estrutura.

---

## 16. Segurança

Não devem ser versionados:

```text
.env
.env.bak
senhas reais
JWT secrets reais
tokens
credenciais de banco
chaves privadas
backups contendo dados sensíveis
```

Dados usados em testes e CI devem utilizar valores fictícios e descartáveis.

Antes do commit, revise o conteúdo dos arquivos novos e modificados.

---

## 17. Documentação

A documentação deve acompanhar mudanças que afetem:

```text
contratos da API
fluxos de autenticação
regras de negócio
persistência
procedimentos de execução
processo de contribuição
comportamento relevante para outros integrantes
```

Quando a alteração não exigir documentação adicional, isso pode ser informado no Pull Request.

---

## 18. Integração contínua

Pull Requests destinados à `main` são validados pela CI configurada em:

```text
.github/workflows/backend-ci.yml
```

A CI executa verificações automatizadas do backend.

Uma falha do workflow deve ser investigada e corrigida antes do merge.

A existência da CI não elimina a responsabilidade do desenvolvedor de executar as verificações locais relacionadas à sua alteração.

---

## 19. Arquivos temporários

Arquivos locais de análise, backups, saídas temporárias e artefatos que não façam parte do produto não devem ser adicionados ao repositório.

Antes do commit, utilize:

```bash
git status
```

e verifique individualmente os arquivos que serão adicionados.

Evite utilizar:

```bash
git add .
```

sem antes compreender todo o conteúdo que será incluído.

Quando possível, adicione explicitamente os arquivos relacionados à tarefa.

---

## 20. Definition of Done

Uma tarefa pode ser considerada concluída quando:

```text
implementação concluída
        +
testes adicionados ou revisados
        +
regressão aprovada
        +
documentação atualizada
        +
CI aprovada
        +
Pull Request revisado
        +
merge na main
```

Quando algum item não se aplicar ao escopo, isso deve estar claro no Pull Request.

---

## 21. Checklist antes do Pull Request

Antes de abrir o PR, confirme:

```text
branch correta
main considerada na integração
escopo revisado
arquivos revisados
nenhum segredo versionado
testes relacionados aprovados
regressão executada
git diff --check aprovado
documentação atualizada
commits compreensíveis
```

---

## 22. Resultado esperado

O processo de contribuição do Corporate Chat busca garantir que cada alteração seja:

```text
identificável
+
revisável
+
testável
+
reproduzível
+
rastreável
+
integrável
```

O objetivo é permitir que a equipe evolua o sistema de forma colaborativa sem depender do conhecimento isolado de um único integrante.

# Marco Git — Encerramento da Etapa de Backend MVP

**Projeto:** Corporate Chat
**Marco:** BE-15 — Consolidação da release do backend (Marco 2)
**Referência:** 08/11/2026
**Situação:** documento preparado; publicação do marco condicionada ao merge da BE-15 e às verificações finais.

## 1. Objetivo

Este documento registra a estratégia de consolidação da etapa de desenvolvimento do **backend MVP do Corporate Chat**, seguindo o mesmo padrão de versionamento adotado no marco de Persistência de Dados.

O objetivo é manter um ponto de referência estável no histórico do Git que identifique o código do backend entregue no Marco 2, acompanhado das evidências de testes, documentação e procedimentos operacionais.

São utilizados dois mecanismos:

- uma **branch de marco**, que preserva o estado consolidado do backend;
- uma **tag anotada e versionada**, que identifica o commit exato aprovado para a release.

O fechamento também prevê uma **GitHub Release**, associada à tag e às respectivas notas de versão.

---

## 2. Escopo do marco

O marco reúne as entregas do Product Backlog do backend, incluindo:

```text
BE-01  Arquitetura e organização da API
BE-02  Autenticação JWT
BE-03  Autorização de rotas
BE-04  Administração de usuários
BE-05  Solicitações de cadastro
BE-06  Dashboard e contatos
BE-07  Conversas privadas e histórico paginado
BE-08  Gerenciamento de grupos
BE-09  Mensagens, entrega e leitura
BE-10  Comunicação Socket.IO autenticada
BE-11  Distribuição em tempo real e sincronização/reconexão
BE-12  Segurança e proteção da API
BE-13  Testes automatizados
BE-14  Documentação da API e eventos
BE-15  Consolidação da release e demonstração
BE-16  Integração contínua (CI)
BE-17  Desempenho e concorrência
BE-18  Operação, deploy e recuperação
```

O backend contempla **Node.js, Express, Socket.IO, PostgreSQL 16 e MongoDB 8**, com autenticação, regras de autorização, conversas, grupos e mensagens. A BE-18 acrescentou procedimentos de deploy Docker local, graceful shutdown, backup e restauração isolada.

### Evidências técnicas já observadas

A última regressão completa informada para a BE-18 apresentou:

```text
Integridade da persistência    37/37
Integração                      70/70
Consultas                       5/5
API HTTP                      184/184
Tempo real                     38/38

Total                         334/334
Falhas                              0
```

A restauração de uma massa sintética em projeto Docker isolado também foi validada, preservando UUIDs, ObjectIds e referências entre PostgreSQL e MongoDB.

Na preparação da BE-15, foi confirmado o merge da BE-18 na `main` pelo **PR #23**, no commit **`3569a5b`**, além de um teste `GET /api/v1/health` com **HTTP 200**, PostgreSQL `up` e MongoDB `up`.

> **Importante:** esses resultados são evidências anteriores à publicação do marco. A regressão do commit candidato, o resultado da CI, o merge da BE-15 e a publicação da tag/release devem ser confirmados antes de declarar o marco concluído.

---

## 3. Estratégia de versionamento

### Branch principal

A branch principal segue como linha de desenvolvimento e integração do Corporate Chat:

```text
main
```

### Branch de trabalho da release

A consolidação documental e as verificações finais ocorrem em:

```text
feat/be-15-release-backend
```

Essa branch deverá ser integrada à `main` por Pull Request, depois da revisão e da aprovação da CI.

### Branch de marco

Após o merge da BE-15, a branch de referência será criada a partir do commit integrado à `main`:

```text
milestone/backend-mvp
```

Essa branch representa um **snapshot da release do backend**. O desenvolvimento normal de novas funcionalidades não deve continuar nela.

### Tag de versão

A tag anotada proposta é:

```text
corporate-chat-backend-v1.0.0
```

A tag identificará exatamente o mesmo commit da branch de marco. O nome explicita que se trata da **versão do backend**, e não da entrega final do frontend ou do produto completo.

---

## 4. Representação do histórico

```text
                                         corporate-chat-backend-v1.0.0
                                                        │
                                                        ▼
main ───●──●──●──[merge BE-18]──●──[merge BE-15]────────●────────► evolução futura
                PR #23 / 3569a5b                        │
                                                        │
                                              milestone/backend-mvp
```

Nesse ponto:

- `main` continua recebendo novas entregas;
- `milestone/backend-mvp` permanece como referência do backend MVP consolidado;
- `corporate-chat-backend-v1.0.0` identifica o commit exato liberado;
- a GitHub Release registra o conteúdo e as limitações da versão.

O commit da release **não deve ser confundido com `3569a5b`**, que corresponde ao merge da BE-18. O hash definitivo só será conhecido após o merge da BE-15.

---

## 5. Commit de consolidação e Pull Request da BE-15

Antes da criação do marco, a documentação e as evidências da BE-15 devem estar versionadas na branch de trabalho.

A partir da raiz do repositório, confirmar a branch:

```powershell
git branch --show-current
git status --short
```

Preparar os documentos específicos da release (ajustar os caminhos conforme os arquivos existentes):

```powershell
git add README.md
git add docs/releases/BE-15-RELATORIO-DE-RELEASE.md
git add docs/releases/BE-15-ROTEIRO-DEMONSTRACAO.md
git add docs/releases/BE-15-NOTAS-DA-VERSAO.md
git add docs/milestones-git/GIT-MILESTONE-backend-mvp.md
```

Revisar o staging:

```powershell
git diff --cached --check
git diff --cached --name-status
```

Criar o commit após validar o conteúdo:

```powershell
git commit -m "docs(be-15): consolidate backend MVP release and milestone"
git push -u origin feat/be-15-release-backend
```

Criar o Pull Request com:

```text
Base:    main
Compare: feat/be-15-release-backend
Título:  BE-15 | Consolidação da release do backend MVP
```

**Condição obrigatória:** revisar o PR e confirmar o resultado do workflow de CI antes do merge. Não executar `git add .` indiscriminadamente nem incluir arquivos `.env`, tokens ou backups.

Após integrar o PR, atualizar a `main` local:

```powershell
git switch main
git pull --ff-only origin main
git status --short
git log -1 --oneline
```

O último commit exibido deverá ser o commit da versão consolidada, que será utilizado nas etapas seguintes.

---

## 6. Criação da branch de marco

**Executar somente depois de confirmar o merge da BE-15 e o estado limpo da `main`.**

Verificar se já existe uma branch com o nome escolhido:

```powershell
git branch --list milestone/backend-mvp
git branch -r --list origin/milestone/backend-mvp
```

Se não existir, criar a branch a partir da `main` integrada:

```powershell
git switch main
git branch milestone/backend-mvp
git push -u origin milestone/backend-mvp
```

Conferir o commit da branch e da `main`:

```powershell
git rev-parse main
git rev-parse milestone/backend-mvp
```

Os hashes devem coincidir no momento da criação do marco.

---

## 7. Criação da tag e da GitHub Release

Verificar se a tag já existe localmente ou no remoto:

```powershell
git tag --list corporate-chat-backend-v1.0.0
git ls-remote --tags origin corporate-chat-backend-v1.0.0
```

Se a tag não existir e o commit da `main` estiver validado, criar a tag anotada:

```powershell
git switch main
git tag -a corporate-chat-backend-v1.0.0 -m "Corporate Chat - Backend MVP - Release BE-15"
git push origin corporate-chat-backend-v1.0.0
```

Conferir a referência:

```powershell
git show --no-patch corporate-chat-backend-v1.0.0
git rev-parse corporate-chat-backend-v1.0.0^{}
git rev-parse milestone/backend-mvp
```

O commit apontado pela tag anotada deve ser igual ao commit da branch de marco.

Em seguida, na página **Releases** do GitHub, publicar uma release associada à tag `corporate-chat-backend-v1.0.0`, utilizando o conteúdo de `docs/releases/BE-15-NOTAS-DA-VERSAO.md`.

Não recriar nem mover uma tag já publicada para encobrir alterações posteriores. Caso seja necessária uma correção, preparar uma nova versão de acordo com o versionamento escolhido.

---

## 8. Como recuperar essa versão no futuro

### Clonando diretamente pela branch de marco

```bash
git clone --branch milestone/backend-mvp --single-branch https://github.com/GustavWebCriador/corporate-chat.git
```

### Recuperando pela tag

```bash
git clone https://github.com/GustavWebCriador/corporate-chat.git
cd corporate-chat
git checkout corporate-chat-backend-v1.0.0
```

Ao fazer checkout de uma tag diretamente, o Git utiliza o estado `detached HEAD`.

Para iniciar uma nova atividade a partir dessa versão:

```bash
git switch -c nova-branch corporate-chat-backend-v1.0.0
```

A recuperação do **código** por branch ou tag não restaura dados de produção. Backups e processos de restauração de bancos seguem os procedimentos próprios do runbook operacional.

---

## 9. Fluxo recomendado para próximos marcos

Este padrão pode ser reutilizado na integração do frontend e na release do produto completo.

```text
feat/...                         desenvolvimento de uma entrega
main                             linha principal de integração
milestone/...                    snapshot de uma etapa consolidada
tag nome-da-etapa-vX.Y.Z         referência imutável da versão
GitHub Release                   notas, evidências e limitações
```

Padrão sugerido:

```text
milestone/<nome-da-etapa>
<nome-do-produto-ou-etapa>-v<major>.<minor>.<patch>
```

Para este marco:

```text
milestone/backend-mvp
corporate-chat-backend-v1.0.0
```

O backend poderá ser consumido pelo frontend React, mas esta tag não deve ser apresentada como a conclusão do aplicativo web completo.

---

## 10. Relação com as evidências da release

A documentação de fechamento da BE-15 deve relacionar as evidências ao **commit exato** da release.

Referências documentais:

```text
README.md
docs/releases/BE-15-RELATORIO-DE-RELEASE.md
docs/releases/BE-15-ROTEIRO-DEMONSTRACAO.md
docs/releases/BE-15-NOTAS-DA-VERSAO.md
docs/operations/RUNBOOK-OPERACIONAL.md
```

Modelo de registro a preencher após o merge:

```text
Branch de trabalho: feat/be-15-release-backend
PR BE-15:          PENDENTE
CI do PR:          PENDENTE
Branch de marco:   milestone/backend-mvp
Tag:               corporate-chat-backend-v1.0.0
Commit da release: PENDENTE
GitHub Release:    PENDENTE

Regressão de referência (BE-18): 334/334
Falhas da referência:             0
Regressão no commit BE-15:        PENDENTE
Health check BE-15:              HTTP 200; PostgreSQL up; MongoDB up

Backup/restauração BE-18:        validado com dados sintéticos isolados
```

O relatório final deve conter o link do Pull Request, o resultado da CI, o hash do commit integrado e a URL da GitHub Release. As informações pendentes **não podem ser tratadas como concluídas sem verificação**.

---

## 11. Resultado esperado

Após a conclusão e publicação da BE-15, o repositório deverá disponibilizar:

```text
Branches
├── main
└── milestone/backend-mvp

Tags
└── corporate-chat-backend-v1.0.0

Releases
└── Corporate Chat — Backend MVP v1.0.0
```

Esse modelo permite que a equipe continue desenvolvendo o Corporate Chat sem perder a referência estável da versão em que o **backend MVP foi consolidado, testado, documentado e entregue**.

**Limite do marco:** a release se refere ao backend acadêmico. Não atesta, isoladamente, frontend React concluído, implantação pública, backup transacional entre os dois bancos, RPO/RTO contratual ou operação em produção.

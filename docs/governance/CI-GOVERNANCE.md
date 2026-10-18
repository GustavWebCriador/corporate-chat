# Corporate Chat — CI e Governança

## 1. Objetivo

Este documento define os controles de integração contínua, revisão de código e proteção da branch principal utilizados no projeto **Corporate Chat**.

O objetivo é estabelecer um fluxo de desenvolvimento previsível, rastreável e seguro, reduzindo o risco de integração de alterações incompatíveis ou não validadas na branch `main`.

---

## 2. Integração contínua

O projeto utiliza **GitHub Actions** para executar automaticamente as principais validações do backend.

O workflow principal está localizado em:

```text
.github/workflows/backend-ci.yml
```

A integração contínua é executada nos seguintes eventos:

- Pull Requests direcionados à branch `main`;
- pushes realizados na branch `main`;
- execução manual através do GitHub Actions.

O objetivo da CI é validar automaticamente que uma alteração continua compatível com a estrutura existente do projeto antes de ser integrada.

---

## 3. Ambiente da CI

Cada execução utiliza um ambiente descartável e independente.

O ambiente atualmente utiliza:

```text
Ubuntu
Node.js 24
PostgreSQL 16
MongoDB 8
```

Os bancos utilizados pela CI existem somente durante a execução do workflow.

Nenhum banco de produção ou ambiente persistente é utilizado pela integração contínua.

---

## 4. Variáveis de ambiente da CI

O workflow configura variáveis específicas para o ambiente automatizado.

São utilizados valores fictícios e descartáveis para:

```text
PostgreSQL
MongoDB
JWT
massa de desenvolvimento
```

Esses valores possuem finalidade exclusiva de teste e não representam credenciais utilizadas pelos integrantes da equipe em seus ambientes locais.

Credenciais reais não devem ser adicionadas diretamente ao workflow.

---

## 5. Pipeline de validação

O fluxo principal executado pela CI é:

```text
checkout do repositório
          │
          ▼
configuração do Node.js
          │
          ▼
npm ci
          │
          ▼
verificação de sintaxe
          │
          ▼
PostgreSQL + MongoDB
          │
          ▼
migrations PostgreSQL
          │
          ▼
seeds de desenvolvimento
          │
          ▼
validações de persistência
          │
          ▼
testes automatizados
          │
          ▼
status das migrations
```

O workflow deve falhar imediatamente quando uma etapa obrigatória não puder ser concluída.

---

## 6. Instalação de dependências

A CI utiliza:

```bash
npm ci
```

em vez de:

```bash
npm install
```

O objetivo é realizar uma instalação reproduzível a partir das versões registradas no `package-lock.json`.

O arquivo utilizado é:

```text
backend/package-lock.json
```

Alterações de dependências devem manter o `package.json` e o `package-lock.json` consistentes.

---

## 7. Verificação de sintaxe

Antes da execução das validações de banco e testes, os arquivos JavaScript do backend são verificados utilizando:

```bash
node --check
```

São considerados os diretórios relacionados ao backend:

```text
src/
database/
scripts/
tests/
```

Essa etapa permite detectar erros básicos de sintaxe antes das verificações mais custosas.

---

## 8. Persistência utilizada pela CI

### PostgreSQL

A CI inicializa um PostgreSQL descartável e executa as migrations versionadas do projeto.

O processo utiliza:

```bash
npm run db:migrate
```

Ao final, o status das migrations é verificado com:

```bash
npm run db:migrate:status
```

### MongoDB

A CI inicializa um MongoDB descartável e aguarda sua disponibilidade antes de iniciar operações de persistência.

Os índices e dados de desenvolvimento são preparados através dos scripts já existentes no projeto.

---

## 9. Massa de desenvolvimento

A preparação da massa utilizada pelas validações é realizada através de:

```bash
npm run seed:dev
```

Esse fluxo é responsável por integrar as estruturas necessárias de desenvolvimento, incluindo:

```text
seeders PostgreSQL
índices MongoDB
seed MongoDB
validação da massa
```

A massa utilizada na CI deve permanecer determinística e compatível com os testes automatizados.

---

## 10. Validação completa

A principal validação do backend é executada através de:

```bash
npm run verify:persistence
```

Esse comando reutiliza os scripts existentes no projeto e executa verificações relacionadas a:

```text
seed:verify
integration:verify
queries:verify
test:integrity
test:integration
test:queries
test:api
```

O objetivo é evitar a existência de uma suíte exclusiva para CI diferente daquela utilizada pelos desenvolvedores.

O mesmo código validado localmente deve ser utilizado no ambiente automatizado.

---

## 11. Quality Gate

Uma alteração somente deve ser considerada apta para integração quando atender aos critérios definidos pelo projeto.

O fluxo esperado é:

```text
CI aprovada
      +
revisão aprovada
      +
conversas resolvidas
      +
branch compatível com main
      =
alteração apta para merge
```

Quando a CI apresentar falha, o Pull Request não deve ser integrado até que a causa seja identificada e corrigida.

---

## 12. Governança da branch main

A branch `main` representa a versão integrada e estável do projeto.

Alterações destinadas à `main` devem seguir o fluxo:

```text
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
revisão
      │
      ▼
merge
```

O desenvolvimento normal não deve ser realizado diretamente na `main`.

---

## 13. Pull Requests

Toda alteração destinada à branch principal deve utilizar Pull Request.

O Pull Request deve informar, quando aplicável:

- objetivo da alteração;
- Product Backlog ou requisito relacionado;
- principais arquivos e comportamentos alterados;
- impacto em banco de dados;
- impacto em segurança;
- testes executados;
- evidências;
- documentação atualizada;
- possíveis impactos de compatibilidade.

O template oficial está localizado em:

```text
.github/pull_request_template.md
```

---

## 14. Revisão de código

A revisão deve ser realizada por outro integrante responsável pela análise da alteração antes do merge.

O revisor deve considerar, conforme o escopo:

- aderência à tarefa;
- arquitetura;
- regras de negócio;
- autenticação;
- autorização;
- persistência;
- exposição de dados;
- tratamento de erros;
- testes automatizados;
- risco de regressão;
- documentação.

Comentários considerados bloqueadores devem ser resolvidos antes da integração.

---

## 15. Proteção da branch main

A branch principal deve possuir regras de proteção configuradas no GitHub.

Os controles esperados são:

```text
Pull Request obrigatório
aprovação antes do merge
status check da CI obrigatório
branch atualizada antes da integração
conversas de revisão resolvidas
force push bloqueado
exclusão da main bloqueada
```

A CI do backend deve ser utilizada como status check obrigatório após sua primeira execução bem-sucedida.

---

## 16. Estratégia de merge

O projeto utiliza preferencialmente **merge commit através de Pull Request**.

Esse modelo permite preservar:

```text
histórico da branch
commits individuais
contexto da implementação
registro do Pull Request
```

As branches concluídas podem permanecer disponíveis após o merge para fins de rastreabilidade e controle histórico acadêmico.

A branch `main`, entretanto, permanece como referência da versão oficialmente integrada.

---

## 17. Segurança do repositório

Não devem ser versionados:

```text
.env
.env.bak
senhas reais
tokens reais
JWT secrets reais
credenciais de banco
chaves privadas
backups contendo dados sensíveis
```

O `.gitignore` deve impedir o versionamento dos principais arquivos locais de configuração.

Valores presentes no workflow de CI devem ser exclusivamente fictícios e descartáveis.

---

## 18. Responsabilidade do desenvolvedor

Antes de abrir um Pull Request, o responsável pela alteração deve:

```text
verificar a branch utilizada
atualizar sua base quando necessário
executar os testes relacionados
executar a regressão aplicável
executar git diff --check
inspecionar git status
revisar os arquivos alterados
verificar dados sensíveis
atualizar a documentação
```

A existência da CI não substitui a validação local do desenvolvedor.

---

## 19. Definition of Done

Uma alteração pode ser considerada concluída quando:

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

Quando algum desses itens não se aplicar ao escopo da tarefa, isso deve ser informado no Pull Request.

---

## 20. Evoluções futuras

A infraestrutura de qualidade pode evoluir gradualmente com recursos adicionais, como:

- ESLint;
- cobertura automatizada de testes;
- análise estática;
- Dependabot;
- análise de vulnerabilidades;
- code scanning;
- geração automática de artefatos;
- métricas de qualidade.

Essas ferramentas devem ser incorporadas de maneira incremental e somente quando agregarem valor ao processo de desenvolvimento.

---

## 21. Resultado esperado

Com a aplicação deste fluxo, o Corporate Chat passa a possuir um processo de integração baseado em:

```text
versionamento
+
automação
+
testes
+
revisão
+
rastreabilidade
+
controle da main
```

O objetivo não é apenas impedir erros de integração, mas também manter um histórico técnico compreensível e reproduzível durante a evolução do projeto.
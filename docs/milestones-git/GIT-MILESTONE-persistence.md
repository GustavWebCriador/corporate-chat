# Marco Git — Encerramento da Etapa de Persistência

## 1. Objetivo

Este documento registra a estratégia utilizada para consolidar a etapa de Persistência de Dados do Corporate Chat após a conclusão das PER-01 até PER-10.

O objetivo é manter um ponto de referência estável no histórico do Git que represente o encerramento formal desse conjunto do Product Backlog.

Foram definidos dois mecanismos:

- uma **branch de marco**, preservando o estado completo da etapa;
- uma **tag versionada**, apontando para o commit exato considerado concluído e validado.

---

## 2. Escopo do marco

Este marco representa a conclusão das seguintes entregas:

```text
PER-01  Ambiente de persistência
PER-02  Schema PostgreSQL
PER-03  Models MongoDB
PER-04  Constraints e índices
PER-05  Ambiente reproduzível
PER-06  Seeds de desenvolvimento
PER-07  Testes automatizados de integridade
PER-08  Integração PostgreSQL ↔ MongoDB
PER-09  Consultas críticas
PER-10  Documentação e evidências
```

A etapa foi validada com as suítes automatizadas existentes no projeto.

Resultado consolidado no momento do fechamento:

```text
Integrity tests      26/26
Integration tests    10/10
Query tests           5/5

Total                41/41
Falhas                0
```

---

## 3. Estratégia de versionamento

### Branch principal

A branch principal continua sendo utilizada para a evolução normal do projeto:

```text
main
```

### Branch de marco

Foi definida uma branch específica para preservar o estado final da etapa de persistência:

```text
milestone/persistence-per-01-10
```

Essa branch deve ser tratada como um snapshot de referência.

Não é recomendado continuar o desenvolvimento normal diretamente nela.

### Tag de versão

Foi definida uma tag anotada para marcar exatamente o commit correspondente ao encerramento da etapa:

```text
persistence-v1.0.0
```

A tag representa o ponto oficial da conclusão da persistência.

---

## 4. Representação do histórico

```text
                            persistence-v1.0.0
                                   │
                                   ▼
main ──────────────────────────────●──────────────► evolução futura
                                   │
                                   │
                  milestone/persistence-per-01-10
```

Nesse ponto:

- `main` pode continuar recebendo novas funcionalidades;
- `milestone/persistence-per-01-10` permanece como referência da etapa;
- `persistence-v1.0.0` identifica o commit exato do marco.

---

## 5. Commit de consolidação

Antes da criação da branch e da tag, todas as alterações da etapa devem estar versionadas.

Comando recomendado:

```bash
git add .
git commit -m "chore(persistence): consolidate PER-01 to PER-10 milestone"
```

Esse commit deve representar o estado final validado da etapa.

Para conferir:

```bash
git log -1 --oneline
```

ou:

```bash
git rev-parse --short HEAD
```

---

## 6. Criação da branch de marco

A partir do commit final:

```bash
git branch milestone/persistence-sprint
```

Para enviar ao repositório remoto:

```bash
git push -u origin milestone/persistence-sprint
```

A branch passa a representar a versão consolidada da persistência.

---

## 7. Criação da tag

Criar a tag anotada:

```bash
git tag -a persistence-v1.0.0 -m "Marco da persistência: PER-01 até PER-10 concluídas"
```

Enviar a tag ao repositório remoto:

```bash
git push origin persistence-v1.0.0
```

Para verificar:

```bash
git show persistence-v1.0.0
```

---

## 8. Como recuperar essa versão no futuro

### Clonando diretamente pela branch

```bash
git clone --branch milestone/persistence-per-01-10 --single-branch https://github.com/GustavWebCriador/corporate-chat.git
```

### Recuperando pela tag

```bash
git clone https://github.com/GustavWebCriador/corporate-chat.git
cd corporate-chat
git checkout persistence-v1.0.0
```

Ao fazer checkout diretamente de uma tag, o Git utiliza `detached HEAD`.

Para criar uma nova branch a partir do marco:

```bash
git checkout -b nova-branch persistence-v1.0.0
```

---

## 9. Fluxo recomendado para próximos marcos

O mesmo padrão pode ser reutilizado em outras etapas importantes do projeto.

Exemplo conceitual:

```text
feature/...                     desenvolvimento de funcionalidade
main                            linha principal
milestone/...                   snapshot de uma etapa consolidada
tag vX.Y.Z                      marco imutável daquela versão
```

Sugestão de padrão:

```text
milestone/<nome-da-etapa>
```

e:

```text
<nome-da-etapa>-v<major>.<minor>.<patch>
```

Exemplo:

```text
milestone/persistence-per-01-10
persistence-v1.0.0
```

---

## 10. Relação com as evidências da Sprint

A evidência técnica da persistência deve registrar também:

- branch utilizada;
- commit validado;
- tag de marco;
- resultado dos testes;
- status das migrations;
- resultado da integração PostgreSQL ↔ MongoDB;
- resultado das consultas críticas.

Assim, a evidência pode ser associada a uma versão exata do código.

Exemplo:

```text
Branch: milestone/persistence-per-01-10
Tag: persistence-v1.0.0
Commit: <hash-do-commit>

Integrity tests:   26/26
Integration tests: 10/10
Query tests:        5/5
Total:             41/41
Falhas:             0
```

---

## 11. Resultado esperado

Ao final, o repositório deverá disponibilizar:

```text
Branches
├── main
└── milestone/persistence-per-01-10

Tags
└── persistence-v1.0.0
```

Esse modelo permite que a equipe continue evoluindo o Corporate Chat sem perder uma referência estável da versão em que a camada de Persistência de Dados foi concluída, validada e documentada.

# Corporate Chat — BE-18 | Runbook operacional: deploy, backup e recuperação

**Status:** versão inicial para revisão e inclusão no repositório
**Referência:** 08/11/2026
**Escopo:** backend Node.js/Express/Socket.IO, PostgreSQL 16, MongoDB 8 e Docker Compose de deploy local.
**Destino sugerido:** `docs/operations/BE-18-RUNBOOK-OPERACIONAL.md`.

> **Atenção:** os procedimentos aqui descritos foram exercitados em Docker local, com dados sintéticos. O arquivo `restore-be18.ps1` foi desenvolvido para **restauração isolada de verificação**, não para sobrescrever ou recuperar diretamente uma instância empresarial em produção. Não use `docker compose down -v` nos ambientes que contenham dados a preservar.

## 1. Arquitetura operacional e arquivos

- `docker-compose.deploy.yml` (na raiz): serviços `postgres`, `mongodb`, `api`; serviços de manutenção `migrate` e `mongo-indexes` sob perfil `maintenance`.
- `backend/Dockerfile` e `backend/.dockerignore`: imagem de aplicação e imagem de manutenção.
- `backend/src/operations/shutdown.js`, `backend/src/server.js`: desligamento controlado de Socket.IO, HTTP, PostgreSQL e MongoDB; tratamento de `SIGINT`/`SIGTERM`.
- `deploy/.env.example`: referência de variáveis. `deploy/.env`: segredos locais, **não versionar**.
- `deploy/scripts/backup-be18.ps1`: exportação sequencial dos dois bancos, checksums e manifesto.
- `deploy/scripts/restore-be18.ps1`: conferência SHA-256 e restauração em **novo** projeto Docker.
- `deploy/scripts/verify-be18-restore-v2.ps1`: comparação de dados sintéticos da origem e do destino, inclusive referências entre bancos.
- `deploy/backups/`: arquivos `.dump`, `.archive.gz` e `.manifest.json`, **não versionar**.

### Pré-requisitos

Windows com PowerShell, Docker Desktop/Engine em execução, plugin Docker Compose, acesso à pasta do repositório e `deploy/.env` válido. Para os comandos da aplicação e testes, Node.js e dependências do backend instalados. Executar os exemplos na **raiz** do repositório.

Antes de qualquer operação, conferir o projeto selecionado e seu estado. A alteração de credenciais no `.env` não altera automaticamente as credenciais já inicializadas em volumes antigos.

## 2. Inicialização do deploy local

```powershell
Set-Location 'C:\caminho\para\corporate-chat'
$deployArgs = @('-p', 'corporate-chat-deploy', '--env-file', '.\deploy\.env', '-f', '.\docker-compose.deploy.yml')
docker compose @deployArgs config --quiet
docker compose @deployArgs up -d --wait postgres mongodb
docker compose @deployArgs build migrate mongo-indexes api
docker compose @deployArgs run --rm migrate
docker compose @deployArgs run --rm mongo-indexes
docker compose @deployArgs up -d --wait api
docker compose @deployArgs ps
Invoke-WebRequest -Uri 'http://127.0.0.1:3101/api/v1/health' -UseBasicParsing
```

**Critérios:** bancos em estado `healthy`; migrations aplicadas; sincronização de índices concluída; API atende `GET /api/v1/health` com HTTP 200. No deploy local a API está publicada em `127.0.0.1:3101`; os bancos não possuem portas públicas. Isso **não** equivale a uma configuração completa para exposição na internet.

**Falhas:** consultar `docker compose @deployArgs logs --tail 100 api postgres mongodb`. Não recriar volumes em resposta a erros de inicialização. Investigar credenciais, portas, redes e migrations antes de qualquer ação corretiva.

## 3. Backup operacional (script)

O backup reúne um dump PostgreSQL e um arquivo MongoDB, mas as extrações são **sequenciais, não uma transação distribuída**. Para coerência entre bancos, interromper gravações da aplicação e de integrações externas durante toda a janela de captura. Não presumir que somente desligar a API bloqueia outros escritores.

```powershell
Set-Location 'C:\caminho\para\corporate-chat'
.\deploy\scripts\backup-be18.ps1 -ProjectName 'corporate-chat-deploy'
```

Para ensaio com registros sintéticos, sem interferir no deploy:

```powershell
.\deploy\scripts\backup-be18.ps1 -ProjectName 'corporate-chat-be18-fixture-20261108110151'
```

**Saídas esperadas** em `deploy/backups/`:

1. `be18-...-postgres.dump` — dump PostgreSQL em formato personalizado (`pg_dump -Fc`).
2. `be18-...-mongodb.archive.gz` — arquivo MongoDB (`mongodump --gzip --archive`).
3. `be18-....manifest.json` — nomes dos arquivos, tamanho em bytes, SHA-256, projeto de origem, data UTC e indicação de captura sequencial.

**Critério de sucesso:** o script encerra com `[OK] Backup concluido.`. Um arquivo existente, sozinho, **não** prova que a captura terminou. Os backups devem ser armazenados em meio protegido e separado da máquina de origem; testar periodicamente a recuperação. O manifesto protege a detecção de corrupção acidental, **não autentica** a origem do arquivo se um adversário puder alterar tanto o backup quanto seu manifesto.

## 4. Restauração **isolada** para ensaio

Não executar `migrate` ou `mongo-indexes` antes de restaurar o dump num banco vazio: a restauração já inclui schema, histórico de migrations e índices MongoDB do backup. O script valida SHA-256 e tamanho, impede reutilização de nomes Docker já existentes e cria volumes novos.

```powershell
Set-Location 'C:\caminho\para\corporate-chat'
$fixture = 'corporate-chat-be18-fixture-20261108110151'
$manifest = Get-ChildItem '.\deploy\backups\*.manifest.json' |
    Where-Object { $_.Name -like "*$fixture*" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $manifest) { throw 'Manifesto de teste nao encontrado.' }
$restoreProject = 'corporate-chat-be18-restore-' + (Get-Date -Format 'yyyyMMddHHmmss') + '-' + ([guid]::NewGuid().ToString('N')).Substring(0,8)
.\deploy\scripts\restore-be18.ps1 -ManifestPath $manifest.FullName -ProjectName $restoreProject
```

**Importante:** não encaminhar o manifesto integral, dumps, senhas ou conteúdos de mensagens por chat/e-mail; capturar somente o resumo operacional e as linhas de sucesso para evidências.

### Conferência cruzada dos registros sintéticos

```powershell
.\deploy\scripts\verify-be18-restore-v2.ps1 -SourceProject $fixture -RestoreProject $restoreProject
```

O script de verificação é **específico da massa sintética BE-18** (2 usuários, 1 solicitação, 1 sessão, 1 conversa, 2 membros e 1 mensagem). Não é um verificador genérico de qualquer banco em produção.

**Critério de sucesso:** ambas as operações terminam sem erro e aparecem estas confirmações:

- `[OK] PostgreSQL: ... preservaram seus UUIDs.`
- `[OK] MongoDB: ObjectIds, participantes, remetente e conteudo preservados.`
- `[OK] Integridade PostgreSQL <-> MongoDB: todos os UUIDs vinculados existem.`
- `[OK] BE-18: restauracao com dados nao vazios verificada.`

Comparações de integridade entre bancos exigem preservar um par de backups capturado em uma janela coordenada. O ambiente isolado continua ativo depois da validação; sua remoção, se necessária, deve ser aprovada separadamente.

## 5. Desligamento e recuperação de incidentes

O processo da API recebe `SIGINT`/`SIGTERM` e tenta encerrar Socket.IO, servidor HTTP e conexões com bancos. O Docker Compose usa período de tolerância para o encerramento; não presumir persistência automática de trabalho ainda não confirmado ao cliente.

Em ocorrência operacional:

1. Registrar horário, serviço afetado, sintomas e último backup validado.
2. Verificar `docker compose ... ps`, logs e `GET /api/v1/health` sem expor segredos.
3. Suspender novas gravações se houver suspeita de corrupção/inconsistência entre bancos.
4. Preservar volumes originais e gerar cópia de segurança se tecnicamente viável.
5. Restaurar **primeiro num projeto isolado** e executar verificações; não sobrescrever a origem por padrão.
6. Planejar separadamente a retomada da aplicação, o redirecionamento de tráfego e a validação funcional; a troca de produção não está automatizada nesta BE.

**Segurança:** `.env`, backups e quaisquer dumps de dados não devem ser versionados nem incluídos em prints/logs compartilhados. Não executar `docker compose down -v`, `npm run env:fresh` ou comandos de limpeza de volumes em ambientes com dados que devem ser preservados.

## 6. Evidências obtidas em 08/11/2026

Ensaio de origem: `corporate-chat-be18-fixture-20261108110151`.
Ensaio de restauração automatizada: `corporate-chat-be18-restore-20261108114354-a16cbf3d`.

| Controle | Resultado observado |
|---|---|
| Backup automatizado | PostgreSQL 12.241 bytes, MongoDB 1.027 bytes, manifesto gerado |
| Conferência SHA-256 na restauração | Aprovada |
| Estado dos bancos de destino | Ambos `healthy` durante restauração |
| PostgreSQL | `users=2`, `registration_requests=1`, `auth_sessions=1`, `SequelizeMeta=9` |
| MongoDB | 1 conversa, 2 membros, 1 mensagem; `mongorestore` retornou 4 documentos, 0 falhas |
| Comparação de IDs e vínculos | UUIDs, ObjectIds, mensagens e referência PostgreSQL ↔ MongoDB aprovados |
| Volumes originais | Preservados; restauração criada em projeto independente |

**Limite das evidências:** não foram demonstrados backup consistente sob escritas simultâneas, automação de retenção/agenda, restauração em infraestrutura remota, RPO/RTO contratados, failover ou operação pública com TLS e observabilidade completa. O escopo demonstrado é deploy local e recuperação isolada com dados sintéticos.

## 7. Checklist de revisão e Pull Request

- [x] Verificar que `deploy/.env` e `deploy/backups/` estão ignorados pelo Git.
- [x] Revisar `backend/Dockerfile`, `backend/.dockerignore`, `docker-compose.deploy.yml`, `deploy/.env.example` e scripts antes de versionar.
- [ ] Manter somente a versão genérica do verificador de restauração como arquivo versionado; evitar nomes e IDs fixos da execução anterior.
- [ ] Executar `git diff --check` e regressão `npm test` em `backend/`.
- [ ] Conferir logs de API e `GET /api/v1/health` no deploy.
- [ ] Adicionar este runbook e anexar as evidências resumidas ao PR, sem os backups e segredos.
- [ ] Revisar e aprovar PR para `main` antes do fechamento da BE-18.

### Comandos de revisão de segurança e Git

```powershell
Set-Location 'C:\caminho\para\corporate-chat'
git check-ignore -v deploy/.env
git check-ignore -v deploy/backups
# Se o diretorio for ignorado por regra contendo arquivo, confira um nome de backup:
git check-ignore -v deploy/backups/backup-exemplo.dump
git status --short --untracked-files=all
git diff --check
Set-Location .\backend
npm test
```

Os comandos acima não criam commits nem enviam arquivos ao GitHub. Inspecionar o `git status` antes de adicionar mudanças explicitamente.

## 8. Critério de encerramento

BE-18 pode ser considerada tecnicamente concluída para o **MVP acadêmico** após: imagens e Compose revisados; graceful shutdown validado; scripts de backup e restauração testados; documentação e evidências presentes no repositório; regressão e CI aprovadas; e Pull Request integrado. A etapa seguinte é a consolidação da release do backend (BE-15), não uma nova funcionalidade.

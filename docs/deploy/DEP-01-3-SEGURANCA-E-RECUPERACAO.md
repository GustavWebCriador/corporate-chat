# DEP-01.3 — Validação de segurança e recuperação

**Resultado esperado:** servidor publicado com a verificação de segurança sem falhas, backup diário automático, backups copiados para fora do servidor, um ensaio de restauração bem-sucedido e um plano de encerramento que não deixa recursos consumindo créditos.

**Pré-requisito:** DEP-01.2 concluído. **Tempo estimado:** 40 minutos.

---

## 1. Camadas de proteção

| Camada | Proteção | Onde está |
|---|---|---|
| Rede AWS | Security Group: SSH só do IP da equipe; 80/443 públicos; bancos e API sem porta | DEP-01.1, seção 6 |
| Servidor | `ufw` (22/80/443), SSH só com chave e sem root, `fail2ban`, atualizações automáticas | `deploy/aws/bootstrap-servidor.sh` |
| Disco | EBS criptografado; IMDSv2 obrigatório | DEP-01.1, seção 7 |
| Transporte | HTTPS com Let's Encrypt, redirecionamento HTTP→HTTPS, HSTS | `deploy/aws/Caddyfile` |
| Navegador | CSP restritiva, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `deploy/aws/Caddyfile` |
| Aplicação | JWT com sessão revogável, limite de tentativas pelo IP real (`TRUST_PROXY`), Helmet, CORS só do endereço público | backend (BE-12, DEP-01.2) |
| Segredos | `deploy/.env` com permissão 600, fora do git, sem seed de desenvolvimento | `publicar.sh` valida |
| Dados | Backup diário com SHA-256, cópia externa, ensaio de restauração | seções 3 a 5 |

## 2. Verificação de segurança automatizada

### No servidor (completa)

```bash
cd /opt/corporate-chat
sudo bash deploy/scripts/verificar-seguranca.sh
```

Confere SSH, `fail2ban`, `ufw`, portas em escuta, contêineres e portas publicadas, `deploy/.env`, ausência de usuários `@corporatechat.local`, administrador ativo, atualizações, swap, disco, idade do último backup, timer de backup, HTTPS, redirecionamento, cabeçalhos, validade do certificado e portas vistas de fora. Termina com código 1 se houver qualquer **FALHA**.

### De fora (do computador de um integrante)

```bash
bash deploy/scripts/verificar-seguranca.sh --externo 15-228-10-20.sslip.io
```

Confirma de uma rede externa que 80/443 respondem e que **3000, 3101, 5432 e 27017 estão fechadas**.

**Quando executar:** após a primeira publicação, após cada atualização, semanalmente e na véspera da apresentação.

## 3. Backup diário automático

Instalação (uma vez):

```bash
cd /opt/corporate-chat
sudo cp deploy/aws/corporate-chat-backup.service deploy/aws/corporate-chat-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now corporate-chat-backup.timer
sudo systemctl start corporate-chat-backup.service       # primeiro backup imediato
systemctl list-timers corporate-chat-backup.timer        # próxima execução
journalctl -u corporate-chat-backup.service -n 20        # resultado
```

- Executa todo dia às **03:30 (horário de Brasília)**; se o servidor estiver desligado, roda ao ligar.
- Gera em `/var/backups/corporate-chat`: dump do PostgreSQL, arquivo do MongoDB e manifesto com tamanhos e SHA-256 (mesmo formato do BE-18).
- Mantém **7 dias**. Backup manual a qualquer momento: `bash deploy/scripts/backup.sh`.
- Arquivos com permissão 600 e pasta com 750: somente o usuário `ubuntu` lê.

## 4. Cópia para fora do servidor

Um backup que fica só no servidor se perde junto com ele. **Semanalmente** e **antes do encerramento da conta**, copie o conjunto mais recente para um computador da equipe:

```bash
# No computador do integrante (Git Bash ou PowerShell):
ssh -i ~/.ssh/corporate-chat-equipe.pem ubuntu@15.228.10.20 'ls -t /var/backups/corporate-chat/*.manifest.json | head -n 1'
scp -i ~/.ssh/corporate-chat-equipe.pem 'ubuntu@15.228.10.20:/var/backups/corporate-chat/corporate-chat-deploy-AAAAMMDD-HHMMSS*' ./backups-corporate-chat/
```

- Os backups contêm dados pessoais (nomes, e-mails, mensagens) e hashes de senha. Guarde em pasta **criptografada** ou em local restrito da equipe; **nunca** no repositório.
- **Opcional:** snapshots diários do disco com o *Amazon Data Lifecycle Manager* (EC2 → *Lifecycle Manager*). Os snapshots também consomem créditos (≈ US$ 0,05/GB-mês, incrementais).

## 5. Ensaio de restauração

Comprova que o backup **realmente** restaura. Não altera a produção.

```bash
cd /opt/corporate-chat
bash deploy/scripts/restaurar.sh /var/backups/corporate-chat/corporate-chat-deploy-AAAAMMDD-HHMMSS.manifest.json
```

O script confere tamanho e SHA-256, sobe bancos temporários num projeto Docker separado, restaura, conta usuários, solicitações, sessões, conversas, participações e mensagens, verifica que **todo remetente e participante do MongoDB existe no PostgreSQL**, e apaga os bancos temporários. Use `--manter` para inspecioná-los antes.

**Quando executar:** após instalar o backup, mensalmente e antes da apresentação.

## 6. Incidentes e recuperação

| Situação | O que fazer |
|---|---|
| Aplicação fora do ar | `docker compose -p corporate-chat-deploy ps`; ver logs com `... logs --tail 100 api proxy`; `bash deploy/scripts/publicar.sh` reconstrói e sobe tudo sem perder dados |
| Servidor reiniciado | Os contêineres sobem sozinhos (`restart: unless-stopped`); confirme com a verificação da seção 2 |
| Dados apagados ou corrompidos | 1) Ensaio (seção 5) para escolher o backup bom; 2) criar servidor novo (linha abaixo) e restaurar nele; 3) apontar o IP elástico para o servidor novo |
| **Instância perdida** | 1) DEP-01.1 (nova instância); 2) reassociar o IP elástico; 3) `git clone`, recriar `deploy/.env` com **os mesmos** segredos; 4) copiar o backup para `/var/backups/corporate-chat`; 5) `bash deploy/scripts/restaurar.sh --servidor-novo <manifesto>` (só aceita bancos vazios e pede a palavra `RESTAURAR`); 6) `bash deploy/scripts/publicar.sh`; 7) seção 3 (timer) |
| Segredo vazado (`JWT_SECRET`) | Gerar novo valor no `deploy/.env` e `bash deploy/scripts/publicar.sh`. Todas as sessões são invalidadas (usuários entram de novo) |
| Senha de banco vazada | Alterar **dentro** do banco e depois no `.env` (só mudar o `.env` não basta): PostgreSQL `docker compose -p corporate-chat-deploy exec postgres psql -U <usuario> -d <banco> -c "\password <usuario>"`; MongoDB `... exec mongodb mongosh -u <usuario> -p --authenticationDatabase admin admin --eval 'db.changeUserPassword("<usuario>", passwordPrompt())'`; em seguida atualizar o `deploy/.env` e executar `publicar.sh` |
| Chave SSH perdida | EC2 → instância → *Connect* → **EC2 Instance Connect** (liberar temporariamente a porta 22 para o prefixo `com.amazonaws.sa-east-1.ec2-instance-connect`); cadastrar uma chave nova em `~/.ssh/authorized_keys` e remover a regra temporária |
| IP da equipe mudou | Editar a regra SSH do Security Group para o novo IP (*My IP*) |
| Créditos acabando | *Billing → Credits*. Desligar a instância fora dos horários de uso (*Stop*); o disco e o IP continuam consumindo |

## 7. Encerramento (fim da avaliação)

O plano Free encerra a conta sozinho após 6 meses, mas os dados se perdem. Ao final da avaliação:

1. `bash deploy/scripts/backup.sh` e cópia para fora do servidor (seção 4).
2. Registrar no diário de bordo a data e o local do backup final.
3. EC2 → instância → desativar *Termination protection* → **Terminate**.
4. **Elastic IPs** → *Release* (IP sem instância continua consumindo créditos).
5. **Volumes** e **Snapshots**: excluir os que restarem; **Lifecycle Manager**: excluir políticas.
6. Excluir o par de chaves, o Security Group e o orçamento.
7. IAM: excluir o usuário `equipe-admin`.

## 8. Validação realizada antes do PR

Executada localmente, sem AWS e sem Docker, com um simulador de `docker compose` que executa os comandos dos scripts nos bancos locais (PostgreSQL 18 com `pg_dump`/`pg_restore` reais; MongoDB com `mongosh` real e `mongodump`/`mongorestore` simulados) sobre uma **cópia temporária** dos dados do ensaio do DEP-01.2 (administrador, usuária, conversa e mensagem reais):

| Cenário | Resultado |
|---|---|
| `backup.sh` | Dump, arquivo e manifesto gerados; retenção apagou conjunto de 10 dias |
| `restaurar.sh` (ensaio) | 2 usuários, 3 sessões, 1 conversa, 2 participações, 1 mensagem; integridade entre bancos OK; bancos do ensaio removidos |
| Backup adulterado em 1 byte | Recusado: SHA-256 diferente do manifesto |
| `--servidor-novo` com produção contendo dados | Recusado sem alterar nada (4 tabelas, 3 coleções) |
| `--servidor-novo` sem confirmação | Recusado |
| `--servidor-novo` em bancos vazios, confirmado | Restaurado; integridade OK |
| Repetir `--servidor-novo` no mesmo servidor | Recusado (já há dados) |
| Aplicação sobre o banco recuperado | 9 migrations já aplicadas (publicar não refaz); login do administrador e histórico com a mensagem original |
| `verificar-seguranca.sh` | Sintaxe e argumentos conferidos; execução depende do Ubuntu no servidor |

**Pendente de validação no servidor:** `mongodump`/`mongorestore` dentro do contêiner `mongo:8` (os mesmos comandos do BE-18, validados em Docker em 08/11/2026), timer do systemd e `verificar-seguranca.sh` completo.

## 9. Registro de evidências

| Item | Evidência | Responsável | Data |
|---|---|---|---|
| `verificar-seguranca.sh` no servidor: 0 FALHA | | | |
| `verificar-seguranca.sh --externo`: 0 FALHA | | | |
| Timer de backup ativo e primeiro backup | | | |
| Cópia do backup fora do servidor | | | |
| Ensaio de restauração concluído | | | |
| Encerramento executado (ao final) | | | |

# DEP-01.2 — Publicação da aplicação

**Resultado esperado:** Corporate Chat acessível em `https://<CHAT_DOMAIN>`, com certificado válido, frontend, API e Socket.IO no mesmo endereço, e um administrador inicial criado sem senha conhecida.

**Pré-requisito:** DEP-01.1 concluído (instância preparada e IP elástico associado).
**Tempo estimado:** 30 minutos (a primeira geração das imagens leva de 5 a 10 minutos).

---

## 1. O que é publicado

| Serviço | Imagem | Exposição |
|---|---|---|
| `proxy` | Caddy 2.10 + build do frontend (`deploy/aws/proxy.Dockerfile`) | Portas 80 e 443 públicas |
| `api` | Node 24 (`backend/Dockerfile`, alvo `runtime`) | Somente rede interna e `127.0.0.1:3101` |
| `postgres` | PostgreSQL 16 | Somente rede interna |
| `mongodb` | MongoDB 8 (cache limitado a 256 MB) | Somente rede interna |

O proxy encaminha `/api/*` e `/socket.io/*` para a API e serve o frontend para os demais caminhos (com retorno ao `index.html` para as rotas do React).

### Ajustes no backend para rodar atrás do proxy

- **`TRUST_PROXY=1`** (definido pelo `docker-compose.aws.yml`): o limite de tentativas de login e de solicitação de acesso passa a usar o IP real do usuário. Sem isso, todos os usuários compartilhariam o mesmo contador (o IP do proxy). Valores permissivos como `true` são recusados na inicialização, pois permitiriam falsificar o IP.
  - Sinal de configuração errada: aviso `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` no log da API.
- **Administrador inicial:** o seed de desenvolvimento **não** é usado em produção. O comando `deploy/scripts/criar-admin.sh` cria o primeiro administrador pedindo a senha sem exibi-la, e se recusa a rodar quando já existe um administrador ativo.

## 2. Endereço público

| Opção | `CHAT_DOMAIN` | Observação |
|---|---|---|
| **sslip.io (gratuito)** | IP elástico com hífens + `.sslip.io`, ex.: `15-228-10-20.sslip.io` | Nenhum cadastro; o nome já aponta para o IP |
| Domínio próprio | ex.: `chat.suaequipe.com.br` | Crie um registro **A** apontando para o IP elástico antes de publicar |

O certificado HTTPS é emitido automaticamente pelo Let's Encrypt na primeira publicação. Para isso, a porta **80** precisa estar aberta no Security Group.

## 3. Configurar `deploy/.env` no servidor

Conecte por SSH (DEP-01.1, seção 9) e, no servidor:

```bash
cd /opt/corporate-chat
git pull --ff-only
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
```

Gere segredos novos (um por variável) e cole no arquivo:

```bash
for v in POSTGRES_PASSWORD MONGO_PASSWORD JWT_SECRET; do echo "$v=$(openssl rand -base64 36 | tr -d '/+=' )"; done
nano deploy/.env
```

Preencha também:

```dotenv
CHAT_DOMAIN=15-228-10-20.sslip.io
ACME_EMAIL=email-da-equipe@exemplo.com
```

Regras verificadas pelo `publicar.sh`:

- nenhum valor `SUBSTITUIR_*` restante;
- `POSTGRES_PASSWORD`, `MONGO_PASSWORD` e `JWT_SECRET` com pelo menos 24 caracteres;
- `DEV_SEED_PASSWORD` **ausente** (o seed não roda em produção);
- `CHAT_DOMAIN` sem `https://` e sem porta.

> **Nunca** commite o `deploy/.env` nem copie os segredos para o chat da equipe. Guarde-os no gerenciador de senhas da equipe. Trocar as senhas do banco depois da primeira publicação **não** altera os volumes já criados (ver runbook BE-18).

## 4. Publicar

```bash
cd /opt/corporate-chat
bash deploy/scripts/publicar.sh
```

O script valida o `.env`, gera as imagens, sobe os bancos, aplica as migrations e os índices, sobe a API e o proxy, e só termina com sucesso quando `https://<CHAT_DOMAIN>/api/v1/health` e a página inicial respondem.

## 5. Criar o administrador inicial

```bash
bash deploy/scripts/criar-admin.sh "Nome do Administrador" admin@empresa.com
```

A senha é pedida duas vezes, não aparece na tela e segue a mesma política do cadastro. Os demais usuários são criados pelo painel **Administração** ou aprovados a partir das solicitações de acesso.

## 6. Conferir a publicação

| Verificação | Como | Esperado |
|---|---|---|
| HTTPS válido | Abrir `https://<CHAT_DOMAIN>` | Cadeado sem alerta |
| HTTP redireciona | `curl -sI http://<CHAT_DOMAIN>` | `308` para `https://` |
| API | `curl -s https://<CHAT_DOMAIN>/api/v1/health` | `200` |
| Login do administrador | Tela de login | Link **Administração** visível |
| Tempo real | Duas janelas (uma anônima) com usuários diferentes | Mensagem aparece na outra janela sem recarregar |
| Bancos fechados | `curl -m 5 <IP>:5432` e `:27017` do seu computador | Sem resposta (tempo esgotado) |
| Contêineres | `docker compose -p corporate-chat-deploy ps` | Todos `running`/`healthy` |

## 7. Atualizar a aplicação

```bash
cd /opt/corporate-chat
bash deploy/scripts/backup.sh          # DEP-01.3: sempre antes de atualizar
git pull --ff-only
bash deploy/scripts/publicar.sh
```

As migrations novas são aplicadas automaticamente. Os volumes dos bancos e dos certificados são preservados.

## 8. Problemas comuns

| Sintoma | Causa provável | Ação |
|---|---|---|
| `publicar.sh` termina com "HTTPS não respondeu" | Porta 80/443 fechada ou `CHAT_DOMAIN` com IP errado | Conferir Security Group e IP elástico; ver `docker compose -p corporate-chat-deploy logs proxy` |
| Erro de certificado após várias tentativas | Limite de emissões do Let's Encrypt | Aguardar 1 hora; não apague o volume `caddy_data` |
| Build encerrado por falta de memória | Swap ausente | `swapon --show`; executar de novo o bootstrap (DEP-01.1) |
| "Muitas tentativas" para todos os usuários | `TRUST_PROXY` ausente | Usar sempre os dois arquivos compose (o `publicar.sh` já faz isso) |
| Login funciona mas o chat não atualiza | WebSocket bloqueado por rede corporativa | Testar em outra rede; o cliente cai para polling automaticamente |

## 9. Validação realizada antes do PR

Executada localmente, sem AWS e sem Docker (indisponível no ambiente de desenvolvimento):

| Item | Resultado |
|---|---|
| Testes do backend (`test:api`, `test:realtime`, `test:persistence`) | 198, 38 e 112 testes aprovados, incluindo 14 novos (`trust-proxy`, `create-admin`) |
| `createAdmin` em banco PostgreSQL **novo**, criado só pelas 9 migrations | Recusa senha fraca; cria administrador com bcrypt e e-mail normalizado; recusa segundo administrador |
| Build de produção do frontend com URL do mesmo endereço | Sem scripts ou estilos inline; URL gravada no bundle |
| Ensaio ponta a ponta no navegador (Edge) por um proxy local com **os mesmos cabeçalhos do Caddyfile** e a API em modo `production` com `TRUST_PROXY=1` | **17/17**: CSP sem violações, fallback de rotas, cache, login do administrador criado pelo comando, mensagem em tempo real por WebSocket pelo proxy, painel de administração, bloqueio de login (429) sem avisos de proxy |

**Pendente de validação no servidor:** emissão do certificado pelo Caddy, build das imagens Docker em ARM e o `publicar.sh` completo. Registre o resultado na tabela abaixo.

## 10. Registro de evidências

| Item | Evidência | Responsável | Data |
|---|---|---|---|
| Saída final do `publicar.sh` | | | |
| Cadeado HTTPS no navegador | | | |
| Administrador criado (`criar-admin.sh`) | | | |
| Mensagem em tempo real entre dois usuários | | | |
| Portas 5432/27017 inacessíveis de fora | | | |

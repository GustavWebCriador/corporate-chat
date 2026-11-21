# DEP-01.1 — Configuração da conta AWS e do servidor

**Resultado esperado:** conta AWS no plano Free protegida, com alerta de gastos, e uma instância EC2 em São Paulo já preparada (Docker, firewall, SSH só com chave), pronta para a publicação (DEP-01.2).

**Tempo estimado:** 40 minutos. **Quem executa:** o titular da conta, com um colega conferindo.

> Nada aqui exige plano pago. Se em algum momento o console pedir "Upgrade to paid plan", **não aceite**.

---

## 1. Criar a conta no plano Free

1. Acesse <https://aws.amazon.com/free/> → **Create a free account**.
2. Use um **e-mail da equipe** (não pessoal) e uma senha forte guardada no gerenciador de senhas da equipe.
3. Informe cartão e celular: são usados só para verificação de identidade.
4. Na escolha do plano, selecione **Free plan**.
5. Anote no diário de bordo a **data de criação**: a conta é encerrada automaticamente 6 meses depois.

## 2. Proteger a conta

1. **MFA no usuário raiz:** menu da conta (canto superior direito) → *Security credentials* → *Assign MFA device* → aplicativo autenticador.
2. **Não use o usuário raiz no dia a dia.** Em *IAM* → *Users* → *Create user*:
   - nome `equipe-admin`, acesso ao console, senha forte;
   - permissão `AdministratorAccess` (aceitável para o trabalho; remova ao final);
   - ative MFA também neste usuário.
3. Saia e entre de novo com `equipe-admin`. Daqui em diante, use só ele.
4. **Não crie chaves de acesso (access keys)**: nenhum passo deste guia precisa delas.

## 3. Alertas de gastos

Mesmo no plano Free, configure avisos para acompanhar o consumo dos créditos:

1. *Billing and Cost Management* → *Budgets* → *Create budget* → *Use a template* → **Monthly cost budget**.
2. Valor: **US$ 30**. E-mails: os da equipe.
3. *Billing* → *Credits*: confira o saldo disponível. Repita a consulta semanalmente.

## 4. Região

No seletor de região (canto superior direito), escolha **South America (São Paulo) sa-east-1**. Todos os recursos abaixo devem ser criados nela.

## 5. Par de chaves SSH

*EC2* → *Key pairs* → *Create key pair*:

- nome `corporate-chat-equipe`, tipo **ED25519**, formato **.pem**;
- guarde o arquivo **fora do repositório** (ex.: `C:\Users\<voce>\.ssh\corporate-chat-equipe.pem`);
- no Windows, restrinja o acesso ao arquivo (PowerShell):

```powershell
icacls "$env:USERPROFILE\.ssh\corporate-chat-equipe.pem" /inheritance:r /grant:r "$($env:USERNAME):(R)"
```

> Quem perder o arquivo perde o acesso SSH. Não envie a chave por chat nem a coloque no GitHub.

## 6. Security Group (firewall da AWS)

*EC2* → *Security Groups* → *Create security group*, nome `corporate-chat-web`:

| Tipo | Porta | Origem | Motivo |
|---|---|---|---|
| SSH | 22 | **My IP** | Administração, só do IP de quem administra |
| HTTP | 80 | 0.0.0.0/0 | Emissão do certificado e redirecionamento para HTTPS |
| HTTPS | 443 | 0.0.0.0/0 | Aplicação |
| Custom UDP | 443 | 0.0.0.0/0 | HTTP/3 (opcional) |

**Não abra** 3000, 3101, 5432 nem 27017. Se o IP de casa mudar, edite a regra SSH para o novo IP.

## 7. Criar a instância EC2

*EC2* → *Launch instance*:

| Campo | Valor |
|---|---|
| Name | `corporate-chat-prod` |
| AMI | **Ubuntu Server 24.04 LTS**, arquitetura **64-bit (Arm)** |
| Instance type | **t4g.small** (aparece como *Free tier eligible*) |
| Key pair | `corporate-chat-equipe` |
| Network settings | *Select existing security group* → `corporate-chat-web` |
| Storage | **20 GiB gp3**, *Encrypted* = **Yes** |
| Advanced → Credit specification | **Standard** (evita consumo extra de créditos por uso acima da linha de base) |
| Advanced → Metadata version | **V2 only (token required)** |
| Advanced → Termination protection | **Enable** |
| Advanced → User data | conteúdo inteiro de [`deploy/aws/cloud-init.yaml`](../../deploy/aws/cloud-init.yaml) |

> **Antes do merge na `main`:** os arquivos de implantação só existirão na `main` depois que os PRs do DEP-01 forem aceitos. Até lá, troque `REPO_BRANCH=main` por `REPO_BRANCH=deploy/DEP-01-3-seguranca-recuperacao` no user data.

Clique em **Launch instance**. A preparação automática leva de 5 a 10 minutos.

## 8. IP elástico (endereço fixo)

Sem IP elástico, o endereço muda toda vez que a instância é desligada e o certificado HTTPS deixa de valer.

1. *EC2* → *Elastic IPs* → *Allocate Elastic IP address* → *Allocate*.
2. *Actions* → *Associate Elastic IP address* → instância `corporate-chat-prod`.
3. Anote o IP (ex.: `15.228.10.20`). O endereço sslip.io será `15-228-10-20.sslip.io`.

> Um IP elástico **sem instância associada** continua consumindo créditos. No encerramento, libere-o (DEP-01.3, seção 7).

## 9. Conferir o servidor

No terminal do seu computador (PowerShell ou Git Bash):

```bash
ssh -i ~/.ssh/corporate-chat-equipe.pem ubuntu@15.228.10.20
```

No servidor:

```bash
cloud-init status --wait                       # deve terminar em: status: done
cat /var/lib/corporate-chat/bootstrap.done     # data da preparação
docker --version && docker compose version
sudo ufw status verbose                        # 22, 80, 443 liberadas; resto negado
sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'   # ambos "no"
swapon --show                                  # /swapfile 2G
ls /opt/corporate-chat                         # código do projeto
```

Se `cloud-init status` mostrar erro, veja `sudo tail -n 80 /var/log/cloud-init-output.log`. O bootstrap pode ser executado de novo com segurança:

```bash
sudo bash /opt/corporate-chat/deploy/aws/bootstrap-servidor.sh
```

**Saia e entre de novo no SSH** para o usuário `ubuntu` passar a usar o Docker sem `sudo`.

## 10. Critérios de aceite

- [ ] Conta no **plano Free**, com MFA no raiz e no `equipe-admin`.
- [ ] Orçamento de US$ 30 com e-mails da equipe.
- [ ] Instância `t4g.small` em **sa-east-1**, disco criptografado, IMDSv2, crédito *Standard*.
- [ ] Security Group com SSH restrito ao IP da equipe e sem portas de banco.
- [ ] IP elástico associado.
- [ ] `cloud-init status` = `done`; Docker instalado; `ufw` ativo; SSH sem senha.

## 11. Registro de evidências

| Item | Evidência (print ou saída do comando) | Responsável | Data |
|---|---|---|---|
| Plano Free e saldo de créditos | | | |
| MFA ativo (raiz e `equipe-admin`) | | | |
| Budget criado | | | |
| Instância e Security Group | | | |
| Saída da seção 9 | | | |

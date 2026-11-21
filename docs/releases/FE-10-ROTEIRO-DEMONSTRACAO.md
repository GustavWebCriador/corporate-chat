# Corporate Chat — FE-10 | Roteiro de demonstração do frontend

**Objetivo:** apresentar o MVP completo pela interface web — autenticação, conversas, grupos, tempo real e administração — relacionando cada passo aos requisitos da ERS v1.4.

**Duração sugerida:** 15 a 20 minutos.

---

## 1. Preparação (antes da apresentação)

- Usar a branch/commit de release do frontend e mostrar a CI aprovada (`Frontend CI`, `Backend CI` e `Integration CI`).
- Subir PostgreSQL e MongoDB, aplicar migrations e seed de desenvolvimento:

  ```powershell
  cd backend
  npm run db:migrate
  npm run seed:dev
  npm run dev
  ```

- Em outro terminal, iniciar o frontend:

  ```powershell
  cd frontend
  npm run dev
  ```

- Abrir `http://localhost:5173` em **duas janelas**: uma normal e uma anônima (cada uma com um usuário).
- Usar somente as contas de teste do seed (`alexandre@`, `eduardo@`, `mauricio@` e `gustavo@corporatechat.local`). A senha é o valor de `DEV_SEED_PASSWORD` do `.env` local — **não exibir o `.env`, tokens ou senhas na tela**.
- Deixar uma solicitação de acesso pendente para demonstrar a aprovação (pode ser criada no passo 2).
- **Não recarregar a página (F5) durante a demonstração:** o token fica apenas em memória e o recarregamento encerra a sessão (comportamento de segurança documentado).

---

## 2. Sequência sugerida

| # | Cenário | Como demonstrar | Requisito |
|---|---|---|---|
| 1 | Login e acesso restrito | Abrir `/dashboard` sem login (redireciona para `/login`); errar a senha; entrar como Alexandre | RF01, CA01.3, CA05.1 |
| 2 | Solicitação de acesso | Em "Solicitar acesso", enviar nome e e-mail; mostrar que não há acesso automático | RF04, CA04.1, CA04.2 |
| 3 | Dashboard | Contatos, conversas recentes e grupos com ícone e etiqueta "Grupo" | RF05, CA05.3 |
| 4 | Conversa privada | Clicar em **Eduardo** nos contatos; a conversa abre | RF06, CA05.2, CA06.1 |
| 5 | Tempo real | Na outra janela (Eduardo), abrir a conversa; trocar mensagens — aparecem sem recarregar | RF12, CA06.3, CA12.1 |
| 6 | Estados da mensagem | Mostrar Enviando → Enviada → Entregue → **Lida** quando o outro lê | RF07 |
| 7 | Limites | Mostrar contador 0/1000 e botão desativado com mensagem vazia | CA07.1–CA07.3 |
| 8 | Histórico | Abrir conversa longa; rolar ao topo para carregar mensagens anteriores; data/hora em cada mensagem | RF11, RF13, CA11.2–CA11.4 |
| 9 | Reconexão | Parar o backend por alguns segundos: aparece **"Reconectando..."**; ao reiniciá-lo, o aviso some e as mensagens voltam a chegar em tempo real | RF12, CA12.3, CA12.4 |
| 10 | Falha e reenvio | Com o backend parado, enviar mensagem: **Falha no envio** + "Tentar novamente"; reenvio automático ao reconectar | RF08, CA08.3, CA08.4 |
| 11 | Usuário offline | Fechar a janela de Eduardo, enviar mensagem; reabrir e entrar: mensagem disponível | RF08, CA08.1, CA08.2 |
| 12 | Grupos | **+ Novo grupo**: nome (até 30) e participantes; abrir **Participantes**: renomear, adicionar, remover; outro membro **sair do grupo** | RF09, RF10, CA09.1–CA09.9 |
| 13 | Administração | Entrar como Gustavo (administrador) → **Administração**: aprovar a solicitação do passo 2 com senha inicial; entrar com a nova conta | RF03, RF04, CA04.3, CA04.4 |
| 14 | Gestão de usuários | Desativar um usuário (login bloqueado), reativar e redefinir senha | RF03, CA03.3, CA03.5 |
| 15 | Autorização | Entrar como usuário comum e acessar `/admin`: volta ao dashboard | CA03.4 |
| 16 | Sessão | **Sair**: dashboard deixa de ficar acessível | RF14, CA14.1–CA14.3 |
| 17 | Responsividade | Reduzir a janela para largura de celular: conversas, chat com "Voltar" | RNF06 |
| 18 | Qualidade | Mostrar a CI e os resultados de testes (seção 4) | RNF07 |

---

## 3. Plano de contingência

| Situação | Ação |
|---|---|
| Socket.IO indisponível | O envio continua pela API REST; mostrar o aviso de conexão e a mensagem ao reabrir a conversa |
| Banco fora do ar | `GET /api/v1/health` mostra o serviço afetado; reiniciar o banco e o backend |
| Login bloqueado por tentativas | Aguardar a janela de 15 minutos ou reiniciar o backend local |
| Solicitação de acesso bloqueada | O cadastro público aceita 5 solicitações por hora por IP; usar solicitação criada antes |
| Sessão encerrada por recarregar a página | Entrar novamente (comportamento esperado) |

---

## 4. Evidências para apresentar

```powershell
cd frontend
npm test                 # testes de unidade e de acessibilidade
npm run test:integration # integração front/back (backend em execução)
```

- Resultados registrados em [FE-10-NOTAS-DA-VERSAO.md](FE-10-NOTAS-DA-VERSAO.md).
- Rastreabilidade requisito → tela → teste em [FE-10-RELATORIO-DE-HOMOLOGACAO.md](FE-10-RELATORIO-DE-HOMOLOGACAO.md).

---

## 5. Registro da apresentação

- Data: PENDENTE
- Participantes: PENDENTE
- Branch/commit demonstrado: PENDENTE
- Cenários executados: PENDENTE
- Resultado da CI: PENDENTE
- Observações/limitações: PENDENTE

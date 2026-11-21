# Corporate Chat — Notas da Versão | Frontend MVP

**Projeto:** Corporate Chat — Projeto de Extensão I (IFSC)
**Etapa:** EPIC-FE — Frontend MVP
**Referência de requisitos:** ERS v1.4
**Situação:** preparado para revisão; publicação condicionada ao merge dos Pull Requests e à CI aprovada.

---

## 1. Resumo

O frontend do Corporate Chat é uma aplicação React que consome a API REST e o Socket.IO do backend. Esta versão entrega o fluxo completo do MVP pela interface: autenticação, solicitação de acesso, dashboard, conversas privadas, grupos, mensagens em tempo real e administração mínima de usuários.

---

## 2. Tecnologias utilizadas

| Área | Tecnologia |
|---|---|
| Interface | React 19, React Router |
| Build | Vite |
| Estilos | Tailwind CSS |
| HTTP | Axios |
| Tempo real | socket.io-client |
| Testes | Vitest, Testing Library, jsdom, axe-core |

---

## 3. Funcionalidades implementadas

| PBI | Entrega |
|---|---|
| FE-01 | Estrutura React/Vite, roteamento, cliente HTTP centralizado |
| FE-02 | Login, logout, rota protegida, solicitação de cadastro; encerramento da sessão expirada ou revogada com aviso ao usuário |
| FE-03 | Dashboard com contatos e conversas recentes |
| FE-04 | Conversas privadas, histórico paginado (50 + anteriores), envio com limite de 1.000 caracteres, estados Enviando/Enviada/Falha e reenvio idempotente |
| FE-05 | Criação de grupos (2 a 50 participantes, nome até 30), renomear, adicionar, remover e sair |
| FE-06 | Tempo real: envio e recebimento por Socket.IO, Entregue/Lida, "Reconectando..." e sincronização após reconexão |
| FE-07 | Testes de integração front/back e workflow de CI dedicado |
| FE-08 | Administração: solicitações de acesso (aprovar/rejeitar) e usuários (cadastrar, ativar/desativar, redefinir senha) |
| FE-09 | Responsividade (celular, tablet, desktop), acessibilidade WCAG 2.1 AA e testes automáticos com axe |
| FE-10 | Documentação, notas da versão, homologação e roteiro de demonstração |

---

## 4. Qualidade e validação

### 4.1. Testes automatizados

| Suíte | Comando | Resultado |
|---|---|---|
| Unidade e componentes | `npm test` | 105 testes aprovados |
| Acessibilidade (axe-core) | incluída em `npm test` | 6 cenários (login, solicitação, dashboard, chat, janelas de grupo, administração) sem violações |
| Integração front/back | `npm run test:integration` | 11 testes aprovados (5 suítes) |
| Lint | `npm run lint` | sem erros |
| Build | `npm run build` | concluído |

### 4.2. Validação com o sistema real

Cada PBI foi validado com o código real do frontend contra o backend com PostgreSQL e MongoDB:

| PBI | Cenários |
|---|---|
| FE-04 | Abertura e reutilização de conversa, envio, idempotência, limites, histórico paginado, privacidade |
| FE-06 | Recebimento sem recarregar, leitura, envio, "Lida", queda e sincronização |
| FE-05 | Criação pela interface, regras de limite, renomear, adicionar, remover, reentrada não suportada, saída |
| FE-08 | Bloqueio de usuário comum, aprovação, rejeição, cadastro, desativação, reativação e redefinição de senha |

### 4.3. Acessibilidade

Auditoria no navegador com axe-core (WCAG 2.0/2.1 A e AA e boas práticas) em 8 telas, nas larguras de 1280 px e 390 px:

- antes do FE-09: 20 problemas em 188 elementos (contraste, regiões da página, estilos padrão do navegador);
- depois do FE-09: nenhuma violação.

### 4.4. Integração contínua

| Workflow | Verifica |
|---|---|
| `Frontend CI` | lint, testes e build do frontend |
| `Backend CI` | testes do backend com PostgreSQL e MongoDB |
| `Integration CI` | bancos criados do zero, backend em execução e testes de integração do frontend |

---

## 5. Segurança

- JWT mantido apenas em memória; nenhuma credencial em variáveis `VITE_`.
- Resposta 401 de requisição autenticada encerra a sessão local e informa o usuário.
- O socket é desconectado no logout e encerra a sessão quando o backend recusa o token.
- Rotas administrativas protegidas na interface; a autorização efetiva continua no backend.
- O frontend não envia identidade (`senderId`, `creatorId`); ela é obtida do JWT pelo backend.

---

## 6. Limitações conhecidas

| Limitação | Observação |
|---|---|
| Recarregar a página encerra a sessão | O token fica em memória por segurança; não há refresh token no backend |
| Estados Entregue/Lida de mensagens antigas | O backend não informa os checkpoints dos outros participantes ao abrir a conversa; os estados são atualizados pelos eventos em tempo real |
| Criador do grupo não pode sair | Regra do backend no MVP (sem transferência de responsabilidade) |
| Reentrada em grupo | Quem saiu ou foi removido não pode ser adicionado novamente (regra do backend) |
| Administrador pode desativar a própria conta pela API | A interface impede; recomenda-se a mesma regra no backend |
| Limite do cadastro público | 5 solicitações por hora por IP |

---

## 7. Documentação

- [README do frontend](../../frontend/README.md)
- [Roteiro de demonstração](FE-10-ROTEIRO-DEMONSTRACAO.md)
- [Relatório de homologação](FE-10-RELATORIO-DE-HOMOLOGACAO.md)
- [Integração com o frontend (API)](../api-docs/FRONTEND_INTEGRATION.md)

---

## 8. Versionamento

| Branch | PBI |
|---|---|
| `fix/sessao-expirada-e-ajustes-validacao` | Correções da validação (sessão expirada, login, teste PostgreSQL 18) |
| `feat/FE-04-conversas-mensagens` | FE-04 |
| `feat/FE-06-tempo-real` | FE-06 |
| `feat/FE-05-grupos` | FE-05 |
| `feat/FE-08-administracao` | FE-08 |
| `feat/FE-07-testes-integracao` | FE-07 |
| `feat/FE-09-responsividade-acessibilidade` | FE-09 |
| `docs/FE-10-documentacao-demonstracao` | FE-10 |

As branches são encadeadas; os merges devem seguir a ordem da tabela.

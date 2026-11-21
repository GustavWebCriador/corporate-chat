# Corporate Chat — FE-10 | Relatório de homologação do frontend

**Referência:** ERS v1.4 — requisitos funcionais RF01 a RF14 e critérios gerais do MVP (seção 30).
**Método:** cada critério foi verificado por testes automatizados (unidade/componentes e integração com o backend real) e, quando aplicável, pela auditoria no navegador.

Legenda das evidências:

- **U** — teste de unidade/componente (`npm test`)
- **I** — teste de integração com backend real (`npm run test:integration`)
- **N** — verificação no navegador (auditoria FE-09)

---

## 1. Requisitos funcionais

| Requisito | Critério | Implementação no frontend | Evidência |
|---|---|---|---|
| RF01 Autenticação | CA01.1–CA01.5 | Tela de login, JWT em memória | U `AuthProvider`, I `auth` |
| | CA01.3 | Mensagem "E-mail ou senha inválidos" | U, I `auth` |
| RF02 Sessão | CA02.1–CA02.3 | 401 global encerra a sessão; aviso "sessão encerrada por segurança" | U `httpClient`, `AuthProvider`, `AppRoutes`; I `auth` |
| RF03 Administração | CA03.1 | Cadastro de usuário | U `UsersPanel`, I `admin` |
| | CA03.2 | Usuário cadastrado entra | I `admin` |
| | CA03.3 | Desativar/ativar com confirmação; login bloqueado | U, I `admin` |
| | CA03.4 | Rota `/admin` restrita; atalho só para administrador | U `AppRoutes`, I `admin` |
| | CA03.5 | Redefinição de senha | U, I `admin` |
| RF04 Solicitação de cadastro | CA04.1 | Link "Solicitar acesso" no login | U `AppRoutes` |
| | CA04.2 | Solicitação não dá acesso | I `admin` |
| | CA04.3–CA04.4 | Aprovação com senha inicial / rejeição com motivo | U `RegistrationRequestsPanel`, I `admin` |
| RF05 Dashboard | CA05.1 | Rota protegida | U `AppRoutes`, I `auth` |
| | CA05.2 | Contato clicável abre conversa | U `DashboardPage`, `ContactList` |
| | CA05.3 | Grupo com ícone e etiqueta próprios | U `ConversationList` |
| RF06 Conversas privadas | CA06.1 | Criação/reutilização da conversa | U `DashboardPage`, I `conversations` |
| | CA06.2 | Envio de texto | U `ChatPanel`, I `conversations` |
| | CA06.3 | Recebimento em tempo real | U `ChatPanel.realtime`, I `realtime` |
| | CA06.4 | Histórico persistido | I `conversations` |
| RF07 Envio | CA07.1–CA07.3 | Limite de 1.000, contador, sem mensagem vazia | U `ChatPanel`, I `conversations` |
| | CA07.4 | Data/hora em cada mensagem | U `ChatPanel` |
| | Estados | Enviando → Enviada → Entregue → Lida, ou Falha | U `ChatPanel`, `ChatPanel.realtime`, `messages`; I `realtime` |
| RF08 Offline | CA08.1–CA08.2 | Mensagens disponíveis ao retornar | I `conversations` |
| | CA08.3 | Indicação visual de falha | U `ChatPanel` |
| | CA08.4 | Reenvio automático com o mesmo `clientMessageId` | U `ChatPanel`, `ChatPanel.realtime`; I `conversations` |
| RF09 Grupos | CA09.1–CA09.4 | Criação com participantes e nome; aparece na lista | U `CreateGroupDialog`, `DashboardPage`; I `groups` |
| | CA09.5 | Identificação visual de grupo | U `ConversationList` |
| | CA09.6–CA09.9 | Adicionar, remover, renomear, sair | U `GroupDetailsDialog`, I `groups` |
| RF10 Mensagens em grupo | CA10.1–CA10.3 | Mesmo chat para grupos; ex-membro perde acesso | I `groups`, `conversations` |
| RF11 Histórico | CA11.1–CA11.4 | 50 mensagens iniciais e anteriores por cursor | U `ChatPanel`, I `conversations` |
| RF12 Tempo real | CA12.1–CA12.2 | Socket.IO | U `RealtimeProvider`, I `realtime` |
| | CA12.3 | "Reconectando..." | U `RealtimeProvider`, I `realtime` |
| | CA12.4 | Sincronização após reconexão | U `ChatPanel.realtime`, I `realtime` |
| RF13 Rolagem | CA13.1–CA13.2 | Abre na mensagem mais recente; carrega anteriores ao rolar ao topo | U `ChatPanel`; N (desktop e celular) |
| RF14 Encerramento de sessão | CA14.1–CA14.3 | Botão "Sair"; token revogado; rota protegida redireciona | U `AuthProvider`, `AppRoutes`; I `auth` |

---

## 2. Requisitos não funcionais relacionados à interface

| Requisito | Verificação | Evidência |
|---|---|---|
| RNF01/RNF02 Segurança e acesso | JWT em memória; 401 global; rotas protegidas; socket encerrado no logout | U, I `auth` |
| RNF03 Privacidade | Terceiro recebe 403 em conversa alheia | I `conversations`, `groups` |
| RNF06 Usabilidade/responsividade | Layout em 1280 px e 390 px; axe sem violações | N, U `accessibility` |
| RNF07 Manutenibilidade | Organização por funcionalidade (`features/`), serviços por domínio, CI | Código e workflows |
| RNF10 Compatibilidade | Build Vite para navegadores modernos; testado em Microsoft Edge (Chromium) | N |

---

## 3. Critérios gerais do MVP (ERS, seção 30)

| # | Critério | Situação |
|---|---|---|
| 1 | Usuário autorizado realiza login | Atendido |
| 2 | Não autenticado não acessa áreas protegidas | Atendido |
| 3 | Iniciar conversas privadas | Atendido |
| 4 | Criar grupos dentro dos limites | Atendido |
| 5 | Enviar mensagens de texto | Atendido |
| 6 | Dados cadastrais no PostgreSQL | Atendido (backend) |
| 7 | Mensagens no MongoDB | Atendido (backend) |
| 8 | Mensagens em tempo real | Atendido |
| 9 | Usuários offline recebem depois | Atendido |
| 10 | Histórico consultável | Atendido |
| 11 | Comportamento de reconexão | Atendido |
| 12 | Interface nos dispositivos previstos | Atendido (desktop e celular) |
| 13 | Restrito ao escopo da Extensão I | Atendido |

---

## 4. Pendências fora do código

| Item | Responsável |
|---|---|
| Validação da ERS pelo professor/orientador | Equipe |
| Atualização do Modelo de Dados (e-mail com 150 caracteres e sessões persistidas) | Equipe — ver [adendo do Modelo de Dados](../persistence/ADENDO-MODELO-DADOS-v1.3.md) |
| Registro da apresentação no diário de bordo | Equipe |
| Mapeamento das User Stories US01–US26 do Notion para esta tabela | Equipe |

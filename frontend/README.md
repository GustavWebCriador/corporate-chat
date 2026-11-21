# Corporate Chat — Frontend

Interface web do Corporate Chat desenvolvida
com React, JavaScript e Vite.

## Pré-requisitos

- Node.js compatível com Vite
- npm
- Backend Corporate Chat configurado

## Instalação

cd frontend
npm ci

## Configuração

Copie .env.example para .env.local.

Configure VITE_BACKEND_URL com o endereço
do backend.

## Desenvolvimento

npm run dev

## Validação

npm run lint
npm test
npm run build

## Testes de integração (FE-07)

Executam o código real do frontend contra o backend em execução,
com PostgreSQL e MongoDB populados pelo seed de desenvolvimento.
Cobrem sessão, conversas, tempo real, grupos e administração.

Pré-requisitos:

1. Bancos em execução e backend configurado.
2. No backend: npm run db:migrate, npm run seed:dev e npm start.

Execução (no diretório frontend):

    VITE_BACKEND_URL=http://localhost:3000     INTEGRATION_PASSWORD=<valor de DEV_SEED_PASSWORD do backend>     npm run test:integration

Os testes criam dados com identificadores únicos por execução, sem
alterar os registros do seed. Cada execução envia 2 solicitações de
cadastro públicas; o backend aceita 5 por hora por IP, então execuções
seguidas podem receber "Muitas solicitações" — aguarde ou reinicie o
backend local (o contador fica em memória). No CI, o workflow
.github/workflows/integration-ci.yml cria os bancos do zero e executa
a mesma suíte a cada Pull Request.

## Integração

A interface utiliza a API REST do backend,
sob o prefixo /api/v1.

A comunicação em tempo real será realizada
por Socket.IO, conforme a documentação
do projeto.
## Funcionalidades implementadas

| PBI | Funcionalidade |
|---|---|
| FE-01 | Estrutura React/Vite, roteamento e cliente HTTP |
| FE-02 | Login, logout, rota protegida e solicitação de cadastro |
| FE-03 | Dashboard com contatos e conversas recentes |
| FE-04 | Conversas privadas e mensagens |
| FE-05 | Gerenciamento de grupos |
| FE-06 | Comunicação em tempo real (Socket.IO) |
| FE-08 | Interfaces administrativas |
| FE-07 | Testes de integração front/back |
| FE-09 | Responsividade, acessibilidade e usabilidade |

### FE-04 — Conversas privadas e mensagens

- Selecionar um contato cria ou reutiliza a conversa privada
  (`POST /conversations/private`).
- Conversas recentes podem ser abertas pela lista; grupos possuem
  ícone e etiqueta próprios.
- O histórico carrega as 50 mensagens mais recentes e páginas
  anteriores pelo cursor do backend (`before`), ao rolar até o topo
  ou pelo botão "Carregar mensagens anteriores".
- Cada mensagem exibe autor e data/hora; a rolagem inicia na
  mensagem mais recente.
- Envio limitado a 1.000 caracteres, sem mensagens vazias, com os
  estados Enviando → Enviada ou Falha.
- Mensagens com falha podem ser reenviadas e são reenviadas
  automaticamente quando o navegador volta a ficar online, sempre
  com o mesmo `clientMessageId` (envio idempotente).
- A leitura da última mensagem recebida é registrada em
  `PATCH /conversations/:id/read`.

### FE-06 — Comunicação em tempo real

- Uma única conexão Socket.IO por sessão (`RealtimeProvider`): conecta
  após o login, desconecta no logout e encerra a sessão se o backend
  recusar o token.
- Com o socket conectado, o envio usa `message:send` (com ACK) e as
  mensagens chegam por `message:new`, sem recarregar a página. Sem
  socket, o envio continua pela API REST.
- Entrega e leitura são confirmadas por `message:delivered` e
  `message:read`; as mensagens próprias exibem Entregue/Lida a partir
  de `message:delivery:update` e `message:read:update` (em grupos,
  "Lida por N").
- Queda da conexão exibe "Reconectando...". Ao reconectar, a conversa
  aberta é sincronizada com `realtime:sync` e as mensagens com falha
  são reenviadas com o mesmo `clientMessageId`.
- O dashboard atualiza a lista de conversas ao chegar mensagem nova e
  confirma a entrega mesmo com a conversa fechada.

Limitação: o backend não informa os checkpoints dos outros
participantes ao abrir a conversa; por isso, mensagens antigas aparecem
como "Enviada" e Entregue/Lida são atualizados a partir dos eventos em
tempo real.

### FE-05 — Gerenciamento de grupos

- "Novo grupo" no dashboard: nome com até 30 caracteres e seleção de
  participantes com busca; o criador entra automaticamente (total de 2
  a 50). O grupo criado aparece na lista e é aberto em seguida.
- "Participantes" no cabeçalho do grupo lista os membros e o papel de
  cada um (Criador/Membro).
- O criador pode renomear o grupo, adicionar participantes (até 50) e
  remover participantes, com confirmação.
- Os demais participantes podem sair do grupo, com confirmação. O
  criador não pode sair nesta versão (regra do backend).
- Erros do backend (limites, reentrada não suportada etc.) são
  exibidos com mensagens em português.

### FE-08 — Interfaces administrativas

- Rota `/admin`, visível e acessível somente para administradores
  (`is_admin`); usuário comum é levado ao dashboard. O backend também
  recusa as rotas administrativas (403).
- **Solicitações de acesso:** filtro por situação (pendentes,
  aprovadas, rejeitadas, todas) e paginação de 20 em 20. Aprovar exige
  senha inicial (mesma política do backend); rejeitar exige motivo
  (até 500 caracteres).
- **Usuários:** listagem com busca, situação e perfil; cadastro de
  usuário; ativar/desativar com confirmação; redefinição de senha pelo
  administrador.
- O administrador não pode desativar a própria conta pela interface.

### FE-09 — Responsividade, acessibilidade e usabilidade

- Reset de estilos aplicado somente à área autenticada (`.app-surface`):
  botões sem fundo padrão do navegador, listas sem marcadores e links
  legíveis no tema escuro. As telas públicas mantêm o visual original.
- Celular: conversas aparecem antes dos contatos, a lista de contatos
  tem altura limitada, a barra lateral fixa é ocultada e o chat ocupa a
  tela com o botão "Voltar".
- A partir de tablet, a página ocupa a altura da tela e apenas as
  listas rolam; o chat abre na mensagem mais recente e carrega o
  histórico ao rolar até o topo.
- Contraste: cores de avatar com texto branco em 4,5:1 ou mais (WCAG AA).
- Teclado: link "Pular para o conteúdo", foco sempre visível e regiões
  `main` nas páginas autenticadas.
- `src/accessibility.test.jsx` executa o axe-core nas principais telas
  a cada `npm test` (o contraste é verificado no navegador, pois o
  jsdom não calcula layout).

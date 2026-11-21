
# Corporate Chat — Frontend

Interface web do Corporate Chat, desenvolvida com React, JavaScript, Vite e Tailwind CSS.

O frontend consome a API REST do Corporate Chat e utiliza Socket.IO para comunicação em tempo real.

## Tecnologias

- React
- JavaScript
- Vite
- Tailwind CSS
- Axios
- React Router
- Socket.IO Client
- Vitest e React Testing Library

## Funcionalidades implementadas

### Autenticação e acesso
- Login utilizando JWT.
- Proteção de rotas autenticadas.
- Encerramento de sessão.
- Solicitação pública de cadastro.

### Dashboard
- Listagem de contatos ativos.
- Pesquisa de contatos.
- Abertura ou reutilização de conversas privadas.
- Visualização de conversas recentes.

### Conversas e mensagens
- Consulta do histórico de mensagens.
- Paginação de mensagens anteriores.
- Envio de mensagens pela API REST ou Socket.IO.
- Recebimento de mensagens em tempo real.
- Prevenção de mensagens duplicadas.
- Reenvio idempotente após falhas.
- Recuperação de mensagens após reconexão.

### Entrega e leitura
- Confirmação de entrega.
- Confirmação de leitura.
- Indicadores Enviada, Entregue e Lida.
- Recebimento de atualizações por Socket.IO.
- Recuperação de checkpoints persistidos pela API REST.

## Pré-requisitos

- Node.js compatível com a versão do Vite utilizada.
- npm.
- Backend Corporate Chat configurado.
- PostgreSQL e MongoDB disponíveis para o backend.

## Instalação

A partir da raiz do repositório:

```powershell
cd frontend
npm ci
```

## Configuração

Crie um arquivo `.env.local` baseado no `.env.example`.

No PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Configure:

```env
VITE_BACKEND_URL=http://localhost:3000
```

A variável deve apontar para o endereço do backend, sem o prefixo `/api/v1`.

## Desenvolvimento

```powershell
npm run dev
```

Acesse o endereço apresentado pelo Vite no terminal.

## Testes e validação

```powershell
npm run lint
npm test
npm run build
```

## Integração com o backend

A API REST utiliza o prefixo `/api/v1`.

A autenticação HTTP utiliza JWT no header Authorization.

O Socket.IO utiliza o mesmo token para estabelecer a conexão autenticada.

As mensagens são sincronizadas por meio de `realtime:sync`.

Os checkpoints de entrega e leitura podem ser consultados em:

`GET /api/v1/conversations/:conversationId/checkpoints`

## Organização do código

- `src/features/auth` — autenticação.
- `src/features/dashboard` — contatos e dashboard.
- `src/features/conversations` — mensagens e histórico.
- `src/features/realtime` — conexão e eventos Socket.IO.
- `src/services/api` — integração HTTP.
- `src/services/realtime` — serviços de comunicação em tempo real.

## Limitações atuais

- A interface de mensagens implementada nesta etapa é voltada às conversas privadas.
- A sessão JWT é mantida em memória; atualizar a aplicação pode exigir novo login.
- Os recursos de canais, threads, reações e anexos das referências visuais ainda não fazem parte desta implementação.
- Criptografia de ponta a ponta não foi implementada nesta etapa.
- Indicadores de mensagens cujo checkpoint esteja fora do histórico carregado podem exigir aprimoramento na consulta de estados.

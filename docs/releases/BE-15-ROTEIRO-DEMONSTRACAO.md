# Corporate Chat — BE-15 | Roteiro de demonstração do backend

**Objetivo:** apresentar o funcionamento do backend MVP e evidenciar os testes, sem depender de uma interface React concluída.

## Preparação (antes da apresentação)
- Abrir o repositório na branch/commit de release e mostrar a documentação técnica.
- Garantir Docker Desktop estável; manter somente ambientes necessários ativos.
- Usar apenas credenciais e dados fictícios, sem expor tokens JWT, `.env`, senhas, dumps ou logs de mensagens reais.
- Iniciar PostgreSQL e MongoDB do ambiente de desenvolvimento com `npm run env:sync`; iniciar API com `npm run dev` em terminal separado.
- Verificar a porta HTTP configurada no `.env` local (padrão do backend: 3000).
- Ter evidência da CI `Backend CI` concluída.

## Sequência sugerida de demonstração (10–15 min)
| Ordem | Cenário | O que comprovar |
|---|---|---|
| 1 | `GET /api/v1/health` | API e dois bancos conectados (HTTP 200) |
| 2 | `POST /api/v1/auth/login` | JWT emitido para conta de teste `ACTIVE` |
| 3 | `GET /api/v1/auth/me` | Rota protegida identifica usuário atual; acesso sem JWT recebe 401 |
| 4 | `GET /api/v1/dashboard` | Contatos e conversas do usuário autenticado |
| 5 | `POST /api/v1/conversations/private` | Criação/reutilização de conversa entre usuários de teste |
| 6 | `POST /api/v1/conversations/:id/messages` | Mensagem persiste no MongoDB; reenvio idempotente |
| 7 | Socket.IO | Usuário recebe evento em tempo real; reconexão e sincronização |
| 8 | Histórico/ACK | Paginação, entregue/lida, sincronização após desconexão |
| 9 | `POST /api/v1/groups` / operações de grupo | Gestão de participantes e restrições de acesso |
| 10 | Teste de autorização | Usuário não membro não acessa conversa/grupo (403) |
| 11 | `npm test` / CI | 334 testes do ensaio anterior; registrar resultado real da release |
| 12 | Runbook BE-18 | Mostrar deploy local, manifesto e restauração com IDs preservados (sem expor backups) |

> Os formatos exatos de payload e eventos estão em `docs/api-docs/`. Não inventar campos de requisição; usar exemplos da documentação e usuários de teste válidos. A apresentação não precisa gerar novos dados se forem apresentadas evidências verificáveis dos testes de integração e realtime.

## Comandos mínimos para demonstrar saúde da API (PowerShell)

Terminal da API:

```powershell
cd "C:\Users\Corp IT Solutions\corporate-chat\backend"
npm run dev
```

Segundo terminal (porta local padrão 3000; ajustar se necessário):

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/v1/health' -UseBasicParsing
```

O endpoint de health não prova sozinho login, chat e Socket.IO; apresentar testes de API/realtime como evidência complementar.

## Registro da apresentação
- Data: PENDENTE
- Participantes: PENDENTE
- Branch/commit demonstrado: PENDENTE
- Teste de saúde HTTP: PENDENTE
- Evidências dos fluxos protegidos: PENDENTE
- Resultado `npm test`/CI: PENDENTE
- Observações/limitações: PENDENTE

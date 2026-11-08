# Corporate Chat — BE-17 | Relatório de desempenho e concorrência

**Product Backlog:** Backend — BE-17 (Testar desempenho e concorrência)  
**Ambiente:** desenvolvimento local, API Node.js/Express/Socket.IO em `127.0.0.1:3000`, PostgreSQL e MongoDB em containers Docker  
**Situação da documentação:** resultados executados e validados; revisão do código, commit, Pull Request e CI ainda pendentes.  
**Data de referência:** novembro de 2026.

## 1. Objetivo

Avaliar o comportamento do backend sob requisições HTTP concorrentes, conexões Socket.IO simultâneas, sincronização em tempo real, envio simultâneo de mensagens e leitura de histórico paginado. Verificar integridade, idempotência e consistência da referência à última mensagem de cada conversa.

Os testes foram realizados no ambiente local de desenvolvimento, não em produção. As requisições foram disparadas pelo computador de desenvolvimento, sem simulação de rede real ou usuários geograficamente distribuídos.

## 2. Ferramentas e procedimentos

Scripts utilizados, sob `backend/scripts/performance/`:

- `http-load.js`: quantidade fixa de requisições HTTP GET, concorrência limitada e métricas de latência.
- `socket-load.js`: conexões WebSocket autenticadas, evento `realtime:ready` e sincronização `realtime:sync` com ACK.
- `message-load.js`: usuários distintos temporários, envio concorrente de mensagens, ACKs, observação de `message:new`, idempotência e consistência de `last_message_id`.
- `history-load.js`: conversa isolada com 550 mensagens, validação das 11 páginas e benchmark da primeira página e página com cursor `before`.
- `http-sustained.js`: duração de 30 segundos, 10 ou 20 requisições em andamento, análise por janelas de 5 segundos.

Os scripts de preparação de dados temporários executam limpeza em encerramentos normais; uma interrupção forçada pode exigir verificação manual. Os testes exigem ambiente de desenvolvimento local. Credenciais e JWT não são incluídos neste relatório.

## 3. Resultados HTTP iniciais

Cada linha representa uma execução de **100 requisições**, com a concorrência indicada.

| Endpoint | Concorrência | Sucessos | Falhas | Throughput (req/s) | p95 (ms) | p99 (ms) |
|---|---:|---:|---:|---:|---:|---:|
| Health | 5 | 100 | 0 | 235,16 | 40,82 | 69,16 |
| Health | 10 | 100 | 0 | 261,25 | 80,12 | 98,01 |
| Health | 20 | 100 | 0 | 301,89 | 90,85 | 177,92 |
| Dashboard | 5 | 100 | 0 | 56,20 | 151,43 | 152,92 |
| Dashboard | 10 | 100 | 0 | 64,57 | 192,68 | 215,18 |
| Dashboard | 20 | 100 | 0 | 55,59 | 422,86 | 516,99 |
| Histórico básico | 5 | 100 | 0 | 122,32 | 48,61 | 94,93 |
| Histórico básico | 10 | 100 | 0 | 126,64 | 114,32 | 126,88 |
| Histórico básico | 20 | 100 | 0 | 99,00 | 249,17 | 260,25 |

As nove execuções somaram **900 requisições HTTP sem falhas**. As durações curtas dessas amostras impedem tratá-las como evidência de capacidade sustentada.

### 3.1. Dashboard: carga ampliada

| Requisições | Concorrência | HTTP 200 | Falhas | Duração | Req/s | p50 | p95 | p99 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 500 | 20 | 500 | 0 | 7,89 s | 63,38 | 306,49 ms | 390,29 ms | 471,52 ms |

Uma execução preliminar foi interrompida no *preflight* com HTTP 401 devido a autenticação indisponível/inválida. Após obter novo JWT, o teste de 500 requisições foi realizado com êxito. **As tentativas 401 de preflight não integram as métricas da carga.**

## 4. Socket.IO — conexões e sincronização

Todos os clientes receberam `realtime:ready`; todas as sincronizações receberam ACK válido. Este cenário utilizou várias conexões com **um mesmo usuário JWT**, não identidades distintas.

| Clientes | Conexões | Syncs | Falhas | Conexão p95 | Sync p95 |
|---:|---:|---:|---:|---:|---:|
| 5 | 5 | 5 | 0 | 206,91 ms | 93,88 ms |
| 10 | 10 | 10 | 0 | 130,66 ms | 62,53 ms |
| 20 | 20 | 20 | 0 | 105,40 ms | 97,00 ms |

Total: **35 conexões e 35 sincronizações aprovadas**. As diferenças de latência não demonstram escalabilidade linear, pois as execuções foram curtas e não repetidas de maneira estatística.

## 5. Envio concorrente — descoberta e correção

### 5.1. Problema reproduzido

A primeira execução com cinco usuários distintos persistiu todas as mensagens, entregou eventos e retornou ACKs, mas `lastMessageConsistent = false`. O problema voltou a ocorrer com vinte usuários, e não ocorreu com dez. Assim, foram observadas inconsistências intermitentes na referência à última mensagem.

Causa identificada na implementação anterior de `chatPersistenceService.js`: múltiplas requisições atualizavam e salvavam o mesmo documento de conversa, permitindo que um salvamento posterior de uma mensagem cronologicamente mais antiga substituísse os metadados de uma mais recente.

### 5.2. Correção aplicada e validada

A atualização de `last_message_id` e `last_message_at` passou a ser atômica e condicional no MongoDB: somente uma mensagem com `created_at` posterior, ou com timestamp igual e `_id` maior, pode avançar a referência.

Foi incluído o teste de integração **“envios simultâneos preservam a última mensagem correta”** em `database/tests/integration/messages-integration.test.js`.

| Usuários distintos | ACKs válidos | Persistidas | Destinatários com broadcast | Reenvio idempotente | `lastMessageConsistent` | p95 do ACK |
|---:|---:|---:|---:|---|---|---:|
| 5 | 5/5 | 5/5 | 5/5 | true | true | 142,95 ms |
| 10 | 10/10 | 10/10 | 10/10 | true | true | 197,92 ms |
| 20 | 20/20 | 20/20 | 20/20 | true | true | 436,72 ms |

Repetição do cenário de **20 usuários cinco vezes**: todas as execuções foram concluídas com código de saída bem-sucedido, persistência correta, ACKs válidos, reenvio idempotente e `lastMessageConsistent = true`. Representam **100 mensagens adicionais e 100 ACKs válidos**.

A correção eliminou a falha nos cenários reproduzidos; não há prova de ausência de condições de corrida em todas as situações.

## 6. Histórico extenso: paginação por cursor

Em cada execução, foi criada uma conversa temporária contendo **550 mensagens**, divididas em **11 páginas de 50 mensagens**. A navegação integral não encontrou IDs duplicados ou ausentes. O benchmark mediu 100 consultas da primeira página e 100 consultas com `before`, em cada nível de concorrência.

| Página | Concorrência | Sucessos | Falhas | Req/s | p50 | p95 | p99 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Primeira página | 10 | 100 | 0 | 91,02 | 96,51 ms | 164,95 ms | 246,82 ms |
| Com cursor | 10 | 100 | 0 | 86,87 | 89,76 ms | 198,21 ms | 235,08 ms |
| Primeira página | 20 | 100 | 0 | 104,34 | 175,58 ms | 251,12 ms | 350,53 ms |
| Com cursor | 20 | 100 | 0 | 121,19 | 164,44 ms | 173,77 ms | 176,86 ms |

**400 consultas HTTP aprovadas**, com integridade da paginação verificada nas duas execuções. Ambas informaram remoção dos registros temporários.

## 7. Carga HTTP sustentada — dashboard

Consultas GET autenticadas ao dashboard durante aproximadamente 30 segundos, com 10 e 20 requisições simultâneas em andamento. Um JWT válido foi obtido antes das execuções.

| Concorrência | Duração | HTTP 200 | Falhas | Req/s | p50 | p95 | p99 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 30,06 s | 2.227 | 0 | 74,09 | 126,23 ms | 194,62 ms | 243,64 ms |
| 20 | 30,15 s | 2.317 | 0 | 76,86 | 253,24 ms | 318,30 ms | 409,59 ms |

**Total: 4.544 requisições HTTP 200, zero falhas.**

### Latência p95 por intervalo

| Intervalo | 10 concorrentes | 20 concorrentes |
|---|---:|---:|
| 0–5 s | 288,00 ms | 382,57 ms |
| 5–10 s | 156,60 ms | 386,30 ms |
| 10–15 s | 171,87 ms | 282,68 ms |
| 15–20 s | 149,32 ms | 289,59 ms |
| 20–25 s | 157,18 ms | 297,86 ms |
| 25–30 s | 138,48 ms | 281,19 ms |

Ao dobrar a concorrência de 10 para 20, o throughput cresceu aproximadamente **3,7%**, enquanto o p95 cresceu aproximadamente **63,5%**. Não foram observadas falhas nem tendência progressiva evidente de deterioração nos 30 segundos. O resultado sugere aumento de contenção de recursos, mas **não identifica o gargalo** e não representa a capacidade máxima de produção.

## 8. Regressão e integridade

A suíte `npm test` foi concluída sem falhas:

| Grupo de testes | Aprovados |
|---|---:|
| Integridade | 37 |
| Integração | 70 |
| Consultas de persistência | 5 |
| API HTTP | 181 |
| Socket.IO | 38 |
| **Total** | **331** |

O novo teste de concorrência está incluído nos 70 testes de integração. A verificação da massa de desenvolvimento confirmou os registros esperados nos dois bancos.

## 9. Limitações e riscos residuais

1. Ensaios em computador de desenvolvimento, sem especificação registrada de CPU, RAM, disco, sistema operacional completo, versão dos bancos, isolamento de carga ou métricas de utilização de recursos.
2. Duração limitada a 30 segundos por cenário sustentado; não substitui teste de longa duração (*soak test*).
3. Execuções HTTP concentradas em um JWT e no mesmo ambiente cliente/servidor; não caracterizam distribuição real de usuários.
4. Cenário de histórico extenso contém 550 mensagens e valida apenas duas páginas sob carga; não equivale a um banco de milhões de mensagens.
5. Ausência de SLO/SLAs previamente definidos: as latências são medições, não declarações de conformidade contratual.
6. Falha potencial de consistência se uma mensagem for persistida, mas a atualização dos metadados da conversa falhar: considerar reconciliação/reprocessamento e observabilidade em etapa posterior.
7. Repetições são limitadas; a correção deve permanecer coberta por testes automatizados e revisada antes do merge.

## 10. Como reproduzir

Partindo da pasta `backend` em ambiente local de desenvolvimento, com containers e API em execução e variáveis de ambiente configuradas:

```powershell
# Verificação de regressão
npm test

# Requisições HTTP (somente leitura)
$env:PERF_BASE_URL = "http://127.0.0.1:3000"
$env:PERF_PATH = "/api/v1/dashboard"
$env:PERF_REQUESTS = "500"
$env:PERF_CONCURRENCY = "20"
node .\scripts\performance\http-load.js

# Socket.IO: conexão e sincronização (somente leitura)
$env:PERF_CLIENTS = "20"
$env:PERF_CONVERSATION_ID = "<ID_MONGODB_DE_CONVERSA_COM_ACESSO>"
node .\scripts\performance\socket-load.js

# Socket.IO: criação e limpeza controlada de usuários/grupo/mensagens temporários
node .\scripts\performance\message-load.js

# Histórico: criação e limpeza controlada de conversa e 550 mensagens
$env:PERF_REQUESTS = "100"
$env:PERF_CONCURRENCY = "20"
node .\scripts\performance\history-load.js

# Carga sustentada HTTP (somente leitura)
$env:PERF_DURATION_SECONDS = "30"
node .\scripts\performance\http-sustained.js
```

**Observação:** os testes HTTP autenticados e o `socket-load.js` exigem `PERF_TOKEN` de um usuário DEV ativo. Não registrar nem publicar tokens. Não executar em produção nem em bancos compartilhados. O cenário de envio concorrente utiliza dados temporários e deve ser executado apenas após confirmar o ambiente de desenvolvimento.

## 11. Conclusão e pendências do ticket

A BE-17 produziu evidências de disponibilidade HTTP, sincronização Socket.IO, persistência concorrente, idempotência e integridade de paginação no ambiente testado. Também reproduziu e permitiu corrigir uma condição de corrida em `last_message_id`, agora coberta por regressão automatizada.

**Execução técnica dos cenários planejados: concluída.**  
**Encerramento do ticket: pendente da revisão do diff, checagem de sintaxe e formatação, commit, Pull Request, validação da CI e merge.**

Não utilizar esses resultados como garantia de desempenho em produção ou como SLA.

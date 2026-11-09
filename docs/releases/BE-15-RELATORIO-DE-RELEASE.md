# Corporate Chat — BE-15 | Relatório de consolidação da release do backend

**Product Backlog:** BE-15 — Consolidar release do Marco 2 e demonstração
**Escopo:** backend MVP acadêmico; não representa release da interface React
**Situação:** documentação da candidata a release; PR/CI/merge/tag sujeitos a confirmação

## 1. Objetivo
Consolidar as funcionalidades P0 do backend do Corporate Chat, seus testes, documentação, evidências, roteiro de demonstração e referência versionada para entrega do Marco 2.

## 2. Funcionalidades contempladas
- API Express v1 e rotas de saúde.
- Autenticação JWT, sessões PostgreSQL e logout com revogação.
- Autorização, administração de usuários e solicitação de cadastro.
- Dashboard e contatos.
- Conversas privadas, histórico paginado e gerenciamento de grupos.
- Mensagens, checkpoints de entrega/leitura e sincronização.
- Socket.IO com autenticação, reconexão e distribuição em tempo real.
- Segurança da API, validações, proteção de dados e limites.
- Persistência híbrida PostgreSQL 16 + MongoDB 8.
- Operação BE-18: deploy Docker local, graceful shutdown, backup e restauração isolada.

## 3. Evidências já observadas (08/11/2026)
| Validação | Resultado |
|---|---|
| `npm run env:sync` | Aprovado, sem migrations pendentes no banco de desenvolvimento |
| Integridade de persistência | 37/37 |
| Integração | 70/70 |
| Consultas | 5/5 |
| API HTTP | 184/184 |
| Realtime | 38/38 |
| **Total** | **334/334, 0 falhas** |
| BE-18 backup e recuperação | Restauração sintética isolada e cruzamento de UUID/ObjectId aprovados |

> Os números acima refletem a execução da BE-18. A validação da candidata a release BE-15, o smoke test, a CI e o merge devem ser registrados abaixo com o resultado real. Nunca preencher aprovação sem a execução correspondente.

## 4. Evidências da candidata BE-15 (preencher após executar)
| Item | Resultado / referência |
|---|---|
| Commit da branch BE-15 | PENDENTE |
| A branch contém o merge da BE-18 | PENDENTE |
| `git diff --check` | PENDENTE |
| `npm test` no commit BE-15 | PENDENTE |
| Smoke test `GET /api/v1/health` | PENDENTE |
| Demonstração dos fluxos da API | PENDENTE |
| PR BE-15 | PENDENTE |
| Check `Backend CI` do PR | PENDENTE |
| Merge na `main` | PENDENTE |
| Branch de marco (se utilizada) | PENDENTE |
| Tag e GitHub Release do backend | PENDENTE |

## 5. Referências de documentação
- `README.md` — visão geral e instruções de execução.
- `docs/api-docs/` — contratos REST e Socket.IO.
- `docs/operations/RUNBOOK-OPERACIONAL.md` — procedimentos e limites da BE-18 (confirmar caminho na main).
- `docs/releases/BE-15-ROTEIRO-DEMONSTRACAO.md` — apresentação do MVP backend.
- `docs/releases/BE-15-NOTAS-DA-VERSAO.md` — notas de entrega.

## 6. Limitações declaradas
- A release refere-se ao **backend**, não à interface React nem a uma implantação pública na internet.
- O deploy validado na BE-18 foi local, em Docker.
- O backup PostgreSQL/MongoDB é sequencial e não garante snapshot distribuído sob escrita concorrente.
- A restauração automatizada foi testada em projeto Docker isolado, com massa sintética.
- Não declarar HTTPS/TLS público, RPO/RTO, failover, backup agendado ou frontend funcional sem evidências específicas.

## 7. Critério de aceite BE-15
- [ ] Todas as entregas P0 necessárias integradas à `main`.
- [ ] Regressão completa aprovada no código candidato e CI do PR aprovada.
- [ ] Smoke test da API aprovado e documentado.
- [ ] Evidências, roteiro e documentação incluídos no repositório.
- [ ] PR da BE-15 revisado e integrado.
- [ ] Branch de marco e tag criadas a partir do commit integrado (quando aplicável).
- [ ] GitHub Release publicada para a tag escolhida.

**Conclusão:** preencher somente após confirmar o merge e o versionamento definitivo.

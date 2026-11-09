# Corporate Chat — Notas da versão | Backend MVP

**Versão proposta:** `corporate-chat-backend-v1.0.0` (confirmar antes de criar a tag)
**Tipo:** release acadêmica do backend / Marco 2
**Data da publicação:** PENDENTE
**Commit da `main`:** PENDENTE

## Resumo
Release de consolidação do backend do Corporate Chat. A aplicação oferece API HTTP e comunicação Socket.IO, com autenticação JWT, autorização de usuários, gerenciamento de cadastros, conversas, grupos, mensagens, histórico e checkpoints de entrega e leitura.

## Tecnologias
Node.js 24, Express, Socket.IO, PostgreSQL 16, Sequelize, MongoDB 8, Mongoose e Docker Compose.

## Qualidade e validação
- Ensaio de regressão anterior (BE-18): **334 testes aprovados, 0 falhas**.
- Validação da release no commit final: **PENDENTE**.
- CI `Backend CI` no PR BE-15: **PENDENTE**.
- Health check HTTP na versão candidata: **PENDENTE**.

## Operação
- Ambiente Docker local para o backend e os dois bancos.
- Inicialização de banco, aplicação e migrations documentada.
- Graceful shutdown implementado.
- Backup e restauração isolada testados em dados sintéticos.

## Limitações
Esta versão corresponde ao **backend**, não à aplicação React completa. O deploy testado não é uma implantação pública com TLS. O backup entre bancos não é transacional conjunto, e a recuperação foi validada em ambiente isolado.

## Documentação e evidências
- `README.md`
- `docs/api-docs/`
- `docs/operations/RUNBOOK-OPERACIONAL.md`
- `docs/releases/BE-15-RELATORIO-DE-RELEASE.md`
- `docs/releases/BE-15-ROTEIRO-DEMONSTRACAO.md`

## Publicação
Preencher URL do Pull Request, SHA final, tag, URL do GitHub Release e data somente depois que cada operação for concluída.

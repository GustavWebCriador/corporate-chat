# Corporate Chat — Dashboard

## 1. Visão geral

O dashboard é a área principal disponibilizada ao usuário após a autenticação.

A API fornece os dados necessários para que a interface apresente:

- contatos disponíveis;
- conversas privadas;
- grupos;
- identificação do tipo da conversa;
- última mensagem das conversas;
- informações necessárias para navegação inicial.

O endpoint é protegido por autenticação e está disponível somente para usuários autenticados e ativos.

---

## 2. Endpoint

### Consultar dashboard

```http
GET /api/v1/dashboard

# Corporate Chat — Segurança da API

## 1. Objetivo

A BE-12 tem como objetivo consolidar a segurança,
as validações e o tratamento de erros da API do
Corporate Chat.

A implementação contempla:

- Validação de entradas.
- Tratamento padronizado de erros HTTP.
- Proteção contra requisições excessivas.
- Headers HTTP de segurança.
- Controle de origens HTTP e Socket.IO.
- Validação das configurações do ambiente.
- Política de privacidade de cache.

Os contratos das funcionalidades existentes são
preservados.

## 2. Arquitetura de segurança

A proteção utiliza os seguintes componentes:

| Componente | Responsabilidade |
|---|---|
| `authenticate.js` | Autenticação JWT e autorização administrativa |
| `AppError.js` | Representação de erros operacionais |
| `errorHandler.js` | Normalização das respostas de erro |
| `rateLimiters.js` | Limitação de requisições |
| `securityHeaders.js` | Headers HTTP por meio do Helmet |
| `cacheControl.js` | Política `Cache-Control: no-store` |
| `cors.js` | Validação de origens permitidas |
| `runtime.js` | Validação das configurações do ambiente |

## 3. Tratamento padronizado de erros

As respostas de erro seguem o contrato:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Descrição do erro."
  }
}
```

O atributo `details` pode estar presente nos erros
operacionais que necessitam de informações adicionais.

Exceções inesperadas retornam:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Erro interno do servidor."
  }
}
```

Mensagens internas de exceções inesperadas não são
expostas ao cliente.

O middleware também trata:

- JSON malformado: `400 INVALID_JSON`.
- Corpo acima do limite: `413 PAYLOAD_TOO_LARGE`.
- Rotas inexistentes: `404 ROUTE_NOT_FOUND`.

O limite configurado para corpos JSON é de 100 KB.

## 4. Rate limiting

### Login

Endpoint:

`POST /api/v1/auth/login`

Política:

- Janela de 15 minutos.
- Limite de 10 tentativas com falha por IP.
- Requisições de login bem-sucedidas não permanecem
  contabilizadas no limite.

Ao exceder o limite:

`429 RATE_LIMITED`

### Solicitação pública de cadastro

Endpoint:

`POST /api/v1/registration-requests`

Política:

- Janela de 60 minutos.
- Limite de 5 requisições por IP.
- Requisições aceitas e rejeitadas são contabilizadas.

Ao exceder o limite:

`429 RATE_LIMITED`

A implementação atual utiliza armazenamento de memória
por processo. Ambientes distribuídos exigem avaliação
de um armazenamento compartilhado.

## 5. Headers HTTP

O middleware utiliza Helmet para configurar
headers de segurança.

A aplicação também desabilita `X-Powered-By`.

Entre os controles configurados estão:

- `X-Content-Type-Options`.
- `X-Frame-Options`.
- `Referrer-Policy`.
- `Content-Security-Policy`.

O HSTS permanece desabilitado em desenvolvimento
e teste, sendo utilizado em produção.

A publicação deve ocorrer sob HTTPS.

## 6. CORS

O backend mantém uma política de origens permitidas.

Em produção:

- `CORS_ORIGIN` deve estar configurada.
- Wildcards não são aceitos.
- Origens inválidas são rejeitadas.
- São permitidos somente protocolo, host e porta.

CORS não substitui autenticação ou autorização.

## 7. Segurança do Socket.IO

O Socket.IO utiliza validação de origem durante
o handshake.

O controle `allowRequest` permite rejeitar origens
não autorizadas antes da autenticação.

Após a validação da origem, continuam obrigatórias
as verificações de JWT e sessão.

Clientes fora do navegador podem omitir o header
Origin. Portanto, a segurança não depende apenas
da validação de origem.

A aplicação também preserva as verificações de
participação e autorização nas operações realtime.

## 8. Política de cache

O middleware `noStore` define:

```http
Cache-Control: no-store
```

Essa política é aplicada às respostas sensíveis
dos seguintes recursos:

- Autenticação.
- Administração de usuários.
- Solicitações de cadastro.
- Dashboard.
- Conversas privadas.
- Grupos.
- Mensagens, entrega e leitura.

O middleware deve executar antes da autenticação
e dos limitadores nas rotas correspondentes.

A política também deve estar presente em respostas
de erro produzidas após a execução do middleware.

A rota pública `GET /api/v1/health` não recebe essa
política privada específica.

Erros rejeitados globalmente antes do roteamento,
como JSON malformado, não necessariamente recebem
o header configurado nos routers.

A política `no-store` não substitui TLS, autenticação
ou autorização.

## 9. Configuração de produção

Antes da publicação, verificar:

- `NODE_ENV=production`.
- `JWT_SECRET` forte e configurado.
- `CORS_ORIGIN` explícita.
- Configuração correta dos bancos.
- HTTPS habilitado.
- Segredos fora do controle de versão.
- Configuração segura de proxy reverso.
- Limites de requisições adequados ao ambiente.

A configuração de IP do cliente deve considerar
proxies confiáveis. Não habilitar `trust proxy`
indiscriminadamente.

## 10. Testes automatizados

Arquivos relacionados:

- `tests/api/base-server.test.js`
- `tests/api/security-hardening.test.js`
- `tests/api/cors-hardening.test.js`
- `tests/api/runtime-config.test.js`
- `tests/api/cache-control.test.js`
- `tests/api/be12-hardening-final.test.js`
- `tests/realtime/socket-origin.test.js`

Executar em `backend/`:

```powershell
node --test .\tests\api\cache-control.test.js
node --test .\tests\api\be12-hardening-final.test.js

npm run test:api
npm run test:realtime
npm test
```

## 11. Critérios de conclusão

A BE-12 pode ser considerada concluída quando:

1. Os testes específicos estiverem aprovados.
2. A regressão completa não apresentar falhas.
3. Os contratos existentes forem preservados.
4. A documentação estiver atualizada.
5. Não houver exposição de segredos.
6. O Pull Request for revisado.
7. A pipeline de CI estiver aprovada.

A evidência deve apresentar os resultados reais
obtidos durante a execução.

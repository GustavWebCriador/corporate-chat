#!/usr/bin/env bash
# Corporate Chat — DEP-01.2 | Publica ou atualiza a aplicação no servidor AWS
#
# Uso (na raiz do repositório, no servidor):
#
#   bash deploy/scripts/publicar.sh
#
# Sequência: valida deploy/.env -> build -> bancos -> migrations e índices
# -> API -> proxy HTTPS -> teste de fumaça em https://CHAT_DOMAIN.
# Pode ser executado novamente a cada atualização (git pull + publicar.sh).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

ENV_FILE="deploy/.env"
PROJECT="corporate-chat-deploy"
COMPOSE=(docker compose -p "${PROJECT}" --env-file "${ENV_FILE}" -f docker-compose.deploy.yml -f docker-compose.aws.yml)

log() { printf '[DEP-01.2] %s\n' "$*"; }
fail() { printf '[DEP-01.2] ERRO: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------
# 1. Configuração
# ---------------------------------------------------------------
[[ -f "${ENV_FILE}" ]] || fail "${ENV_FILE} não existe. Copie deploy/.env.example e preencha (DEP-01.2, seção 3)."

if [[ "$(stat -c '%a' "${ENV_FILE}")" != "600" ]]; then
    chmod 600 "${ENV_FILE}"
    log "Permissão de ${ENV_FILE} ajustada para 600."
fi

if grep -q 'SUBSTITUIR' "${ENV_FILE}"; then
    fail "${ENV_FILE} ainda contém valores SUBSTITUIR_*. Gere segredos novos (DEP-01.2, seção 3)."
fi

env_value() { grep -E "^$1=" "${ENV_FILE}" | tail -n 1 | cut -d= -f2- | tr -d '"'"'"; }

CHAT_DOMAIN="$(env_value CHAT_DOMAIN)"
[[ -n "${CHAT_DOMAIN}" ]] || fail "CHAT_DOMAIN não definido em ${ENV_FILE}."
[[ "${CHAT_DOMAIN}" != *"/"* && "${CHAT_DOMAIN}" != *":"* ]] || fail "CHAT_DOMAIN deve ser só o nome (sem https:// nem porta)."
[[ -n "$(env_value ACME_EMAIL)" ]] || fail "ACME_EMAIL não definido em ${ENV_FILE}."

for name in POSTGRES_PASSWORD MONGO_PASSWORD JWT_SECRET; do
    value="$(env_value "${name}")"
    (( ${#value} >= 24 )) || fail "${name} deve ter pelo menos 24 caracteres."
done

grep -qE '^DEV_SEED_PASSWORD=.+' "${ENV_FILE}" && fail "Remova DEV_SEED_PASSWORD: o seed de desenvolvimento não é usado em produção."

"${COMPOSE[@]}" config --quiet
log "Configuração válida para https://${CHAT_DOMAIN}"

# ---------------------------------------------------------------
# 2. Build das imagens (API, migrations e proxy com o frontend)
# ---------------------------------------------------------------
log "Gerando imagens (a primeira vez leva alguns minutos)..."
"${COMPOSE[@]}" --profile maintenance build --pull

# ---------------------------------------------------------------
# 3. Bancos, migrations e índices
# ---------------------------------------------------------------
log "Subindo bancos..."
"${COMPOSE[@]}" up -d --wait postgres mongodb

log "Aplicando migrations do PostgreSQL..."
"${COMPOSE[@]}" --profile maintenance run --rm migrate

log "Sincronizando índices do MongoDB..."
"${COMPOSE[@]}" --profile maintenance run --rm mongo-indexes

# ---------------------------------------------------------------
# 4. API e proxy HTTPS
# ---------------------------------------------------------------
log "Subindo API e proxy..."
"${COMPOSE[@]}" up -d --wait api
"${COMPOSE[@]}" up -d proxy

# ---------------------------------------------------------------
# 5. Teste de fumaça (o primeiro certificado pode levar até 2 minutos)
# ---------------------------------------------------------------
log "Aguardando https://${CHAT_DOMAIN}/api/v1/health ..."
for attempt in $(seq 1 24); do
    if curl -fsS --max-time 5 "https://${CHAT_DOMAIN}/api/v1/health" >/dev/null 2>&1; then
        log "API respondendo via HTTPS (tentativa ${attempt})."
        curl -fsS --max-time 5 -o /dev/null "https://${CHAT_DOMAIN}/" || fail "Frontend não respondeu em https://${CHAT_DOMAIN}/"
        log "Frontend respondendo."
        "${COMPOSE[@]}" ps
        docker image prune -f >/dev/null
        log "Publicado: https://${CHAT_DOMAIN}"
        exit 0
    fi
    sleep 5
done

"${COMPOSE[@]}" logs --tail 40 proxy >&2
fail "HTTPS não respondeu em 2 minutos. Confira o DNS/IP, as portas 80/443 no Security Group e os logs acima."

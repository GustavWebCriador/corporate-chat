#!/usr/bin/env bash
# Corporate Chat — DEP-01.3 | Restauração de backup
#
# Modos:
#
#   bash deploy/scripts/restaurar.sh <arquivo.manifest.json>
#       ENSAIO ISOLADO (padrão). Sobe bancos temporários em um projeto
#       Docker separado, restaura, confere contagens e integridade entre
#       PostgreSQL e MongoDB e apaga tudo ao final. Não toca na produção.
#       Use --manter para inspecionar os bancos restaurados antes de apagar.
#
#   bash deploy/scripts/restaurar.sh --servidor-novo <arquivo.manifest.json>
#       RECUPERAÇÃO em um servidor novo (perda da instância). Restaura nos
#       bancos de produção SOMENTE se eles estiverem vazios. Pede confirmação.
#       Depois, execute deploy/scripts/publicar.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

PROD_PROJECT="${CORPORATE_CHAT_PROJECT:-corporate-chat-deploy}"
ENV_FILE="deploy/.env"

log() { printf '[DEP-01.3] %s\n' "$*"; }
fail() { printf '[DEP-01.3] ERRO: %s\n' "$*" >&2; exit 1; }

mode="ensaio"
keep=0
manifest=""
for arg in "$@"; do
    case "${arg}" in
        --servidor-novo) mode="servidor-novo" ;;
        --manter) keep=1 ;;
        -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
        -*) fail "Opção desconhecida: ${arg}" ;;
        *) [[ -z "${manifest}" ]] || fail "Informe um único manifesto."; manifest="${arg}" ;;
    esac
done

[[ -n "${manifest}" ]] || fail "Informe o arquivo .manifest.json do backup."
[[ -f "${manifest}" ]] || fail "Manifesto não encontrado: ${manifest}"
[[ -f "${ENV_FILE}" ]] || fail "${ENV_FILE} não encontrado."

# ---------------------------------------------------------------
# 1. Conferência do manifesto (tamanho e SHA-256)
# ---------------------------------------------------------------
dir="$(cd "$(dirname "${manifest}")" && pwd)"
json_field() { grep -A4 "\"$1\"" "${manifest}" | grep "\"$2\"" | head -n1 | sed -E 's/.*: *"?([^",]*)"?,?/\1/'; }

pg_file="${dir}/$(json_field postgres file)"
mongo_file="${dir}/$(json_field mongodb file)"

for entry in postgres:"${pg_file}" mongodb:"${mongo_file}"; do
    label="${entry%%:*}"; file="${entry#*:}"
    [[ "$(basename "${file}")" =~ ^[A-Za-z0-9._-]+$ ]] || fail "${label}: nome de arquivo inválido no manifesto."
    [[ -f "${file}" ]] || fail "${label}: arquivo não encontrado (${file})."
    [[ "$(wc -c < "${file}" | tr -d ' ')" == "$(json_field "${label}" bytes)" ]] || fail "${label}: tamanho diferente do manifesto."
    sha="$(sha256sum "${file}" | cut -d' ' -f1 | tr '[:lower:]' '[:upper:]')"
    [[ "${sha}" == "$(json_field "${label}" sha256 | tr '[:lower:]' '[:upper:]')" ]] || fail "${label}: SHA-256 diferente do manifesto."
done
log "Manifesto conferido: $(json_field postgres file | sed 's/-postgres.dump//')"

# ---------------------------------------------------------------
# 2. Destino
# ---------------------------------------------------------------
if [[ "${mode}" == "ensaio" ]]; then
    project="corporate-chat-restore-$(date -u +%Y%m%d%H%M%S)"
    [[ "${project}" != "${PROD_PROJECT}" ]] || fail "Projeto de ensaio não pode ser o de produção."
    COMPOSE=(docker compose -p "${project}" --env-file "${ENV_FILE}" -f docker-compose.deploy.yml)

    if [[ -n "$(docker ps -aq --filter "label=com.docker.compose.project=${project}")" ]]; then
        fail "O projeto ${project} já possui contêineres. Nada foi alterado."
    fi

    teardown() {
        if (( keep == 1 )); then
            log "Bancos mantidos para inspeção. Para apagar: docker compose -p ${project} --env-file ${ENV_FILE} -f docker-compose.deploy.yml down -v"
        else
            "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
            log "Bancos do ensaio removidos."
        fi
    }
    trap teardown EXIT

    log "Ensaio isolado no projeto ${project} (produção não é alterada)."
    "${COMPOSE[@]}" up -d --wait postgres mongodb
else
    project="${PROD_PROJECT}"
    COMPOSE=(docker compose -p "${project}" --env-file "${ENV_FILE}" -f docker-compose.deploy.yml -f docker-compose.aws.yml)

    log "RECUPERAÇÃO no projeto de produção ${project}."
    "${COMPOSE[@]}" stop api proxy >/dev/null 2>&1 || true
    "${COMPOSE[@]}" up -d --wait postgres mongodb

    pg_tables="$("${COMPOSE[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -A -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = '"'"'public'"'"'"' | tr -d '[:space:]')"
    mongo_cols="$("${COMPOSE[@]}" exec -T mongodb sh -c 'mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_INITDB_DATABASE" --eval "db.getCollectionNames().length"' | tr -d '[:space:]')"

    if [[ "${pg_tables}" != "0" || "${mongo_cols}" != "0" ]]; then
        fail "Os bancos de produção não estão vazios (PostgreSQL: ${pg_tables} tabelas; MongoDB: ${mongo_cols} coleções). Nada foi restaurado. Para conferir um backup use o modo ensaio."
    fi

    if [[ -t 0 ]]; then
        read -r -p "Digite RESTAURAR para gravar o backup na produção: " answer
    else
        read -r answer || true
    fi
    [[ "${answer:-}" == "RESTAURAR" ]] || fail "Confirmação não recebida. Nada foi restaurado."
fi

# ---------------------------------------------------------------
# 3. Restauração
# ---------------------------------------------------------------
log "PostgreSQL: pg_restore..."
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "${pg_file}"

log "MongoDB: mongorestore..."
"${COMPOSE[@]}" exec -T mongodb sh -c 'mongorestore --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --gzip --archive --nsInclude="$MONGO_INITDB_DATABASE.*" --stopOnError' < "${mongo_file}"

# ---------------------------------------------------------------
# 4. Conferência
# ---------------------------------------------------------------
pg_counts="$("${COMPOSE[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -A -t -F " " -c "SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM registration_requests), (SELECT count(*) FROM auth_sessions)"')"
user_ids="$("${COMPOSE[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -A -t -c "SELECT coalesce(json_agg(user_id::text), '"'"'[]'"'"') FROM users"')"

mongo_report="$(printf 'const ids = new Set(%s);\nconst orphanSenders = db.messages.distinct("sender_id").filter((id) => !ids.has(String(id))).length;\nconst orphanMembers = db.conversation_members.distinct("user_id").filter((id) => !ids.has(String(id))).length;\nprint([db.conversations.countDocuments({}), db.conversation_members.countDocuments({}), db.messages.countDocuments({}), orphanSenders, orphanMembers].join(" "));\n' "${user_ids}" \
    | "${COMPOSE[@]}" exec -T mongodb sh -c 'mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_INITDB_DATABASE" --file /dev/stdin')"

read -r users requests sessions <<< "${pg_counts}"
read -r conversations members messages orphan_senders orphan_members <<< "${mongo_report}"

log "Restaurado — PostgreSQL: ${users} usuários, ${requests} solicitações, ${sessions} sessões"
log "Restaurado — MongoDB: ${conversations} conversas, ${members} participações, ${messages} mensagens"

[[ "${users}" =~ ^[0-9]+$ && "${messages}" =~ ^[0-9]+$ ]] || fail "Conferência não retornou números válidos."
(( users > 0 )) || fail "Nenhum usuário restaurado."
(( orphan_senders == 0 && orphan_members == 0 )) \
    || fail "Integridade: ${orphan_senders} remetente(s) e ${orphan_members} participante(s) sem usuário correspondente."
log "Integridade entre bancos: OK (todo remetente e participante existe no PostgreSQL)."

if [[ "${mode}" == "servidor-novo" ]]; then
    log "Recuperação concluída. Agora execute: bash deploy/scripts/publicar.sh"
else
    log "Ensaio de restauração concluído com sucesso."
fi

#!/usr/bin/env bash
# Corporate Chat — DEP-01.3 | Backup do PostgreSQL e do MongoDB no servidor
#
# Uso (na raiz do repositório, no servidor):
#
#   bash deploy/scripts/backup.sh
#
# Gera em BACKUP_DIR (padrão /var/backups/corporate-chat):
#   <nome>-postgres.dump          pg_dump formato custom
#   <nome>-mongodb.archive.gz     mongodump --archive --gzip
#   <nome>.manifest.json          tamanhos e SHA-256 (mesmo formato do BE-18)
#
# Mantém os últimos BACKUP_RETENTION_DAYS dias (padrão 7).
# Executado diariamente pelo timer corporate-chat-backup (DEP-01.3, seção 3).
#
# O backup é sequencial (PostgreSQL, depois MongoDB). Para um ponto de
# restauração rigorosamente consistente, execute fora do horário de uso.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

PROJECT="${CORPORATE_CHAT_PROJECT:-corporate-chat-deploy}"
ENV_FILE="deploy/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/corporate-chat}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
COMPOSE=(docker compose -p "${PROJECT}" --env-file "${ENV_FILE}" -f docker-compose.deploy.yml -f docker-compose.aws.yml)

log() { printf '[DEP-01.3] %s\n' "$*"; }
fail() { printf '[DEP-01.3] ERRO: %s\n' "$*" >&2; exit 1; }

[[ -f "${ENV_FILE}" ]] || fail "${ENV_FILE} não encontrado."
[[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]] && (( RETENTION_DAYS >= 1 )) || fail "BACKUP_RETENTION_DAYS deve ser um número inteiro >= 1."

mkdir -p "${BACKUP_DIR}"
chmod 750 "${BACKUP_DIR}"

# Impede duas execuções simultâneas.
exec 9>"${BACKUP_DIR}/.backup.lock"
if command -v flock >/dev/null 2>&1; then
    flock -n 9 || fail "Outro backup está em execução."
fi

for service in postgres mongodb; do
    [[ -n "$("${COMPOSE[@]}" ps --status running -q "${service}")" ]] || fail "Serviço ${service} não está em execução."
done

stamp="$(date -u +%Y%m%d-%H%M%S)"
name="${PROJECT}-${stamp}"
pg_file="${BACKUP_DIR}/${name}-postgres.dump"
mongo_file="${BACKUP_DIR}/${name}-mongodb.archive.gz"
manifest="${BACKUP_DIR}/${name}.manifest.json"

umask 077
cleanup_partial() {
    if [[ "${done_ok:-0}" != "1" ]]; then
        rm -f "${pg_file}" "${mongo_file}" "${manifest}"
        log "Backup incompleto removido."
    fi
}
trap cleanup_partial EXIT

# As variáveis entre aspas simples são expandidas DENTRO do contêiner.
log "PostgreSQL: pg_dump..."
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${pg_file}"
"${COMPOSE[@]}" exec -T postgres pg_restore --list < "${pg_file}" > /dev/null \
    || fail "Dump do PostgreSQL ilegível."

log "MongoDB: mongodump..."
"${COMPOSE[@]}" exec -T mongodb sh -c 'mongodump --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db "$MONGO_INITDB_DATABASE" --gzip --archive' > "${mongo_file}"
gzip -t "${mongo_file}" || fail "Arquivo do MongoDB corrompido."

[[ -s "${pg_file}" && -s "${mongo_file}" ]] || fail "Arquivo de backup vazio."

file_bytes() { wc -c < "$1" | tr -d ' '; }
file_sha() { sha256sum "$1" | cut -d' ' -f1 | tr '[:lower:]' '[:upper:]'; }

cat > "${manifest}" <<EOF
{
  "version": 1,
  "project": "${PROJECT}",
  "createdAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "consistency": "sequencial; realizar sem escritas concorrentes",
  "postgres": {
    "file": "$(basename "${pg_file}")",
    "bytes": $(file_bytes "${pg_file}"),
    "sha256": "$(file_sha "${pg_file}")"
  },
  "mongodb": {
    "file": "$(basename "${mongo_file}")",
    "bytes": $(file_bytes "${mongo_file}"),
    "sha256": "$(file_sha "${mongo_file}")"
  }
}
EOF

done_ok=1
log "Backup concluído: ${manifest}"
log "  PostgreSQL $(file_bytes "${pg_file}") bytes | MongoDB $(file_bytes "${mongo_file}") bytes"

# Retenção: remove conjuntos completos mais antigos que RETENTION_DAYS.
removed=0
while IFS= read -r old; do
    base="${old%.manifest.json}"
    rm -f "${old}" "${base}-postgres.dump" "${base}-mongodb.archive.gz"
    removed=$((removed + 1))
done < <(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "${PROJECT}-*.manifest.json" -mtime "+$((RETENTION_DAYS - 1))" ! -name "$(basename "${manifest}")")
(( removed == 0 )) || log "Retenção: ${removed} backup(s) antigo(s) removido(s)."

log "Copie periodicamente para fora do servidor (DEP-01.3, seção 4)."

#!/usr/bin/env bash
# Corporate Chat — DEP-01.2 | Cria o primeiro administrador do ambiente publicado
#
# Uso (na raiz do repositório, no servidor, depois do publicar.sh):
#
#   bash deploy/scripts/criar-admin.sh "Nome do Administrador" admin@empresa.com
#
# A senha é pedida duas vezes e não aparece na tela.
# Só funciona enquanto não houver administrador ativo.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

if [[ $# -ne 2 ]]; then
    echo "Uso: bash deploy/scripts/criar-admin.sh \"Nome\" email@empresa.com" >&2
    exit 1
fi

docker compose -p corporate-chat-deploy --env-file deploy/.env \
    -f docker-compose.deploy.yml -f docker-compose.aws.yml \
    run --rm --no-deps api node src/operations/createAdmin.js --name "$1" --email "$2"

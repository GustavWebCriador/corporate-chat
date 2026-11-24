#!/usr/bin/env bash
set -euo pipefail

host="${1:-18-191-222-106.sslip.io}"

if [[ ! "$host" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
    echo "ERRO: hostname invalido" >&2
    exit 1
fi

if [[ -e deploy/.env ]]; then
    echo "ERRO: deploy/.env ja existe. Nao sera sobrescrito." >&2
    exit 1
fi

command -v openssl >/dev/null || {
    echo "Instale openssl" >&2
    exit 1
}

mkdir -p deploy

umask 077

{
    echo 'POSTGRES_USER=corporate_chat_deploy'
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 32)"
    echo 'POSTGRES_DB=corporate_chat_deploy_postgres'

    echo 'MONGO_USER=corporate_chat_deploy'
    echo "MONGO_PASSWORD=$(openssl rand -hex 32)"
    echo 'MONGO_DB=corporate_chat_deploy_mongodb'

    echo "JWT_SECRET=$(openssl rand -hex 48)"
    echo 'JWT_EXPIRES_IN=1h'

    echo "APP_DOMAIN=$host"
    echo "PUBLIC_APP_URL=https://$host"
    echo "CORS_ORIGIN=https://$host"
} > deploy/.env

chmod 600 deploy/.env

echo "deploy/.env criado com permissao 600."
echo "Dominio: $host"
echo "Nao publique este arquivo no GitHub."

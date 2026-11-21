# Corporate Chat — DEP-01.2 | Imagem do proxy HTTPS com o frontend
#
# Contexto de build: raiz do repositório (ver docker-compose.aws.yml).
# O endereço público é gravado no frontend durante o build, pois o
# Vite substitui VITE_BACKEND_URL no código gerado.

FROM node:24-bookworm-slim AS frontend-build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./

ARG CHAT_DOMAIN
RUN test -n "$CHAT_DOMAIN" || { echo "CHAT_DOMAIN obrigatorio" >&2; exit 1; }

# Frontend, API e Socket.IO no mesmo endereço HTTPS.
RUN VITE_BACKEND_URL="https://${CHAT_DOMAIN}" npm run build


FROM caddy:2.10-alpine

COPY deploy/aws/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend-build /app/dist /srv

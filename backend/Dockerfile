
# Imagem base: mesma versão principal do Node.js utilizada na CI.
FROM node:24-bookworm-slim AS base

WORKDIR /app

COPY package.json package-lock.json ./


# ========================================
# API - Runtime
# ========================================
FROM base AS runtime

ENV NODE_ENV=production

RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

COPY --chown=node:node src/ ./src/

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]



# ========================================
# Migrations e manutenção de índices
# ========================================
FROM base AS migrate

RUN npm ci --no-audit --no-fund \
    && npm cache clean --force

COPY --chown=node:node .sequelizerc ./

COPY --chown=node:node src/ ./src/

COPY --chown=node:node \
    database/postgres/migrations/ \
    ./database/postgres/migrations/

COPY --chown=node:node \
    database/mongodb/sync-indexes.js \
    ./database/mongodb/sync-indexes.js

USER node

CMD ["npm", "run", "db:migrate"]

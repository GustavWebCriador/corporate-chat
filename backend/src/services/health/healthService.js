const DEFAULT_TIMEOUT_MS = 2000;

function withTimeout(promise, ms) {
    let timer;

    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Os requires são feitos sob demanda para que importar este módulo (por
// exemplo nos testes da API) não instancie conexões nem exija variáveis do .env.
async function checkPostgres() {
    const { sequelize } = require("../../config/db/postgres");

    await sequelize.authenticate();
}

async function checkMongo() {
    const mongoose = require("mongoose");

    if (mongoose.connection.readyState !== 1) {
        throw new Error("MongoDB não conectado");
    }

    await mongoose.connection.db.admin().ping();
}

/**
 * Cria o serviço de health.
 *
 * `checks` permite injetar verificações alternativas (usado nos testes):
 *   { postgres: async () => {}, mongodb: async () => {} }
 * Uma verificação que lança erro ou excede o timeout marca o serviço como "down".
 */
function createHealthService({
    checks = { postgres: checkPostgres, mongodb: checkMongo },
    timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
    async function runCheck(check) {
        try {
            await withTimeout(Promise.resolve().then(check), timeoutMs);

            return { status: "up" };
        } catch (error) {
            return { status: "down" };
        }
    }

    async function getStatus() {
        const names = Object.keys(checks);
        const results = await Promise.all(names.map((name) => runCheck(checks[name])));

        const services = {};

        names.forEach((name, index) => {
            services[name] = results[index];
        });

        const allUp = results.every((result) => result.status === "up");

        return {
            status: allUp ? "ok" : "degraded",
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.round(process.uptime()),
            services,
        };
    }

    return { getStatus };
}

module.exports = {
    createHealthService,
    healthService: createHealthService(),
};
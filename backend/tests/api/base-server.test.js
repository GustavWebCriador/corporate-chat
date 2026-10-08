process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const { createApp } = require("../../src/app");
const { createHealthService } = require("../../src/services/health/healthService");
const AppError = require("../../src/errors/AppError");
const errorHandler = require("../../src/middlewares/errorHandler");
const notFound = require("../../src/middlewares/notFound");

const up = async () => {};
const down = async () => {
    throw new Error("indisponível");
};

function listen(app) {
    return new Promise((resolve) => {
        const server = app.listen(0, "127.0.0.1", () => {
            resolve({
                server,
                baseUrl: `http://127.0.0.1:${server.address().port}`,
            });
        });
    });
}

function close(server) {
    return new Promise((resolve) => server.close(resolve));
}

async function withApp(checks, run) {
    const healthService = createHealthService({ checks, timeoutMs: 200 });
    const { server, baseUrl } = await listen(createApp({ healthService }));

    try {
        await run(baseUrl);
    } finally {
        await close(server);
    }
}

test("GET /api/v1/health retorna 200 quando PostgreSQL e MongoDB estão ativos", async () => {
    await withApp({ postgres: up, mongodb: up }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/health`);
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.status, "ok");
        assert.deepEqual(body.data.services, {
            postgres: { status: "up" },
            mongodb: { status: "up" },
        });
        assert.ok(!Number.isNaN(Date.parse(body.data.timestamp)));
    });
});

test("GET /api/v1/health retorna 503 quando o PostgreSQL está fora", async () => {
    await withApp({ postgres: down, mongodb: up }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/health`);
        const body = await response.json();

        assert.equal(response.status, 503);
        assert.equal(body.data.status, "degraded");
        assert.equal(body.data.services.postgres.status, "down");
        assert.equal(body.data.services.mongodb.status, "up");
    });
});

test("GET /api/v1/health retorna 503 quando o MongoDB está fora", async () => {
    await withApp({ postgres: up, mongodb: down }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/health`);
        const body = await response.json();

        assert.equal(response.status, 503);
        assert.equal(body.data.services.postgres.status, "up");
        assert.equal(body.data.services.mongodb.status, "down");
    });
});

test("health marca como down um serviço que excede o timeout", async () => {
    const slow = () => new Promise((resolve) => setTimeout(resolve, 1000));

    await withApp({ postgres: slow, mongodb: up }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/health`);
        const body = await response.json();

        assert.equal(response.status, 503);
        assert.equal(body.data.services.postgres.status, "down");
    });
});

test("health não expõe mensagens de erro internas", async () => {
    const leaky = async () => {
        throw new Error("senha=segredo host=10.0.0.5");
    };

    await withApp({ postgres: leaky, mongodb: up }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/health`);
        const text = await response.text();

        assert.ok(!text.includes("segredo"));
        assert.ok(!text.includes("10.0.0.5"));
    });
});

test("rota inexistente retorna 404 ROUTE_NOT_FOUND no formato padrão", async () => {
    await withApp({ postgres: up, mongodb: up }, async (baseUrl) => {
        for (const path of ["/nao-existe", "/api/v1/nao-existe"]) {
            const response = await fetch(`${baseUrl}${path}`);
            const body = await response.json();

            assert.equal(response.status, 404);
            assert.equal(body.error.code, "ROUTE_NOT_FOUND");
            assert.equal(typeof body.error.message, "string");
        }
    });
});

test("JSON malformado retorna 400 INVALID_JSON", async () => {
    await withApp({ postgres: up, mongodb: up }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/health`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{ isso nao e json",
        });
        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(body.error.code, "INVALID_JSON");
    });
});

test("corpo acima do limite retorna 413 PAYLOAD_TOO_LARGE", async () => {
    await withApp({ postgres: up, mongodb: up }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/health`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto: "a".repeat(200 * 1024) }),
        });
        const body = await response.json();

        assert.equal(response.status, 413);
        assert.equal(body.error.code, "PAYLOAD_TOO_LARGE");
    });
});

test("a resposta não revela o header X-Powered-By", async () => {
    await withApp({ postgres: up, mongodb: up }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/health`);

        assert.equal(response.headers.get("x-powered-by"), null);
    });
});

test("errorHandler converte AppError, incluindo details, e oculta erros inesperados", async () => {
    const app = express();

    app.get("/app-error", (req, res, next) => {
        next(AppError.badRequest("Dados inválidos.", "VALIDATION_ERROR", [{ field: "email" }]));
    });

    app.get("/forbidden", (req, res, next) => {
        next(AppError.forbidden());
    });

    // Express 5 captura rejeições de handlers assíncronos automaticamente.
    app.get("/boom", async () => {
        throw new Error("falha interna com dados sensíveis");
    });

    app.use(notFound);
    app.use(errorHandler);

    const { server, baseUrl } = await listen(app);

    try {
        const appError = await fetch(`${baseUrl}/app-error`);
        const appErrorBody = await appError.json();

        assert.equal(appError.status, 400);
        assert.deepEqual(appErrorBody, {
            error: {
                code: "VALIDATION_ERROR",
                message: "Dados inválidos.",
                details: [{ field: "email" }],
            },
        });

        const forbidden = await fetch(`${baseUrl}/forbidden`);
        const forbiddenBody = await forbidden.json();

        assert.equal(forbidden.status, 403);
        assert.equal(forbiddenBody.error.code, "FORBIDDEN");
        assert.ok(!("details" in forbiddenBody.error));

        const boom = await fetch(`${baseUrl}/boom`);
        const boomText = await boom.text();

        assert.equal(boom.status, 500);
        assert.equal(JSON.parse(boomText).error.code, "INTERNAL_ERROR");
        assert.ok(!boomText.includes("sensíveis"));
    } finally {
        await close(server);
    }
});

test("AppError expõe statusCode, code e isOperational", () => {
    const error = new AppError("x", { statusCode: 409, code: "CONFLICT" });

    assert.ok(error instanceof Error);
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, "CONFLICT");
    assert.equal(error.isOperational, true);
    assert.equal(AppError.unauthorized().statusCode, 401);
    assert.equal(AppError.notFound().statusCode, 404);
});

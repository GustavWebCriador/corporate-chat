process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const AppError = require("../../src/errors/AppError");
const { createApp } = require("../../src/app");
const { getTrustProxySetting } = require("../../src/config/proxy");

/*
 * DEP-01.2 — API atrás do proxy HTTPS.
 *
 * O limite de login é por IP. Atrás do proxy, todas as conexões chegam
 * do mesmo IP (o do proxy); o IP real vem em X-Forwarded-For.
 */

function listen(app) {
    return new Promise((resolve) => {
        const server = app.listen(0, "127.0.0.1", () => {
            resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
        });
    });
}

function close(server) {
    return new Promise((resolve) => server.close(resolve));
}

function rejectingAuthService() {
    return {
        async login() {
            throw AppError.unauthorized("E-mail ou senha inválidos.", "INVALID_CREDENTIALS");
        },
        async authenticateToken() {
            throw new Error("não esperado");
        },
        async logout() {
            throw new Error("não esperado");
        },
    };
}

function loginFrom(baseUrl, forwardedFor) {
    return fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": forwardedFor,
        },
        body: JSON.stringify({ email: "pessoa@empresa.com", password: "SenhaErrada123" }),
    });
}

async function exhaustLimit(baseUrl, forwardedFor) {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
        const response = await loginFrom(baseUrl, forwardedFor);
        assert.equal(response.status, 401);
    }
    const blocked = await loginFrom(baseUrl, forwardedFor);
    assert.equal(blocked.status, 429);
}

test("DEP-01.2: TRUST_PROXY ausente, vazio, false ou 0 desliga a confiança no proxy", () => {
    for (const value of [undefined, null, "", "  ", "false", "FALSE", "0"]) {
        assert.equal(getTrustProxySetting(value), false, `valor ${JSON.stringify(value)}`);
    }
});

test("DEP-01.2: TRUST_PROXY aceita a quantidade de proxies (1 a 10)", () => {
    assert.equal(getTrustProxySetting("1"), 1);
    assert.equal(getTrustProxySetting(" 2 "), 2);
    assert.equal(getTrustProxySetting("10"), 10);
});

test("DEP-01.2: TRUST_PROXY recusa valores permissivos ou inválidos", () => {
    for (const value of ["true", "11", "-1", "1.5", "loopback", "*", "abc"]) {
        assert.throws(() => getTrustProxySetting(value), /TRUST_PROXY/, `valor ${value}`);
    }
});

test("DEP-01.2: atrás do proxy, o bloqueio de login é por usuário (IP real) e não global", async () => {
    const app = createApp({ authService: rejectingAuthService(), trustProxy: 1 });
    const { server, baseUrl } = await listen(app);

    try {
        await exhaustLimit(baseUrl, "203.0.113.10");

        // Outra pessoa, atrás do mesmo proxy, continua podendo tentar.
        const otherUser = await loginFrom(baseUrl, "203.0.113.20");
        assert.equal(otherUser.status, 401);
    } finally {
        await close(server);
    }
});

test("DEP-01.2: sem TRUST_PROXY, X-Forwarded-For enviado pelo cliente não burla o limite", async () => {
    const app = createApp({ authService: rejectingAuthService(), trustProxy: false });
    const { server, baseUrl } = await listen(app);

    try {
        await exhaustLimit(baseUrl, "203.0.113.10");

        // Trocar o cabeçalho não gera um novo contador.
        const spoofed = await loginFrom(baseUrl, "198.51.100.99");
        assert.equal(spoofed.status, 429);
    } finally {
        await close(server);
    }
});

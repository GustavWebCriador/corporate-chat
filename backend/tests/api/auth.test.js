process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { createApp } = require("../../src/app");
const { createAuthService } = require("../../src/services/auth/authService");
const { createHealthService } = require("../../src/services/health/healthService");
const { createAuthenticate, requireAdmin } = require("../../src/middlewares/authenticate");
const { getJwtConfig } = require("../../src/config/jwt");
const notFound = require("../../src/middlewares/notFound");
const errorHandler = require("../../src/middlewares/errorHandler");

const SECRET = process.env.JWT_SECRET;
const PASSWORD = "Senha@123";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const INACTIVE_ID = "33333333-3333-4333-8333-333333333333";

// ---------- apoio ----------

function makeRepository() {
    const passwordHash = bcrypt.hashSync(PASSWORD, 4);

    const rows = [
        {
            user_id: ADMIN_ID,
            name: "Admin Teste",
            email: "admin@corp.local",
            password_hash: passwordHash,
            status: "ACTIVE",
            is_admin: true,
            last_login_at: null,
        },
        {
            user_id: USER_ID,
            name: "Usuario Teste",
            email: "user@corp.local",
            password_hash: passwordHash,
            status: "ACTIVE",
            is_admin: false,
            last_login_at: null,
        },
        {
            user_id: INACTIVE_ID,
            name: "Usuario Inativo",
            email: "inativo@corp.local",
            password_hash: passwordHash,
            status: "INACTIVE",
            is_admin: false,
            last_login_at: null,
        },
    ];

    const byId = new Map(rows.map((row) => [row.user_id, row]));

    return {
        byId,

        async findByEmail(email) {
            for (const row of byId.values()) {
                if (row.email.toLowerCase() === email) {
                    return { ...row };
                }
            }

            return null;
        },

        async findById(userId) {
            const row = byId.get(userId);

            return row ? { ...row } : null;
        },

        async touchLastLogin(userId, date) {
            byId.get(userId).last_login_at = date;
        },
    };
}

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

async function withApi(run) {
    const repository = makeRepository();
    const authService = createAuthService({ userRepository: repository });
    const healthService = createHealthService({
        checks: { postgres: async () => {}, mongodb: async () => {} },
    });

    const { server, baseUrl } = await listen(createApp({ healthService, authService }));

    try {
        await run({ baseUrl, repository, authService });
    } finally {
        await close(server);
    }
}

function post(baseUrl, path, body) {
    return fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function get(baseUrl, path, authorization) {
    return fetch(`${baseUrl}${path}`, {
        headers: authorization ? { Authorization: authorization } : {},
    });
}

function signToken(claims = {}, options = {}) {
    return jwt.sign(claims, SECRET, {
        algorithm: "HS256",
        issuer: "corporate-chat",
        subject: USER_ID,
        expiresIn: "5m",
        ...options,
    });
}

async function loginAs(baseUrl, email) {
    const response = await post(baseUrl, "/api/v1/auth/login", {
        email,
        password: PASSWORD,
    });

    return (await response.json()).data.token;
}

// ---------- BE-02: login ----------

test("LOGIN: credenciais válidas retornam 200 com token JWT e dados do usuário", async () => {
    await withApi(async ({ baseUrl }) => {
        const response = await post(baseUrl, "/api/v1/auth/login", {
            email: "admin@corp.local",
            password: PASSWORD,
        });
        const text = await response.text();
        const body = JSON.parse(text);

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(body.data.tokenType, "Bearer");
        assert.equal(typeof body.data.expiresIn, "number");
        assert.deepEqual(body.data.user, {
            user_id: ADMIN_ID,
            name: "Admin Teste",
            email: "admin@corp.local",
            is_admin: true,
            status: "ACTIVE",
        });

        const claims = jwt.verify(body.data.token, SECRET, { algorithms: ["HS256"] });

        assert.equal(claims.sub, ADMIN_ID);
        assert.equal(claims.is_admin, true);
        assert.equal(claims.iss, "corporate-chat");
        assert.ok(claims.exp > claims.iat);

        assert.ok(!text.includes("password_hash"));
        assert.ok(!text.includes("$2"));
    });
});

test("LOGIN: e-mail com maiúsculas e espaços é normalizado", async () => {
    await withApi(async ({ baseUrl }) => {
        const response = await post(baseUrl, "/api/v1/auth/login", {
            email: "  ADMIN@Corp.Local  ",
            password: PASSWORD,
        });

        assert.equal(response.status, 200);
    });
});

test("LOGIN: login bem-sucedido atualiza last_login_at", async () => {
    await withApi(async ({ baseUrl, repository }) => {
        assert.equal(repository.byId.get(USER_ID).last_login_at, null);

        await post(baseUrl, "/api/v1/auth/login", {
            email: "user@corp.local",
            password: PASSWORD,
        });

        assert.ok(repository.byId.get(USER_ID).last_login_at instanceof Date);
    });
});

test("LOGIN: senha errada retorna 401 INVALID_CREDENTIALS e não atualiza last_login_at", async () => {
    await withApi(async ({ baseUrl, repository }) => {
        const response = await post(baseUrl, "/api/v1/auth/login", {
            email: "user@corp.local",
            password: "senha-errada",
        });
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "INVALID_CREDENTIALS");
        assert.equal(repository.byId.get(USER_ID).last_login_at, null);
    });
});

test("LOGIN: e-mail inexistente responde igual a senha errada (sem revelar cadastro)", async () => {
    await withApi(async ({ baseUrl }) => {
        const wrongPassword = await post(baseUrl, "/api/v1/auth/login", {
            email: "user@corp.local",
            password: "senha-errada",
        });
        const unknownEmail = await post(baseUrl, "/api/v1/auth/login", {
            email: "ninguem@corp.local",
            password: "senha-errada",
        });

        assert.equal(unknownEmail.status, wrongPassword.status);
        assert.deepEqual(await unknownEmail.json(), await wrongPassword.json());
    });
});

test("LOGIN: usuário INACTIVE com senha correta retorna 403 USER_INACTIVE", async () => {
    await withApi(async ({ baseUrl, repository }) => {
        const response = await post(baseUrl, "/api/v1/auth/login", {
            email: "inativo@corp.local",
            password: PASSWORD,
        });
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.equal(body.error.code, "USER_INACTIVE");
        assert.equal(repository.byId.get(INACTIVE_ID).last_login_at, null);
    });
});

test("LOGIN: usuário INACTIVE com senha errada continua 401 (não confirma o status)", async () => {
    await withApi(async ({ baseUrl }) => {
        const response = await post(baseUrl, "/api/v1/auth/login", {
            email: "inativo@corp.local",
            password: "senha-errada",
        });

        assert.equal(response.status, 401);
    });
});

test("LOGIN: campos ausentes retornam 400 VALIDATION_ERROR com details", async () => {
    await withApi(async ({ baseUrl }) => {
        const response = await post(baseUrl, "/api/v1/auth/login", {});
        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(body.error.code, "VALIDATION_ERROR");
        assert.deepEqual(
            body.error.details.map((detail) => detail.field).sort(),
            ["email", "password"]
        );
    });
});

test("LOGIN: requisição sem corpo retorna 400 VALIDATION_ERROR", async () => {
    await withApi(async ({ baseUrl }) => {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, { method: "POST" });
        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(body.error.code, "VALIDATION_ERROR");
    });
});

test("LOGIN: tipos inválidos (número, objeto, array) retornam 400", async () => {
    await withApi(async ({ baseUrl }) => {
        const payloads = [
            { email: 123, password: PASSWORD },
            { email: { $ne: null }, password: PASSWORD },
            { email: "user@corp.local", password: { $ne: null } },
            { email: ["user@corp.local"], password: [PASSWORD] },
        ];

        for (const payload of payloads) {
            const response = await post(baseUrl, "/api/v1/auth/login", payload);

            assert.equal(response.status, 400);
        }
    });
});

test("LOGIN: e-mail com formato inválido ou maior que 150 caracteres retorna 400", async () => {
    await withApi(async ({ baseUrl }) => {
        const invalid = ["sem-arroba", "a@b", `${"a".repeat(140)}@corp.local`];

        for (const email of invalid) {
            const response = await post(baseUrl, "/api/v1/auth/login", {
                email,
                password: PASSWORD,
            });

            assert.equal(response.status, 400, email);
        }
    });
});

test("LOGIN: e-mail com exatamente 150 caracteres é aceito na validação (DER v1.3)", async () => {
    await withApi(async ({ baseUrl }) => {
        const email = `${"a".repeat(139)}@corp.local`;
        assert.equal(email.length, 150);
        const response = await post(baseUrl, "/api/v1/auth/login", { email, password: PASSWORD });
        assert.equal(response.status, 401);
    });
});

test("LOGIN: senha acima de 128 caracteres retorna 400", async () => {
    await withApi(async ({ baseUrl }) => {
        const response = await post(baseUrl, "/api/v1/auth/login", {
            email: "user@corp.local",
            password: "a".repeat(129),
        });

        assert.equal(response.status, 400);
    });
});

test("LOGIN: JSON malformado retorna 400 INVALID_JSON", async () => {
    await withApi(async ({ baseUrl }) => {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{ nao e json",
        });
        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(body.error.code, "INVALID_JSON");
    });
});

test("LOGIN: JWT_SECRET ausente retorna 500 genérico, sem vazar detalhes nem gravar last_login_at", async () => {
    await withApi(async ({ baseUrl, repository }) => {
        delete process.env.JWT_SECRET;

        try {
            const response = await post(baseUrl, "/api/v1/auth/login", {
                email: "user@corp.local",
                password: PASSWORD,
            });
            const text = await response.text();

            assert.equal(response.status, 500);
            assert.equal(JSON.parse(text).error.code, "INTERNAL_ERROR");
            assert.ok(!text.includes("JWT_SECRET"));
            assert.equal(repository.byId.get(USER_ID).last_login_at, null);
        } finally {
            process.env.JWT_SECRET = SECRET;
        }
    });
});

// ---------- BE-03: authenticate ----------

test("AUTH: fluxo completo, login e depois GET /auth/me com o token", async () => {
    await withApi(async ({ baseUrl }) => {
        const token = await loginAs(baseUrl, "user@corp.local");
        const response = await get(baseUrl, "/api/v1/auth/me", `Bearer ${token}`);
        const text = await response.text();
        const body = JSON.parse(text);

        assert.equal(response.status, 200);
        assert.deepEqual(body.data.user, {
            user_id: USER_ID,
            name: "Usuario Teste",
            email: "user@corp.local",
            is_admin: false,
            status: "ACTIVE",
        });
        assert.ok(!text.includes("password_hash"));
    });
});

test("AUTH: esquema Bearer é aceito sem diferenciar maiúsculas", async () => {
    await withApi(async ({ baseUrl }) => {
        const token = await loginAs(baseUrl, "user@corp.local");
        const response = await get(baseUrl, "/api/v1/auth/me", `bearer ${token}`);

        assert.equal(response.status, 200);
    });
});

test("AUTH: sem header, esquema errado ou Bearer sem token retornam 401 TOKEN_MISSING", async () => {
    await withApi(async ({ baseUrl }) => {
        for (const header of [undefined, "Basic abc", "Bearer", "Bearer   ", "abc.def.ghi"]) {
            const response = await get(baseUrl, "/api/v1/auth/me", header);
            const body = await response.json();

            assert.equal(response.status, 401, String(header));
            assert.equal(body.error.code, "TOKEN_MISSING", String(header));
        }
    });
});

test("AUTH: token aleatório retorna 401 TOKEN_INVALID", async () => {
    await withApi(async ({ baseUrl }) => {
        const response = await get(baseUrl, "/api/v1/auth/me", "Bearer isso.nao.eh-jwt");
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_INVALID");
    });
});

test("AUTH: token expirado retorna 401 TOKEN_EXPIRED", async () => {
    await withApi(async ({ baseUrl }) => {
        const token = signToken({ is_admin: false }, { expiresIn: -10 });
        const response = await get(baseUrl, "/api/v1/auth/me", `Bearer ${token}`);
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_EXPIRED");
    });
});

test("AUTH: token assinado com outro segredo retorna 401 TOKEN_INVALID", async () => {
    await withApi(async ({ baseUrl }) => {
        const token = jwt.sign({ is_admin: true }, "outro-segredo-qualquer-123456789012", {
            algorithm: "HS256",
            issuer: "corporate-chat",
            subject: ADMIN_ID,
            expiresIn: "5m",
        });
        const response = await get(baseUrl, "/api/v1/auth/me", `Bearer ${token}`);
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_INVALID");
    });
});

test("AUTH: token com algoritmo 'none' é rejeitado", async () => {
    await withApi(async ({ baseUrl }) => {
        const token = jwt.sign({ is_admin: true }, null, {
            algorithm: "none",
            issuer: "corporate-chat",
            subject: ADMIN_ID,
            expiresIn: "5m",
        });
        const response = await get(baseUrl, "/api/v1/auth/me", `Bearer ${token}`);
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_INVALID");
    });
});

test("AUTH: token com emissor diferente é rejeitado", async () => {
    await withApi(async ({ baseUrl }) => {
        const token = signToken({ is_admin: false }, { issuer: "outro-sistema" });
        const response = await get(baseUrl, "/api/v1/auth/me", `Bearer ${token}`);
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_INVALID");
    });
});

test("AUTH: token com sub que não é UUID é rejeitado sem consultar o banco", async () => {
    await withApi(async ({ baseUrl }) => {
        const token = signToken({ is_admin: false }, { subject: "1' OR '1'='1" });
        const response = await get(baseUrl, "/api/v1/auth/me", `Bearer ${token}`);
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_INVALID");
    });
});

test("AUTH: token de usuário que não existe mais retorna 401 TOKEN_INVALID", async () => {
    await withApi(async ({ baseUrl, repository }) => {
        const token = await loginAs(baseUrl, "user@corp.local");

        repository.byId.delete(USER_ID);

        const response = await get(baseUrl, "/api/v1/auth/me", `Bearer ${token}`);
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_INVALID");
    });
});

test("AUTH: usuário desativado depois do login perde o acesso (403 USER_INACTIVE)", async () => {
    await withApi(async ({ baseUrl, repository }) => {
        const token = await loginAs(baseUrl, "user@corp.local");

        repository.byId.get(USER_ID).status = "INACTIVE";

        const response = await get(baseUrl, "/api/v1/auth/me", `Bearer ${token}`);
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.equal(body.error.code, "USER_INACTIVE");
    });
});

// ---------- BE-03: autorização administrativa ----------

function buildGuardedApp(authService) {
    const app = express();
    const authenticate = createAuthenticate({ authService });

    app.get("/admin-only", authenticate, requireAdmin, (req, res) => {
        res.json({ data: { ok: true, user_id: req.user.user_id } });
    });

    app.get("/requer-admin-sem-authenticate", requireAdmin, (req, res) => {
        res.json({ data: { ok: true } });
    });

    app.use(notFound);
    app.use(errorHandler);

    return app;
}

async function withGuardedApp(run) {
    const repository = makeRepository();
    const authService = createAuthService({ userRepository: repository });
    const { server, baseUrl } = await listen(buildGuardedApp(authService));

    try {
        await run({ baseUrl, repository });
    } finally {
        await close(server);
    }
}

test("ADMIN: administrador acessa rota protegida (200)", async () => {
    await withGuardedApp(async ({ baseUrl }) => {
        const token = signToken({ is_admin: true }, { subject: ADMIN_ID });
        const response = await get(baseUrl, "/admin-only", `Bearer ${token}`);
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.user_id, ADMIN_ID);
    });
});

test("ADMIN: usuário comum recebe 403 ADMIN_REQUIRED", async () => {
    await withGuardedApp(async ({ baseUrl }) => {
        const token = signToken({ is_admin: false }, { subject: USER_ID });
        const response = await get(baseUrl, "/admin-only", `Bearer ${token}`);
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.equal(body.error.code, "ADMIN_REQUIRED");
    });
});

test("ADMIN: sem token recebe 401 TOKEN_MISSING (e não 403)", async () => {
    await withGuardedApp(async ({ baseUrl }) => {
        const response = await get(baseUrl, "/admin-only");
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_MISSING");
    });
});

test("ADMIN: requireAdmin sem authenticate antes retorna 401 AUTH_REQUIRED", async () => {
    await withGuardedApp(async ({ baseUrl }) => {
        const response = await get(baseUrl, "/requer-admin-sem-authenticate");
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "AUTH_REQUIRED");
    });
});

test("ADMIN: a permissão vem do banco, não do token (claim is_admin adulterada não vale)", async () => {
    await withGuardedApp(async ({ baseUrl }) => {
        // Token afirma is_admin=true, mas no banco o usuário não é administrador.
        const token = signToken({ is_admin: true }, { subject: USER_ID });
        const response = await get(baseUrl, "/admin-only", `Bearer ${token}`);

        assert.equal(response.status, 403);
    });
});

test("ADMIN: promoção a administrador vale imediatamente, mesmo com token antigo", async () => {
    await withGuardedApp(async ({ baseUrl, repository }) => {
        const token = signToken({ is_admin: false }, { subject: USER_ID });

        repository.byId.get(USER_ID).is_admin = true;

        const response = await get(baseUrl, "/admin-only", `Bearer ${token}`);

        assert.equal(response.status, 200);
    });
});

// ---------- configuração do JWT ----------

test("CONFIG: getJwtConfig exige JWT_SECRET", () => {
    const original = process.env.JWT_SECRET;

    try {
        delete process.env.JWT_SECRET;
        assert.throws(() => getJwtConfig(), /JWT_SECRET/);

        process.env.JWT_SECRET = "   ";
        assert.throws(() => getJwtConfig(), /JWT_SECRET/);
    } finally {
        process.env.JWT_SECRET = original;
    }
});

test("CONFIG: em produção, segredo curto é recusado", () => {
    const originalSecret = process.env.JWT_SECRET;
    const originalEnv = process.env.NODE_ENV;

    try {
        process.env.NODE_ENV = "production";
        process.env.JWT_SECRET = "curto";
        assert.throws(() => getJwtConfig(), /pelo menos 32/);
    } finally {
        process.env.JWT_SECRET = originalSecret;
        process.env.NODE_ENV = originalEnv;
    }
});

test("CONFIG: expiração padrão é 1h e pode ser alterada por JWT_EXPIRES_IN", () => {
    const original = process.env.JWT_EXPIRES_IN;

    try {
        delete process.env.JWT_EXPIRES_IN;
        assert.equal(getJwtConfig().expiresIn, "1h");

        process.env.JWT_EXPIRES_IN = "15m";
        assert.equal(getJwtConfig().expiresIn, "15m");
    } finally {
        if (original === undefined) {
            delete process.env.JWT_EXPIRES_IN;
        } else {
            process.env.JWT_EXPIRES_IN = original;
        }
    }
});

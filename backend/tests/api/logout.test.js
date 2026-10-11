
process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
    "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { createApp } = require("../../src/app");

const {
    createAuthService,
} = require("../../src/services/auth/authService");

const {
    createHealthService,
} = require("../../src/services/health/healthService");

const {
    createMockAuthSessionRepository,
} = require("../helpers/mockAuthSessionRepository");

const USER_ID = "22222222-2222-4222-8222-222222222222";
const EMAIL = "user@corp.local";
const PASSWORD = "Senha@123";
const SECRET = process.env.JWT_SECRET;

// ======================================================
// REPOSITORY DE USUÁRIOS EM MEMÓRIA
// ======================================================

function createMockUserRepository() {
    const user = {
        user_id: USER_ID,
        name: "Usuário Teste",
        email: EMAIL,
        password_hash: bcrypt.hashSync(PASSWORD, 4),
        status: "ACTIVE",
        is_admin: false,
        last_login_at: null,
    };

    return {
        user,

        async findByEmail(email) {
            return email === user.email
                ? { ...user }
                : null;
        },

        async findById(userId) {
            return userId === user.user_id
                ? { ...user }
                : null;
        },

        async touchLastLogin(userId, date) {
            if (userId === user.user_id) {
                user.last_login_at = date;
            }
        },
    };
}

// ======================================================
// SERVIDOR DE TESTES
// ======================================================

function listen(app) {
    return new Promise((resolve) => {
        const server = app.listen(
            0,
            "127.0.0.1",
            () => {
                resolve({
                    server,
                    baseUrl:
                        `http://127.0.0.1:${server.address().port}`,
                });
            }
        );
    });
}

function close(server) {
    return new Promise((resolve) => {
        server.close(resolve);
    });
}

async function withApi(run, options = {}) {
    const userRepository = createMockUserRepository();

    const sessionRepository =
        options.sessionRepository ||
        createMockAuthSessionRepository();

    const authService = createAuthService({
        userRepository,
        sessionRepository,
    });

    const healthService = createHealthService({
        checks: {
            postgres: async () => {},
            mongodb: async () => {},
        },
    });

    const app = createApp({
        authService,
        healthService,
    });

    const { server, baseUrl } = await listen(app);

    try {
        await run({
            baseUrl,
            userRepository,
            sessionRepository,
            authService,
        });
    } finally {
        await close(server);
    }
}

// ======================================================
// HELPERS HTTP
// ======================================================

async function login(baseUrl) {
    const response = await fetch(
        `${baseUrl}/api/v1/auth/login`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: EMAIL,
                password: PASSWORD,
            }),
        }
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(typeof body.data.token, "string");

    return body.data.token;
}

function requestMe(baseUrl, token) {
    return fetch(
        `${baseUrl}/api/v1/auth/me`,
        {
            headers: token
                ? {
                    Authorization: `Bearer ${token}`,
                }
                : {},
        }
    );
}

function requestLogout(baseUrl, token) {
    return fetch(
        `${baseUrl}/api/v1/auth/logout`,
        {
            method: "POST",
            headers: token
                ? {
                    Authorization: `Bearer ${token}`,
                }
                : {},
        }
    );
}

// ======================================================
// BE-12 — TESTES DE SESSÃO E LOGOUT
// ======================================================

test("LOGOUT: login cria sessão com jti e expiração", async () => {
    await withApi(async ({
        baseUrl,
        sessionRepository,
    }) => {
        const token = await login(baseUrl);

        const payload = jwt.verify(token, SECRET, {
            algorithms: ["HS256"],
            issuer: "corporate-chat",
        });

        assert.equal(payload.sub, USER_ID);
        assert.equal(typeof payload.jti, "string");

        const session =
            await sessionRepository.findSessionById(
                payload.jti
            );

        assert.ok(session);
        assert.equal(session.user_id, USER_ID);
        assert.equal(session.revoked_at, null);

        assert.equal(
            new Date(session.expires_at).getTime(),
            payload.exp * 1000
        );
    });
});

test("LOGOUT: sessão válida retorna 204 No Content", async () => {
    await withApi(async ({ baseUrl }) => {
        const token = await login(baseUrl);

        const response = await requestLogout(
            baseUrl,
            token
        );

        assert.equal(response.status, 204);
        assert.equal(await response.text(), "");

        assert.equal(
            response.headers.get("cache-control"),
            "no-store"
        );
    });
});

test("LOGOUT: token revogado não pode acessar /auth/me", async () => {
    await withApi(async ({
        baseUrl,
        sessionRepository,
    }) => {
        const token = await login(baseUrl);
        const payload = jwt.decode(token);

        const before = await requestMe(baseUrl, token);

        assert.equal(before.status, 200);

        const logoutResponse = await requestLogout(
            baseUrl,
            token
        );

        assert.equal(logoutResponse.status, 204);

        const session =
            await sessionRepository.findSessionById(
                payload.jti
            );

        assert.ok(session.revoked_at instanceof Date);

        const after = await requestMe(baseUrl, token);
        const body = await after.json();

        assert.equal(after.status, 401);
        assert.equal(
            body.error.code,
            "TOKEN_REVOKED"
        );
    });
});

test("LOGOUT: encerrar sessão A não encerra sessão B", async () => {
    await withApi(async ({ baseUrl }) => {
        const tokenA = await login(baseUrl);
        const tokenB = await login(baseUrl);

        assert.notEqual(tokenA, tokenB);

        const payloadA = jwt.decode(tokenA);
        const payloadB = jwt.decode(tokenB);

        assert.notEqual(payloadA.jti, payloadB.jti);

        const logoutA = await requestLogout(
            baseUrl,
            tokenA
        );

        assert.equal(logoutA.status, 204);

        const responseA = await requestMe(
            baseUrl,
            tokenA
        );

        assert.equal(responseA.status, 401);

        const bodyA = await responseA.json();

        assert.equal(
            bodyA.error.code,
            "TOKEN_REVOKED"
        );

        const responseB = await requestMe(
            baseUrl,
            tokenB
        );

        assert.equal(responseB.status, 200);

        const logoutB = await requestLogout(
            baseUrl,
            tokenB
        );

        assert.equal(logoutB.status, 204);
    });
});

test("LOGOUT: repetir logout retorna 401 TOKEN_REVOKED", async () => {
    await withApi(async ({ baseUrl }) => {
        const token = await login(baseUrl);

        const first = await requestLogout(
            baseUrl,
            token
        );

        assert.equal(first.status, 204);

        const second = await requestLogout(
            baseUrl,
            token
        );

        const body = await second.json();

        assert.equal(second.status, 401);
        assert.equal(
            body.error.code,
            "TOKEN_REVOKED"
        );
    });
});

test("LOGOUT: requisição sem token retorna 401 TOKEN_MISSING", async () => {
    await withApi(async ({ baseUrl }) => {
        const response = await requestLogout(
            baseUrl
        );

        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(
            body.error.code,
            "TOKEN_MISSING"
        );
    });
});

test("LOGOUT: JWT sem jti é rejeitado", async () => {
    await withApi(async ({ baseUrl }) => {
        const token = jwt.sign(
            {
                is_admin: false,
            },
            SECRET,
            {
                algorithm: "HS256",
                issuer: "corporate-chat",
                subject: USER_ID,
                expiresIn: "5m",
            }
        );

        const response = await requestLogout(
            baseUrl,
            token
        );

        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(
            body.error.code,
            "TOKEN_INVALID"
        );
    });
});

test("LOGOUT: falha na persistência impede retorno do JWT", async () => {
    const sessionRepository =
        createMockAuthSessionRepository();

    sessionRepository.createSession =
        async () => {
            throw new Error(
                "Falha simulada na persistência"
            );
        };

    await withApi(
        async ({
            baseUrl,
            userRepository,
        }) => {
            const response = await fetch(
                `${baseUrl}/api/v1/auth/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: EMAIL,
                        password: PASSWORD,
                    }),
                }
            );

            const body = await response.json();

            assert.equal(response.status, 500);
            assert.equal(
                body.error.code,
                "INTERNAL_ERROR"
            );

            assert.equal(body.data, undefined);

            assert.equal(
                userRepository.user.last_login_at,
                null
            );
        },
        { sessionRepository }
    );
});

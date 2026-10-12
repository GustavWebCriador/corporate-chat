process.env.NODE_ENV = "test";

process.env.JWT_SECRET =
    "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const { createApp } = require("../../src/app");
const { createAuthService } = require("../../src/services/auth/authService");
const { createHealthService } = require("../../src/services/health/healthService");
const {
    createRegistrationRequestService,
} = require("../../src/services/registrationRequests/registrationRequestService");
const {
    createMockAuthSessionRepository,
} = require("../helpers/mockAuthSessionRepository");

const passwordHasher = {
    async hash(password) {
        return `HASH:${password}`;
    },
    async compare(password, hash) {
        return hash === `HASH:${password}`;
    },
};

function createMemoryUserRepository() {
    const rows = new Map();

    const adminId = "11111111-1111-4111-8111-111111111111";
    const normalUserId = "22222222-2222-4222-8222-222222222222";

    for (const [id, name, email, isAdmin] of [
        [adminId, "Administrador", "admin@corp.local", true],
        [normalUserId, "Usuário Comum", "user@corp.local", false],
    ]) {
        rows.set(id, {
            user_id: id,
            name,
            email,
            password_hash: "HASH:Senha123",
            status: "ACTIVE",
            is_admin: isAdmin,
            created_at: new Date(),
            updated_at: new Date(),
            last_login_at: null,
        });
    }

    async function findByEmail(email) {
        for (const user of rows.values()) {
            if (user.email.toLowerCase() === email.toLowerCase()) {
                return { ...user };
            }
        }
        return null;
    }

    async function findById(userId) {
        const user = rows.get(userId);
        return user ? { ...user } : null;
    }

    async function create(data) {
        const user = {
            user_id: randomUUID(),
            ...data,
            created_at: new Date(),
            updated_at: new Date(),
            last_login_at: null,
        };
        rows.set(user.user_id, user);
        return { ...user };
    }

    async function touchLastLogin(userId, date) {
        const user = rows.get(userId);
        if (user) {
            user.last_login_at = date;
        }
    }

    return { rows, adminId, normalUserId, findByEmail, findById, create, touchLastLogin };
}

function createMemoryRequestRepository() {
    const rows = new Map();

    function snapshot(row) {
        return row ? { ...row } : null;
    }

    return {
        rows,

        // Sem banco: roda o trabalho direto, sem transação real.
        async runInTransaction(work) {
            return work({});
        },

        async findPendingByEmail(email) {
            for (const row of rows.values()) {
                if (row.status === "PENDING" && row.email.toLowerCase() === email) {
                    return snapshot(row);
                }
            }
            return null;
        },

        async create(data) {
            const row = {
                request_id: randomUUID(),
                reviewed_at: null,
                reviewed_by: null,
                rejection_reason: null,
                created_user_id: null,
                ...data,
            };
            rows.set(row.request_id, row);
            return snapshot(row);
        },

        async findByIdForUpdate(requestId) {
            return snapshot(rows.get(requestId));
        },

        async list({ status, limit, offset }) {
            const all = [...rows.values()]
                .filter((row) => !status || row.status === status)
                .sort((a, b) => a.requested_at - b.requested_at);
            return {
                rows: all.slice(offset, offset + limit).map(snapshot),
                count: all.length,
            };
        },

        async markApproved(requestId, { reviewedBy, reviewedAt, createdUserId }) {
            const row = rows.get(requestId);
            if (!row || row.status !== "PENDING") return null;
            Object.assign(row, {
                status: "APPROVED",
                reviewed_by: reviewedBy,
                reviewed_at: reviewedAt,
                created_user_id: createdUserId,
                rejection_reason: null,
            });
            return snapshot(row);
        },

        async markRejected(requestId, { reviewedBy, reviewedAt, reason }) {
            const row = rows.get(requestId);
            if (!row || row.status !== "PENDING") return null;
            Object.assign(row, {
                status: "REJECTED",
                reviewed_by: reviewedBy,
                reviewed_at: reviewedAt,
                rejection_reason: reason,
            });
            return snapshot(row);
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

async function createTestContext() {
    const userRepository = createMemoryUserRepository();
    const requestRepository = createMemoryRequestRepository();

    const authService = createAuthService({
        userRepository,
        sessionRepository: createMockAuthSessionRepository(),
        passwordHasher,
    });

    const registrationRequestService = createRegistrationRequestService({
        registrationRequestRepository: requestRepository,
        userRepository,
        passwordHasher,
    });

    const healthService = createHealthService({
        checks: { postgres: async () => {}, mongodb: async () => {} },
    });

    const app = createApp({ authService, healthService, registrationRequestService });
    const { server, baseUrl } = await listen(app);

    return { userRepository, requestRepository, server, baseUrl };
}

async function login(baseUrl, email, password = "Senha123") {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    const body = await response.json();
    return body.data.token;
}

async function request(baseUrl, path, { method = "GET", token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
}
function emailWithLength(length) {
    const domain = "@test.local";

    return (
        "a".repeat(
            length - domain.length
        ) +
        domain
    );
}

const PUBLIC = "/api/v1/registration-requests";
const ADMIN = "/api/v1/admin/registration-requests";

test("solicitação pública cria PENDING sem login e ignora campos extras", async () => {
    const ctx = await createTestContext();
    try {
        const res = await request(ctx.baseUrl, PUBLIC, {
            method: "POST",
            body: { name: "  Maria   Silva ", email: "Maria@Corp.Local", status: "APPROVED", is_admin: true },
        });

        assert.equal(res.status, 201);
        assert.equal(res.body.data.request.status, "PENDING");
        assert.equal(res.body.data.request.email, "maria@corp.local");
        assert.equal(res.body.data.request.name, "Maria Silva");
        assert.equal(res.body.data.request.reviewed_by, undefined);
    } finally {
        await close(ctx.server);
    }
});

test("solicitação valida payload e rejeita e-mail já usado ou já pendente", async () => {
    const ctx = await createTestContext();
    try {
        const invalid = await request(ctx.baseUrl, PUBLIC, {
            method: "POST",
            body: { name: "", email: "invalido" },
        });
        assert.equal(invalid.status, 400);
        assert.equal(invalid.body.error.code, "VALIDATION_ERROR");
        assert.equal(invalid.body.error.details.length, 2);

        const existing = await request(ctx.baseUrl, PUBLIC, {
            method: "POST",
            body: { name: "Fulano", email: "user@corp.local" },
        });
        assert.equal(existing.status, 409);
        assert.equal(existing.body.error.code, "EMAIL_ALREADY_EXISTS");

        const body = { name: "Beltrano", email: "novo@corp.local" };
        assert.equal((await request(ctx.baseUrl, PUBLIC, { method: "POST", body })).status, 201);

        const duplicate = await request(ctx.baseUrl, PUBLIC, { method: "POST", body });
        assert.equal(duplicate.status, 409);
        assert.equal(duplicate.body.error.code, "REGISTRATION_REQUEST_ALREADY_PENDING");
    } finally {
        await close(ctx.server);
    }
});

test("rotas administrativas exigem autenticação e perfil de administrador", async () => {
    const ctx = await createTestContext();
    try {
        const anonymous = await request(ctx.baseUrl, ADMIN);
        assert.equal(anonymous.status, 401);

        const userToken = await login(ctx.baseUrl, "user@corp.local");
        const forbidden = await request(ctx.baseUrl, ADMIN, { token: userToken });
        assert.equal(forbidden.status, 403);
        assert.equal(forbidden.body.error.code, "ADMIN_REQUIRED");
    } finally {
        await close(ctx.server);
    }
});

test("admin lista com filtro/paginação e valida parâmetros", async () => {
    const ctx = await createTestContext();
    try {
        for (const email of ["a@corp.local", "b@corp.local", "c@corp.local"]) {
            await request(ctx.baseUrl, PUBLIC, { method: "POST", body: { name: "Pessoa", email } });
        }

        const token = await login(ctx.baseUrl, "admin@corp.local");

        const page = await request(ctx.baseUrl, `${ADMIN}?limit=2&offset=0`, { token });
        assert.equal(page.status, 200);
        assert.equal(page.body.data.requests.length, 2);
        assert.equal(page.body.data.pagination.total, 3);

        const bad = await request(ctx.baseUrl, `${ADMIN}?status=XYZ`, { token });
        assert.equal(bad.status, 400);

        const badLimit = await request(ctx.baseUrl, `${ADMIN}?limit=0`, { token });
        assert.equal(badLimit.status, 400);
    } finally {
        await close(ctx.server);
    }
});

test("aprovar cria usuário ACTIVE que consegue fazer login e bloqueia nova análise", async () => {
    const ctx = await createTestContext();
    try {
        const created = await request(ctx.baseUrl, PUBLIC, {
            method: "POST",
            body: { name: "Nova Pessoa", email: "nova@corp.local" },
        });
        const requestId = created.body.data.request.request_id;
        const token = await login(ctx.baseUrl, "admin@corp.local");

        const weak = await request(ctx.baseUrl, `${ADMIN}/${requestId}/approve`, {
            method: "POST",
            token,
            body: { password: "fraca" },
        });
        assert.equal(weak.status, 400);

        const approved = await request(ctx.baseUrl, `${ADMIN}/${requestId}/approve`, {
            method: "POST",
            token,
            body: { password: "SenhaInicial1" },
        });
        assert.equal(approved.status, 200);
        assert.equal(approved.body.data.request.status, "APPROVED");
        assert.equal(approved.body.data.request.reviewed_by, ctx.userRepository.adminId);
        assert.equal(approved.body.data.user.status, "ACTIVE");
        assert.equal(approved.body.data.user.is_admin, false);
        assert.equal(approved.body.data.user.password_hash, undefined);

        const newToken = await login(ctx.baseUrl, "nova@corp.local", "SenhaInicial1");
        assert.ok(newToken);

        const again = await request(ctx.baseUrl, `${ADMIN}/${requestId}/reject`, {
            method: "POST",
            token,
            body: { reason: "Tarde demais" },
        });
        assert.equal(again.status, 409);
        assert.equal(again.body.error.code, "REGISTRATION_REQUEST_ALREADY_REVIEWED");
    } finally {
        await close(ctx.server);
    }
});

test(
    "rejeitar exige motivo, não cria usuário e permite nova solicitação do e-mail",
    async () => {

        const ctx =
            await createTestContext();

        try {

            const body = {
                name: "Rejeitada",
                email: "rej@corp.local",
            };

            const created =
                await request(
                    ctx.baseUrl,
                    PUBLIC,
                    {
                        method: "POST",
                        body,
                    }
                );

            const requestId =
                created.body.data.request.request_id;

            const token =
                await login(
                    ctx.baseUrl,
                    "admin@corp.local"
                );

            const usersBefore =
                ctx.userRepository.rows.size;


            const noReason =
                await request(
                    ctx.baseUrl,
                    `${ADMIN}/${requestId}/reject`,
                    {
                        method: "POST",
                        token,
                        body: {},
                    }
                );

            assert.equal(
                noReason.status,
                400
            );


            const rejected =
                await request(
                    ctx.baseUrl,
                    `${ADMIN}/${requestId}/reject`,
                    {
                        method: "POST",
                        token,
                        body: {
                            reason: "Fora do quadro",
                        },
                    }
                );

            assert.equal(
                rejected.status,
                200
            );

            assert.equal(
                rejected.body.data.request.status,
                "REJECTED"
            );

            assert.equal(
                rejected.body.data.request.rejection_reason,
                "Fora do quadro"
            );

            assert.equal(
                ctx.userRepository.rows.size,
                usersBefore
            );


            /*
             * Uma solicitação já REJECTED
             * não pode ser aprovada depois.
             */
            const approveAfterReject =
                await request(
                    ctx.baseUrl,
                    `${ADMIN}/${requestId}/approve`,
                    {
                        method: "POST",
                        token,
                        body: {
                            password: "SenhaInicial1",
                        },
                    }
                );

            assert.equal(
                approveAfterReject.status,
                409
            );

            assert.equal(
                approveAfterReject.body.error.code,
                "REGISTRATION_REQUEST_ALREADY_REVIEWED"
            );


            /*
             * Após a rejeição, o mesmo e-mail
             * pode gerar uma nova solicitação.
             */
            const retry =
                await request(
                    ctx.baseUrl,
                    PUBLIC,
                    {
                        method: "POST",
                        body,
                    }
                );

            assert.equal(
                retry.status,
                201
            );

        } finally {

            await close(
                ctx.server
            );
        }
    }
);

test(
    "aprovar/rejeitar valida UUID e retorna 404 para solicitação inexistente",
    async () => {

        const ctx =
            await createTestContext();

        try {

            const token =
                await login(
                    ctx.baseUrl,
                    "admin@corp.local"
                );

            const invalid =
                await request(
                    ctx.baseUrl,
                    `${ADMIN}/nao-e-uuid/approve`,
                    {
                        method: "POST",
                        token,
                        body: {
                            password: "SenhaInicial1",
                        },
                    }
                );

            assert.equal(
                invalid.status,
                400
            );

            assert.equal(
                invalid.body.error.code,
                "INVALID_REQUEST_ID"
            );


            const missing =
                await request(
                    ctx.baseUrl,
                    `${ADMIN}/${randomUUID()}/reject`,
                    {
                        method: "POST",
                        token,
                        body: {
                            reason: "x",
                        },
                    }
                );

            assert.equal(
                missing.status,
                404
            );

            assert.equal(
                missing.body.error.code,
                "REGISTRATION_REQUEST_NOT_FOUND"
            );

        } finally {

            await close(
                ctx.server
            );
        }
    }
);

test(
    "solicitação aceita e-mail com 150 caracteres e rejeita 151",

    async () => {

        const ctx =
            await createTestContext();

        try {

            const valid =
                await request(
                    ctx.baseUrl,
                    PUBLIC,
                    {
                        method: "POST",

                        body: {
                            name: "Limite Email",
                            email: emailWithLength(150),
                        },
                    }
                );


            assert.equal(
                valid.status,
                201
            );


            const invalid =
                await request(
                    ctx.baseUrl,
                    PUBLIC,
                    {
                        method: "POST",

                        body: {
                            name: "Limite Email",
                            email: emailWithLength(151),
                        },
                    }
                );


            assert.equal(
                invalid.status,
                400
            );

            assert.equal(
                invalid.body.error.code,
                "VALIDATION_ERROR"
            );

        } finally {

            await close(
                ctx.server
            );
        }
    }
);
test(
    "rejeição aceita motivo com 500 caracteres e rejeita 501",

    async () => {

        const ctx =
            await createTestContext();

        try {

            const token =
                await login(
                    ctx.baseUrl,
                    "admin@corp.local"
                );


            const first =
                await request(
                    ctx.baseUrl,
                    PUBLIC,
                    {
                        method: "POST",

                        body: {
                            name: "Motivo 500",
                            email: "motivo500@corp.local",
                        },
                    }
                );


            const accepted =
                await request(
                    ctx.baseUrl,
                    `${ADMIN}/${first.body.data.request.request_id}/reject`,
                    {
                        method: "POST",
                        token,

                        body: {
                            reason: "x".repeat(500),
                        },
                    }
                );


            assert.equal(
                accepted.status,
                200
            );


            const second =
                await request(
                    ctx.baseUrl,
                    PUBLIC,
                    {
                        method: "POST",

                        body: {
                            name: "Motivo 501",
                            email: "motivo501@corp.local",
                        },
                    }
                );


            const rejected =
                await request(
                    ctx.baseUrl,
                    `${ADMIN}/${second.body.data.request.request_id}/reject`,
                    {
                        method: "POST",
                        token,

                        body: {
                            reason: "x".repeat(501),
                        },
                    }
                );


            assert.equal(
                rejected.status,
                400
            );

            assert.equal(
                rejected.body.error.code,
                "VALIDATION_ERROR"
            );

        } finally {

            await close(
                ctx.server
            );
        }
    }
);
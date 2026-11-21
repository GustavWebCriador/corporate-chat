
process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createApp } = require("../../src/app");
const AppError = require("../../src/errors/AppError");

const {
    createMessageService,
} = require("../../src/services/messages/messageService");

const CONVERSATION_ID = "507f1f77bcf86cd799439011";
const MESSAGE_ID = "607f1f77bcf86cd799439011";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";

const checkpoint = {
    conversation_id: CONVERSATION_ID,
    user_id: OTHER_USER_ID,
    last_delivered_message_id: MESSAGE_ID,
    last_delivered_at: "2026-11-21T10:00:00.000Z",
    last_read_message_id: MESSAGE_ID,
    last_read_at: "2026-11-21T10:01:00.000Z",
};

// ========================================
// HELPERS DE API
// ========================================

function createAuthService() {
    return {
        async authenticateToken(token) {
            if (token !== "token-valido") {
                throw AppError.unauthorized(
                    "Token inválido.",
                    "TOKEN_INVALID"
                );
            }

            return {
                user_id: USER_ID,
                status: "ACTIVE",
                is_admin: false,
            };
        },
    };
}

async function withApi(messageService, callback) {
    const app = createApp({
        authService: createAuthService(),
        messageService,
    });

    const server = await new Promise((resolve) => {
        const instance = app.listen(
            0,
            "127.0.0.1",
            () => resolve(instance)
        );
    });

    const baseUrl =
        `http://127.0.0.1:${server.address().port}`;

    try {
        await callback(baseUrl);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
}

function checkpointsUrl(baseUrl) {
    return (
        `${baseUrl}/api/v1/conversations/` +
        `${CONVERSATION_ID}/checkpoints`
    );
}

function authorizedHeaders() {
    return {
        Authorization: "Bearer token-valido",
    };
}

// ========================================
// TESTE 1 - CONSULTA AUTORIZADA
// ========================================

test("CHECKPOINTS: membro autenticado consulta estados", async () => {
    const calls = [];

    const messageService = {
        async listCheckpoints(params) {
            calls.push(params);

            return {
                checkpoints: [checkpoint],
            };
        },
    };

    await withApi(messageService, async (baseUrl) => {
        const response = await fetch(
            checkpointsUrl(baseUrl),
            {
                headers: authorizedHeaders(),
            }
        );

        const body = await response.json();

        assert.equal(response.status, 200);

        assert.deepEqual(body.data, {
            checkpoints: [checkpoint],
        });

        assert.deepEqual(calls, [{
            conversationId: CONVERSATION_ID,
            userId: USER_ID,
        }]);

        assert.match(
            response.headers.get("cache-control") ?? "",
            /no-store/
        );
    });
});

// ========================================
// TESTE 2 - SEM AUTENTICAÇÃO
// ========================================

test("CHECKPOINTS: rota exige autenticação", async () => {
    let called = false;

    const messageService = {
        async listCheckpoints() {
            called = true;

            return { checkpoints: [] };
        },
    };

    await withApi(messageService, async (baseUrl) => {
        const response = await fetch(
            checkpointsUrl(baseUrl)
        );

        assert.equal(response.status, 401);
        assert.equal(called, false);
    });
});

// ========================================
// TESTE 3 - TOKEN INVÁLIDO
// ========================================

test("CHECKPOINTS: token inválido é rejeitado", async () => {
    const messageService = {
        async listCheckpoints() {
            return { checkpoints: [] };
        },
    };

    await withApi(messageService, async (baseUrl) => {
        const response = await fetch(
            checkpointsUrl(baseUrl),
            {
                headers: {
                    Authorization: "Bearer token-incorreto",
                },
            }
        );

        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_INVALID");
    });
});

// ========================================
// TESTE 4 - SEM VÍNCULO ATIVO
// ========================================

test("CHECKPOINTS: usuário sem vínculo recebe 403", async () => {
    const messageService = {
        async listCheckpoints() {
            throw AppError.forbidden(
                "Usuário não é membro ativo da conversa.",
                "USER_NOT_ACTIVE_MEMBER"
            );
        },
    };

    await withApi(messageService, async (baseUrl) => {
        const response = await fetch(
            checkpointsUrl(baseUrl),
            {
                headers: authorizedHeaders(),
            }
        );

        const body = await response.json();

        assert.equal(response.status, 403);

        assert.equal(
            body.error.code,
            "USER_NOT_ACTIVE_MEMBER"
        );

        assert.equal(body.data, undefined);
    });
});

// ========================================
// TESTE 5 - NÃO CONFIAR NO USERID DO CLIENTE
// ========================================

test("CHECKPOINTS: identidade vem do JWT", async () => {
    let receivedParams = null;

    const messageService = {
        async listCheckpoints(params) {
            receivedParams = params;

            return { checkpoints: [] };
        },
    };

    await withApi(messageService, async (baseUrl) => {
        const response = await fetch(
            checkpointsUrl(baseUrl) +
                `?userId=${OTHER_USER_ID}`,
            {
                headers: authorizedHeaders(),
            }
        );

        assert.equal(response.status, 200);

        assert.equal(receivedParams.userId, USER_ID);
    });
});

// ========================================
// TESTE 6 - ERRO INTERNO
// ========================================

test("CHECKPOINTS: erro inesperado é sanitizado", async () => {
    const messageService = {
        async listCheckpoints() {
            throw new Error("Informação interna do banco");
        },
    };

    await withApi(messageService, async (baseUrl) => {
        const response = await fetch(
            checkpointsUrl(baseUrl),
            {
                headers: authorizedHeaders(),
            }
        );

        const body = await response.json();

        assert.equal(response.status, 500);

        assert.equal(
            body.error.code,
            "INTERNAL_ERROR"
        );

        assert.doesNotMatch(
            JSON.stringify(body),
            /Informação interna do banco/
        );
    });
});

// ========================================
// TESTE 7 - SERVICE CONSULTA MEMBROS ATIVOS
// ========================================

test("CHECKPOINTS SERVICE: retorna apenas dados públicos", async () => {
    const calls = [];

    const member = {
        conversation_id: CONVERSATION_ID,
        user_id: OTHER_USER_ID,
        last_delivered_message_id: MESSAGE_ID,
        last_delivered_at:
            new Date("2026-11-21T10:00:00.000Z"),
        last_read_message_id: MESSAGE_ID,
        last_read_at:
            new Date("2026-11-21T10:01:00.000Z"),
        password_hash: "não-deve-ser-exposto",
    };

    const ConversationMemberModel = {
        async findOne(filter) {
            calls.push({ operation: "findOne", filter });

            return {
                user_id: USER_ID,
                status: "ACTIVE",
            };
        },

        find(filter) {
            calls.push({ operation: "find", filter });

            return {
                async lean() {
                    return [member];
                },
            };
        },
    };

    const service = createMessageService({
        ConversationMemberModel,
        assertActiveUser: async () => {},
    });

    const result = await service.listCheckpoints({
        conversationId: CONVERSATION_ID,
        userId: USER_ID,
    });

    assert.equal(result.checkpoints.length, 1);

    assert.equal(
        result.checkpoints[0].last_read_message_id,
        MESSAGE_ID
    );

    assert.equal(
        result.checkpoints[0].password_hash,
        undefined
    );

    assert.deepEqual(calls[1].filter, {
        conversation_id: CONVERSATION_ID,
        status: "ACTIVE",
    });

    assert.equal(calls[0].operation, "findOne");
});

// ========================================
// TESTE 8 - SERVICE AUTORIZA ANTES DE LISTAR
// ========================================

test("CHECKPOINTS SERVICE: bloqueia consulta sem vínculo", async () => {
    let listed = false;

    const ConversationMemberModel = {
        async findOne() {
            return null;
        },

        find() {
            listed = true;

            return {
                async lean() {
                    return [];
                },
            };
        },
    };

    const service = createMessageService({
        ConversationMemberModel,
        assertActiveUser: async () => {},
    });

    await assert.rejects(
        service.listCheckpoints({
            conversationId: CONVERSATION_ID,
            userId: USER_ID,
        }),
        (error) => {
            assert.equal(error.code, "USER_NOT_ACTIVE_MEMBER");
            return true;
        }
    );

    assert.equal(listed, false);
});

// ========================================
// TESTE 9 - IDENTIFICADOR INVÁLIDO
// ========================================

test("CHECKPOINTS SERVICE: rejeita conversationId inválido", async () => {
    const service = createMessageService({
        assertActiveUser: async () => {},
    });

    await assert.rejects(
        service.listCheckpoints({
            conversationId: "conversa-invalida",
            userId: USER_ID,
        }),
        (error) => {
            assert.equal(error.code, "INVALID_CONVERSATION_ID");
            return true;
        }
    );
});

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createApp } = require("../../src/app");

const USER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";
const CONVERSATION_ID = "507f1f77bcf86cd799439011";

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
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

function createTestApi() {
    const calls = {
        createPrivate: [],
        list: [],
        history: [],
    };

    const authService = {
        async authenticateToken(token) {
            if (token !== "token-de-teste") {
                throw new Error("Token inválido.");
            }

            return {
                user_id: USER_ID,
                status: "ACTIVE",
                is_admin: false,
            };
        },
    };

    const conversationService = {
        async createPrivateForUser(params) {
            calls.createPrivate.push(params);

            return {
                _id: CONVERSATION_ID,
                type: "PRIVATE",
            };
        },

        async listForUser(params) {
            calls.list.push(params);

            return [
                {
                    _id: CONVERSATION_ID,
                    type: "PRIVATE",
                },
            ];
        },

        async getHistory(params) {
            calls.history.push(params);

            return {
                items: [
                    {
                        _id: "607f1f77bcf86cd799439011",
                        content: "Mensagem de teste",
                    },
                ],
                hasMore: false,
                nextCursor: null,
            };
        },
    };

    return {
        app: createApp({
            authService,
            conversationService,
        }),
        calls,
    };
}

function authorizationHeaders() {
    return {
        Authorization: "Bearer token-de-teste",
    };
}

async function withApi(run) {
    const { app, calls } = createTestApi();
    const { server, baseUrl } = await listen(app);

    try {
        await run({ baseUrl, calls });
    } finally {
        await close(server);
    }
}

test("BE-07: criar conversa privada retorna 201", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await fetch(
            `${baseUrl}/api/v1/conversations/private`,
            {
                method: "POST",
                headers: {
                    ...authorizationHeaders(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    otherUserId: OTHER_USER_ID,
                }),
            }
        );

        const body = await response.json();

        assert.equal(response.status, 201);
        assert.equal(body.data.conversation.type, "PRIVATE");

        assert.deepEqual(calls.createPrivate, [
            {
                requesterId: USER_ID,
                otherUserId: OTHER_USER_ID,
            },
        ]);
    });
});

test("BE-07: criar conversa sem outro usuário retorna 400", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await fetch(
            `${baseUrl}/api/v1/conversations/private`,
            {
                method: "POST",
                headers: {
                    ...authorizationHeaders(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            }
        );

        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(
            body.error.code,
            "OTHER_USER_ID_REQUIRED"
        );
        assert.equal(calls.createPrivate.length, 0);
    });
});

test("BE-07: listar conversas retorna 200", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await fetch(
            `${baseUrl}/api/v1/conversations`,
            {
                headers: authorizationHeaders(),
            }
        );

        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.conversations.length, 1);
        assert.equal(
            body.data.conversations[0].type,
            "PRIVATE"
        );

        assert.deepEqual(calls.list, [
            {
                userId: USER_ID,
            },
        ]);
    });
});

test("BE-07: consultar histórico encaminha os parâmetros de paginação", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await fetch(
            `${baseUrl}/api/v1/conversations/${CONVERSATION_ID}/messages?limit=20&before=cursor-teste`,
            {
                headers: authorizationHeaders(),
            }
        );

        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.items.length, 1);
        assert.equal(body.data.hasMore, false);

        assert.deepEqual(calls.history, [
            {
                conversationId: CONVERSATION_ID,
                userId: USER_ID,
                limit: "20",
                before: "cursor-teste",
            },
        ]);
    });
});

test("BE-07: listar conversas sem autenticação retorna 401", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await fetch(
            `${baseUrl}/api/v1/conversations`
        );

        assert.equal(response.status, 401);
        assert.equal(calls.list.length, 0);
    });
});
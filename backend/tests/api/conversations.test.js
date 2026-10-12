process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const AppError = require("../../src/errors/AppError");
const {
    PersistenceIntegrationError,
} = require("../../src/services/integration/userIdentityService");

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

    /*
     * Falhas configuráveis pelo teste para simular
     * rejeições da camada de persistência.
     */
    const failures = {
        createPrivate: null,
        history: null,
    };

    const authService = {
        async authenticateToken(token) {
            /*
             * O serviço real rejeita tokens inválidos com
             * AppError 401 TOKEN_INVALID.
             */
            if (token !== "token-de-teste") {
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

    const conversationService = {
        async createPrivateForUser(params) {
            calls.createPrivate.push(params);

            if (failures.createPrivate) {
                throw failures.createPrivate;
            }

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

            if (failures.history) {
                throw failures.history;
            }

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
        failures,
    };
}

function authorizationHeaders() {
    return {
        Authorization: "Bearer token-de-teste",
    };
}

async function withApi(run) {
    const { app, calls, failures } = createTestApi();
    const { server, baseUrl } = await listen(app);

    try {
        await run({ baseUrl, calls, failures });
    } finally {
        await close(server);
    }
}

function postPrivate(baseUrl, { headers = {}, body } = {}) {
    return fetch(`${baseUrl}/api/v1/conversations/private`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body,
    });
}

function getMessages(baseUrl, { headers = {}, query = "" } = {}) {
    return fetch(
        `${baseUrl}/api/v1/conversations/${CONVERSATION_ID}/messages${query}`,
        { headers }
    );
}

test("BE-07: criar conversa privada retorna 201", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await postPrivate(baseUrl, {
            headers: authorizationHeaders(),
            body: JSON.stringify({
                otherUserId: OTHER_USER_ID,
            }),
        });

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
        const response = await postPrivate(baseUrl, {
            headers: authorizationHeaders(),
            body: JSON.stringify({}),
        });

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
        const response = await getMessages(baseUrl, {
            headers: authorizationHeaders(),
            query: "?limit=20&before=cursor-teste",
        });

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

        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_MISSING");
        assert.equal(calls.list.length, 0);
    });
});

/*
 * ============================
 * SEGURANÇA — JWT obrigatório
 * ============================
 */

test("BE-07 SECURITY: criar conversa privada sem autenticação retorna 401 TOKEN_MISSING", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await postPrivate(baseUrl, {
            body: JSON.stringify({
                otherUserId: OTHER_USER_ID,
            }),
        });

        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_MISSING");
        assert.equal(calls.createPrivate.length, 0);
    });
});

test("BE-07 SECURITY: criar conversa privada com token inválido retorna 401 TOKEN_INVALID", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await postPrivate(baseUrl, {
            headers: {
                Authorization: "Bearer token-errado",
            },
            body: JSON.stringify({
                otherUserId: OTHER_USER_ID,
            }),
        });

        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_INVALID");
        assert.equal(calls.createPrivate.length, 0);
    });
});

test("BE-07 SECURITY: criar conversa privada com Authorization mal formatado retorna 401 TOKEN_MISSING", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await postPrivate(baseUrl, {
            headers: {
                Authorization: "Token token-de-teste",
            },
            body: JSON.stringify({
                otherUserId: OTHER_USER_ID,
            }),
        });

        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_MISSING");
        assert.equal(calls.createPrivate.length, 0);
    });
});

test("BE-07 SECURITY: consultar histórico sem autenticação retorna 401 TOKEN_MISSING", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await getMessages(baseUrl);

        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_MISSING");
        assert.equal(calls.history.length, 0);
    });
});

test("BE-07 SECURITY: consultar histórico com token inválido retorna 401 TOKEN_INVALID", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await getMessages(baseUrl, {
            headers: {
                Authorization: "Bearer token-errado",
            },
        });

        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_INVALID");
        assert.equal(calls.history.length, 0);
    });
});

test("BE-07 SECURITY: consultar histórico com Authorization mal formatado retorna 401 TOKEN_MISSING", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await getMessages(baseUrl, {
            headers: {
                Authorization: "Bearer ",
            },
        });

        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, "TOKEN_MISSING");
        assert.equal(calls.history.length, 0);
    });
});

/*
 * ============================
 * CENÁRIOS NEGATIVOS
 * ============================
 */

test("BE-07: criar conversa privada com JSON malformado retorna 400 INVALID_JSON", async () => {
    await withApi(async ({ baseUrl, calls }) => {
        const response = await postPrivate(baseUrl, {
            headers: authorizationHeaders(),
            body: '{"otherUserId": ',
        });

        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(body.error.code, "INVALID_JSON");
        assert.equal(calls.createPrivate.length, 0);
    });
});

test("BE-07: criar conversa privada com usuário inativo retorna 500 sem vazar detalhes", async () => {
    await withApi(async ({ baseUrl, calls, failures }) => {
        failures.createPrivate = new PersistenceIntegrationError(
            "USERS_INACTIVE",
            "Existem usuários inativos.",
            {
                user_ids: [OTHER_USER_ID],
            }
        );

        const response = await postPrivate(baseUrl, {
            headers: authorizationHeaders(),
            body: JSON.stringify({
                otherUserId: OTHER_USER_ID,
            }),
        });

        const body = await response.json();

        assert.equal(response.status, 500);
        assert.equal(body.error.code, "INTERNAL_ERROR");
        assert.equal(
            body.error.message,
            "Erro interno do servidor."
        );
        assert.equal(
            JSON.stringify(body).includes("USERS_INACTIVE"),
            false
        );
    });
});

test("BE-07: histórico com conversationId inválido é rejeitado pelo serviço", async () => {
    await withApi(async ({ baseUrl, calls, failures }) => {
        failures.history = new PersistenceIntegrationError(
            "INVALID_CONVERSATION_ID",
            "conversationId inválido."
        );

        const response = await getMessages(baseUrl, {
            headers: authorizationHeaders(),
        });

        const body = await response.json();

        assert.equal(response.status, 500);
        assert.equal(body.error.code, "INTERNAL_ERROR");
        assert.equal(body.data, undefined);

        /*
         * A identidade autenticada é sempre encaminhada
         * ao serviço, mesmo quando a requisição é rejeitada.
         */
        assert.equal(calls.history.length, 1);
        assert.equal(calls.history[0].userId, USER_ID);
        assert.equal(
            calls.history[0].conversationId,
            CONVERSATION_ID
        );
    });
});

test("BE-07: histórico com cursor de paginação inválido é rejeitado pelo serviço", async () => {
    await withApi(async ({ baseUrl, calls, failures }) => {
        failures.history = new PersistenceIntegrationError(
            "INVALID_QUERY_CURSOR",
            "Cursor de paginação inválido."
        );

        const response = await getMessages(baseUrl, {
            headers: authorizationHeaders(),
            query: "?before=cursor-invalido",
        });

        const body = await response.json();

        assert.equal(response.status, 500);
        assert.equal(body.error.code, "INTERNAL_ERROR");
        assert.equal(body.data, undefined);
        assert.equal(calls.history.length, 1);
        assert.equal(calls.history[0].before, "cursor-invalido");
    });
});

test("BE-07 SECURITY: histórico nega acesso de usuário não membro sem vazar mensagens", async () => {
    await withApi(async ({ baseUrl, calls, failures }) => {
        failures.history = new PersistenceIntegrationError(
            "USER_NOT_ACTIVE_MEMBER",
            "Usuário não é membro ativo da conversa.",
            {
                conversation_id: CONVERSATION_ID,
                user_id: USER_ID,
            }
        );

        const response = await getMessages(baseUrl, {
            headers: authorizationHeaders(),
        });

        const body = await response.json();

        assert.equal(response.status, 500);
        assert.equal(body.error.code, "INTERNAL_ERROR");
        assert.equal(
            body.error.message,
            "Erro interno do servidor."
        );

        /*
         * Restrição de histórico: nenhuma mensagem é
         * exposta quando o acesso é negado.
         */
        assert.equal(body.data, undefined);
        assert.equal(
            JSON.stringify(body).includes("Mensagem de teste"),
            false
        );

        /*
         * A identidade do usuário autenticado foi
         * encaminhada para verificação de pertencimento.
         */
        assert.deepEqual(calls.history, [
            {
                conversationId: CONVERSATION_ID,
                userId: USER_ID,
                limit: undefined,
                before: null,
            },
        ]);
    });
});

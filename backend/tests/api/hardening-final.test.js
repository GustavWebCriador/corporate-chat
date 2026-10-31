
process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const {
    createApp,
} = require("../../src/app");

const {
    createMessageRoutes,
} = require("../../src/routes/v1/messageRoutes");

const errorHandler = require(
    "../../src/middlewares/errorHandler"
);

const AppError = require(
    "../../src/errors/AppError"
);

const CONVERSATION_ID =
    "507f1f77bcf86cd799439011";

const MESSAGE_ID =
    "507f1f77bcf86cd799439012";

const CURRENT_USER = {
    user_id:
        "22222222-2222-4222-8222-222222222222",
    name: "Usuário de Teste",
    email: "usuario@corp.local",
    status: "ACTIVE",
    is_admin: false,
};

const ADMIN_USER = {
    ...CURRENT_USER,
    user_id:
        "11111111-1111-4111-8111-111111111111",
    is_admin: true,
};

/*
 * Serviços simulados para validar HTTP
 * sem depender dos bancos de dados.
 */
function createAuthService() {
    return {
        async authenticateToken(token) {
            if (token === "admin-token") {
                return { ...ADMIN_USER };
            }

            if (token === "user-token") {
                return { ...CURRENT_USER };
            }

            throw AppError.unauthorized(
                "Token inválido.",
                "TOKEN_INVALID"
            );
        },

        async login() {
            throw AppError.unauthorized(
                "E-mail ou senha inválidos.",
                "INVALID_CREDENTIALS"
            );
        },

        async logout() {
            return undefined;
        },
    };
}

function createServices() {
    return {
        authService: createAuthService(),

        userService: {
            async listUsers() {
                return [];
            },
        },

        registrationRequestService: {
            async listRequests() {
                return {
                    requests: [],
                    total: 0,
                };
            },

            async createRequest(input) {
                return {
                    request_id:
                        "11111111-1111-4111-8111-111111111111",
                    name: input.name,
                    email: input.email,
                    status: "PENDING",
                };
            },
        },

        dashboardService: {
            async getDashboard() {
                return {
                    contacts: [],
                    conversations: [],
                };
            },
        },

        conversationService: {
            async listForUser() {
                return [];
            },
        },

        groupService: {
            async getGroup({ groupId }) {
                return {
                    _id: groupId,
                    name: "Grupo Teste",
                    members: [],
                };
            },
        },

        messageService: {
            async sendMessage() {
                return {
                    reused: false,
                    message: {
                        _id: MESSAGE_ID,
                    },
                };
            },

            async markDelivered() {
                return { updated: true };
            },

            async markRead() {
                return { updated: true };
            },
        },
    };
}

/*
 * Inicializa o servidor em uma porta
 * disponível e garante seu encerramento.
 */
async function withServer(app, callback) {
    const server = await new Promise(
        (resolve, reject) => {
            const instance = app.listen(
                0,
                "127.0.0.1",
                () => resolve(instance)
            );

            instance.once("error", reject);
        }
    );

    try {
        const baseUrl =
            `http://127.0.0.1:${server.address().port}`;

        await callback(baseUrl);
    } finally {
        await new Promise(
            (resolve, reject) => {
                server.close(error =>
                    error
                        ? reject(error)
                        : resolve()
                );
            }
        );
    }
}

function authHeaders(token, json = false) {
    return {
        Authorization: `Bearer ${token}`,

        ...(json
            ? {
                "Content-Type":
                    "application/json",
            }
            : {}),
    };
}

/*
 * Teste 1:
 * Respostas de funcionalidades sensíveis
 * devem impedir armazenamento em cache.
 */
test(
    "BE-12: respostas autenticadas e logout recebem no-store",
    async t => {
        const app = createApp(
            createServices()
        );

        const cases = [
            {
                method: "GET",
                path: "/api/v1/auth/me",
                token: "user-token",
                status: 200,
            },
            {
                method: "GET",
                path: "/api/v1/admin/users",
                token: "admin-token",
                status: 200,
            },
            {
                method: "GET",
                path:
                    "/api/v1/admin/registration-requests",
                token: "admin-token",
                status: 200,
            },
            {
                method: "GET",
                path: "/api/v1/dashboard",
                token: "user-token",
                status: 200,
            },
            {
                method: "GET",
                path: "/api/v1/conversations",
                token: "user-token",
                status: 200,
            },
            {
                method: "GET",
                path:
                    `/api/v1/groups/${CONVERSATION_ID}`,
                token: "user-token",
                status: 200,
            },
            {
                method: "POST",
                path:
                    `/api/v1/conversations/${CONVERSATION_ID}/messages`,
                token: "user-token",
                status: 201,
                body: {
                    content: "Mensagem de teste",
                    clientMessageId:
                        "be12-final-1",
                },
            },
            {
                method: "PATCH",
                path:
                    `/api/v1/conversations/${CONVERSATION_ID}/delivery`,
                token: "user-token",
                status: 200,
                body: {
                    messageId: MESSAGE_ID,
                },
            },
            {
                method: "PATCH",
                path:
                    `/api/v1/conversations/${CONVERSATION_ID}/read`,
                token: "user-token",
                status: 200,
                body: {
                    messageId: MESSAGE_ID,
                },
            },
            {
                method: "POST",
                path: "/api/v1/auth/logout",
                token: "user-token",
                status: 204,
            },
        ];

        await withServer(
            app,
            async baseUrl => {
                for (const scenario of cases) {
                    await t.test(
                        `${scenario.method} ${scenario.path}`,
                        async () => {
                            const response =
                                await fetch(
                                    `${baseUrl}${scenario.path}`,
                                    {
                                        method:
                                            scenario.method,

                                        headers:
                                            authHeaders(
                                                scenario.token,
                                                Boolean(
                                                    scenario.body
                                                )
                                            ),

                                        ...(scenario.body
                                            ? {
                                                body:
                                                    JSON.stringify(
                                                        scenario.body
                                                    ),
                                            }
                                            : {}),
                                    }
                                );

                            assert.equal(
                                response.status,
                                scenario.status
                            );

                            assert.equal(
                                response.headers.get(
                                    "cache-control"
                                ),
                                "no-store"
                            );

                            await response.arrayBuffer();
                        }
                    );
                }
            }
        );
    }
);

/*
 * Teste 2:
 * Verifica o router de mensagens
 * isoladamente.
 *
 * Evita falso positivo causado
 * pelo router de conversas.
 */
test(
    "BE-12: router de mensagens isolado exige autenticação e usa no-store",
    async () => {
        const app = express();
        const services = createServices();

        app.use(express.json());

        app.use(
            "/api/v1/conversations",
            createMessageRoutes({
                authService:
                    services.authService,
                messageService:
                    services.messageService,
            })
        );

        app.use(errorHandler);

        await withServer(
            app,
            async baseUrl => {
                const response = await fetch(
                    `${baseUrl}/api/v1/conversations/${CONVERSATION_ID}/messages`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: "{}",
                    }
                );

                const body =
                    await response.json();

                assert.equal(
                    response.status,
                    401
                );

                assert.equal(
                    body.error.code,
                    "TOKEN_MISSING"
                );

                assert.equal(
                    response.headers.get(
                        "cache-control"
                    ),
                    "no-store"
                );
            }
        );
    }
);

/*
 * Teste 3:
 * Erros internos não devem expor
 * mensagens técnicas ou segredos.
 */
test(
    "BE-12: erro interno é sanitizado e utiliza no-store",
    async () => {
        const services = createServices();

        services.dashboardService.getDashboard =
            async () => {
                throw new Error(
                    "INTERNAL_SECRET_SHOULD_NOT_LEAK"
                );
            };

        await withServer(
            createApp(services),
            async baseUrl => {
                const response = await fetch(
                    `${baseUrl}/api/v1/dashboard`,
                    {
                        headers:
                            authHeaders(
                                "user-token"
                            ),
                    }
                );

                const body =
                    await response.json();

                assert.equal(
                    response.status,
                    500
                );

                assert.equal(
                    body.error.code,
                    "INTERNAL_ERROR"
                );

                assert.equal(
                    response.headers.get(
                        "cache-control"
                    ),
                    "no-store"
                );

                assert.ok(
                    !JSON.stringify(body).includes(
                        "INTERNAL_SECRET_SHOULD_NOT_LEAK"
                    )
                );
            }
        );
    }
);

/*
 * Teste 4:
 * Limite de tentativas de login.
 *
 * 10 falhas permitidas na janela,
 * 11ª tentativa bloqueada.
 */
test(
    "BE-12: rate limiting de login retorna 429 com no-store",
    async () => {
        await withServer(
            createApp(createServices()),
            async baseUrl => {
                for (
                    let attempt = 1;
                    attempt <= 11;
                    attempt += 1
                ) {
                    const response = await fetch(
                        `${baseUrl}/api/v1/auth/login`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                            },
                            body: JSON.stringify({
                                email:
                                    "usuario@corp.local",
                                password:
                                    "SenhaInvalida123",
                            }),
                        }
                    );

                    if (attempt <= 10) {
                        assert.equal(
                            response.status,
                            401
                        );
                    } else {
                        assert.equal(
                            response.status,
                            429
                        );

                        assert.equal(
                            response.headers.get(
                                "cache-control"
                            ),
                            "no-store"
                        );

                        const body =
                            await response.json();

                        assert.equal(
                            body.error.code,
                            "RATE_LIMITED"
                        );
                    }

                    if (!response.bodyUsed) {
                        await response.arrayBuffer();
                    }
                }
            }
        );
    }
);

/*
 * Teste 5:
 * Limitação de solicitações de cadastro.
 *
 * 5 requisições permitidas,
 * 6ª tentativa bloqueada.
 */
test(
    "BE-12: rate limiting de cadastro retorna 429 com no-store",
    async () => {
        await withServer(
            createApp(createServices()),
            async baseUrl => {
                for (
                    let attempt = 1;
                    attempt <= 6;
                    attempt += 1
                ) {
                    const response = await fetch(
                        `${baseUrl}/api/v1/registration-requests`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                            },
                            body: JSON.stringify({
                                name:
                                    `Pessoa ${attempt}`,
                                email:
                                    `pessoa${attempt}@corp.local`,
                            }),
                        }
                    );

                    if (attempt <= 5) {
                        assert.equal(
                            response.status,
                            201
                        );
                    } else {
                        assert.equal(
                            response.status,
                            429
                        );

                        assert.equal(
                            response.headers.get(
                                "cache-control"
                            ),
                            "no-store"
                        );

                        const body =
                            await response.json();

                        assert.equal(
                            body.error.code,
                            "RATE_LIMITED"
                        );
                    }

                    if (!response.bodyUsed) {
                        await response.arrayBuffer();
                    }
                }
            }
        );
    }
);
process.env.NODE_ENV =
    "test";

process.env.JWT_SECRET =
    "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";


const test =
    require(
        "node:test"
    );

const assert =
    require(
        "node:assert/strict"
    );

const {
    createApp,
} = require(
    "../../src/app"
);


const TEST_USER = {
    user_id:
        "22222222-2222-4222-8222-222222222222",

    name:
        "Usuário Teste",

    email:
        "usuario@corp.local",

    status:
        "ACTIVE",

    is_admin:
        false,
};


function createAuthService() {
    return {
        async authenticateToken() {
            return {
                ...TEST_USER,
            };
        },


        async login() {
            return {
                token:
                    "token-teste",

                tokenType:
                    "Bearer",

                expiresIn:
                    3600,

                user: {
                    ...TEST_USER,
                },
            };
        },


        async logout() {
            return undefined;
        },
    };
}


function createRegistrationRequestService() {
    return {
        async createRequest(
            input
        ) {
            return {
                request_id:
                    "11111111-1111-4111-8111-111111111111",

                name:
                    input.name,

                email:
                    input.email,

                status:
                    "PENDING",
            };
        },
    };
}


function createHealthService() {
    return {
        async check() {
            return {
                status:
                    "ok",

                services: {
                    postgres:
                        "up",

                    mongodb:
                        "up",
                },
            };
        },
    };
}


function listen(
    app
) {
    return new Promise(
        resolve => {
            const server =
                app.listen(
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
        }
    );
}


function close(
    server
) {
    return new Promise(
        resolve =>
            server.close(
                resolve
            )
    );
}


test(
    "BE-12 PRIVACY: login utiliza Cache-Control no-store",

    async () => {
        const app =
            createApp({
                authService:
                    createAuthService(),
            });


        const {
            server,
            baseUrl,
        } =
            await listen(
                app
            );


        try {
            const response =
                await fetch(
                    `${baseUrl}/api/v1/auth/login`,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify({
                                email:
                                    "usuario@corp.local",

                                password:
                                    "Senha123",
                            }),
                    }
                );


            assert.equal(
                response
                    .headers
                    .get(
                        "cache-control"
                    ),

                "no-store"
            );

        } finally {
            await close(
                server
            );
        }
    }
);


test(
    "BE-12 PRIVACY: rota autenticada utiliza Cache-Control no-store",

    async () => {
        const app =
            createApp({
                authService:
                    createAuthService(),
            });


        const {
            server,
            baseUrl,
        } =
            await listen(
                app
            );


        try {
            const response =
                await fetch(
                    `${baseUrl}/api/v1/auth/me`,
                    {
                        headers: {
                            Authorization:
                                "Bearer token-teste",
                        },
                    }
                );


            assert.equal(
                response.status,
                200
            );


            assert.equal(
                response
                    .headers
                    .get(
                        "cache-control"
                    ),

                "no-store"
            );

        } finally {
            await close(
                server
            );
        }
    }
);


test(
    "BE-12 PRIVACY: solicitação pública de cadastro não é armazenável",

    async () => {
        const app =
            createApp({
                registrationRequestService:
                    createRegistrationRequestService(),
            });


        const {
            server,
            baseUrl,
        } =
            await listen(
                app
            );


        try {
            const response =
                await fetch(
                    `${baseUrl}/api/v1/registration-requests`,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify({
                                name:
                                    "Pessoa Teste",

                                email:
                                    "pessoa@corp.local",
                            }),
                    }
                );


            assert.equal(
                response.status,
                201
            );


            assert.equal(
                response
                    .headers
                    .get(
                        "cache-control"
                    ),

                "no-store"
            );

        } finally {
            await close(
                server
            );
        }
    }
);


test(
    "BE-12 PRIVACY: health não recebe política privada de cache",

    async () => {
        const app =
            createApp({
                healthService:
                    createHealthService(),
            });


        const {
            server,
            baseUrl,
        } =
            await listen(
                app
            );


        try {
            const response =
                await fetch(
                    `${baseUrl}/api/v1/health`
                );


            assert.equal(
                response
                    .headers
                    .get(
                        "cache-control"
                    ),

                null
            );

        } finally {
            await close(
                server
            );
        }
    }
);


const PROTECTED_ROUTES = [
    "/api/v1/auth/me",
    "/api/v1/admin/users",
    "/api/v1/admin/registration-requests",
    "/api/v1/dashboard",
    "/api/v1/conversations",
    "/api/v1/conversations/507f1f77bcf86cd799439011/messages",
    "/api/v1/groups/507f1f77bcf86cd799439011",
];

for (const route of PROTECTED_ROUTES) {
    test(
        `BE-12 PRIVACY: resposta 401 utiliza no-store em ${route}`,
        async () => {
            const app = createApp();

            const {
                server,
                baseUrl,
            } = await listen(app);

            try {
                const response = await fetch(
                    `${baseUrl}${route}`
                );

                assert.equal(
                    response.status,
                    401
                );

                assert.equal(
                    response.headers.get("cache-control"),
                    "no-store"
                );
            } finally {
                await close(server);
            }
        }
    );
}

test(
    "BE-12 PRIVACY: acesso administrativo negado utiliza no-store",
    async () => {
        const app = createApp({
            authService: createAuthService(),
        });

        const {
            server,
            baseUrl,
        } = await listen(app);

        try {
            const response = await fetch(
                `${baseUrl}/api/v1/admin/users`,
                {
                    headers: {
                        Authorization:
                            "Bearer token-teste",
                    },
                }
            );

            assert.equal(
                response.status,
                403
            );

            assert.equal(
                response.headers.get("cache-control"),
                "no-store"
            );
        } finally {
            await close(server);
        }
    }
);

test(
    "BE-12 PRIVACY: envio de mensagem sem autenticação utiliza no-store",
    async () => {
        const app = createApp();

        const {
            server,
            baseUrl,
        } = await listen(app);

        try {
            const conversationId =
                "507f1f77bcf86cd799439011";

            const response = await fetch(
                `${baseUrl}/api/v1/conversations/${conversationId}/messages`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        content: "Mensagem de teste",
                        clientMessageId: "teste-cache",
                    }),
                }
            );

            assert.equal(
                response.status,
                401
            );

            assert.equal(
                response.headers.get("cache-control"),
                "no-store"
            );
        } finally {
            await close(server);
        }
    }
);

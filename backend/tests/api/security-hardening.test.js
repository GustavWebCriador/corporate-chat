process.env.NODE_ENV =
    "test";


const test =
    require(
        "node:test"
    );


const assert =
    require(
        "node:assert/strict"
    );


const AppError =
    require(
        "../../src/errors/AppError"
    );


const {
    createApp,
} = require(
    "../../src/app"
);


/*
 * =====================================================
 * SERVER HELPERS
 * =====================================================
 */

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

function createRegistrationRequestServiceMock() {
    const calls = [];


    return {
        calls,


        async createRequest(
            input
        ) {
            calls.push(
                input
            );


            return {
                request_id:
                    `request-${calls.length}`,

                name:
                    input.name,

                email:
                    input.email,

                status:
                    "PENDING",

                reviewed_by:
                    null,

                reviewed_at:
                    null,

                rejection_reason:
                    null,
            };
        },
    };
}

async function registrationAttempt(
    baseUrl,
    attempt
) {
    return fetch(
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
                        `Pessoa ${attempt}`,

                    email:
                        `pessoa${attempt}@corp.local`,
                }),
        }
    );
}

/*
 * =====================================================
 * AUTH MOCK
 * =====================================================
 */

function createRejectingAuthService() {
    return {
        async login() {
            throw AppError
                .unauthorized(
                    "E-mail ou senha inválidos.",
                    "INVALID_CREDENTIALS"
                );
        },


        async authenticateToken() {
            throw new Error(
                "authenticateToken não esperado."
            );
        },


        async logout() {
            throw new Error(
                "logout não esperado."
            );
        },
    };
}


/*
 * =====================================================
 * HTTP
 * =====================================================
 */

async function loginAttempt(
    baseUrl
) {
    return fetch(
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
                        "user@corp.local",

                    password:
                        "SenhaErrada123",
                }),
        }
    );
}


/*
 * =====================================================
 * RATE LIMIT TEST
 * =====================================================
 */

test(
    "BE-12 SECURITY: login bloqueia tentativas repetidas por IP",

    async () => {
        const app =
            createApp({
                authService:
                    createRejectingAuthService(),
            });


        const {
            server,
            baseUrl,
        } =
            await listen(
                app
            );


        try {
            /*
             * As dez primeiras tentativas
             * chegam ao authService.
             */
            for (
                let attempt = 1;
                attempt <= 10;
                attempt += 1
            ) {
                const response =
                    await loginAttempt(
                        baseUrl
                    );


                assert.equal(
                    response.status,
                    401
                );


                const body =
                    await response.json();


                assert.equal(
                    body
                        .error
                        .code,
                    "INVALID_CREDENTIALS"
                );
            }


            /*
             * A próxima tentativa deve ser
             * bloqueada antes do controller.
             */
            const blocked =
                await loginAttempt(
                    baseUrl
                );


            assert.equal(
                blocked.status,
                429
            );


            const body =
                await blocked.json();


            assert.deepEqual(
                body,
                {
                    error: {
                        code:
                            "RATE_LIMITED",

                        message:
                            "Muitas tentativas. Tente novamente mais tarde.",
                    },
                }
            );


            /*
             * Header padronizado atual.
             */
            assert.ok(
                blocked
                    .headers
                    .get(
                        "ratelimit"
                    )
            );


            /*
             * Não utilizamos headers antigos.
             */
            assert.equal(
                blocked
                    .headers
                    .get(
                        "x-ratelimit-limit"
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

test(
    "BE-12 SECURITY: solicitação pública de cadastro bloqueia spam por IP",

    async () => {
        const registrationRequestService =
            createRegistrationRequestServiceMock();


        const app =
            createApp({
                authService:
                    createRejectingAuthService(),

                registrationRequestService,
            });


        const {
            server,
            baseUrl,
        } =
            await listen(
                app
            );


        try {
            /*
             * As cinco primeiras solicitações
             * são aceitas.
             */
            for (
                let attempt = 1;
                attempt <= 5;
                attempt += 1
            ) {
                const response =
                    await registrationAttempt(
                        baseUrl,
                        attempt
                    );


                assert.equal(
                    response.status,
                    201
                );
            }


            /*
             * A sexta tentativa deve ser
             * bloqueada antes do service.
             */
            const blocked =
                await registrationAttempt(
                    baseUrl,
                    6
                );


            assert.equal(
                blocked.status,
                429
            );


            const body =
                await blocked.json();


            assert.deepEqual(
                body,
                {
                    error: {
                        code:
                            "RATE_LIMITED",

                        message:
                            "Muitas solicitações. Tente novamente mais tarde.",
                    },
                }
            );


            /*
             * O service somente pode ter
             * recebido as cinco requisições
             * permitidas.
             */
            assert.equal(
                registrationRequestService
                    .calls
                    .length,
                5
            );


            /*
             * Header padronizado.
             */
            assert.ok(
                blocked
                    .headers
                    .get(
                        "ratelimit"
                    )
            );


            /*
             * Headers legados permanecem
             * desabilitados.
             */
            assert.equal(
                blocked
                    .headers
                    .get(
                        "x-ratelimit-limit"
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
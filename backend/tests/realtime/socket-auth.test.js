process.env.NODE_ENV =
    "test";

const test =
    require("node:test");

const assert =
    require("node:assert/strict");

const {
    createServer,
} = require(
    "node:http"
);

const {
    io: createClient,
} = require(
    "socket.io-client"
);

const AppError =
    require(
        "../../src/errors/AppError"
    );

const {
    createSocketServer,
} = require(
    "../../src/realtime/socketServer"
);


/*
 * =====================================================
 * CONSTANTES
 * =====================================================
 */

const USER_ID =
    "22222222-2222-4222-8222-222222222222";

const OTHER_USER_ID =
    "33333333-3333-4333-8333-333333333333";


const AUTHENTICATED_USER = {
    user_id:
        USER_ID,

    name:
        "Usuário Socket",

    email:
        "socket@corp.local",

    status:
        "ACTIVE",

    is_admin:
        false,
};


/*
 * =====================================================
 * AUTH SERVICE DE TESTE
 * =====================================================
 */

function createTestAuthService() {
    const calls = [];


    return {
        calls,


        async authenticateToken(
            token
        ) {
            calls.push(
                token
            );


            switch (token) {

                case "token-valido":
                    return {
                        ...AUTHENTICATED_USER,
                    };


                case "token-invalido":
                    throw AppError
                        .unauthorized(
                            "Token inválido.",
                            "TOKEN_INVALID"
                        );


                case "token-expirado":
                    throw AppError
                        .unauthorized(
                            "Token expirado.",
                            "TOKEN_EXPIRED"
                        );


                case "token-revogado":
                    throw AppError
                        .unauthorized(
                            "Sessão encerrada.",
                            "TOKEN_REVOKED"
                        );


                case "usuario-inativo":
                    throw AppError
                        .forbidden(
                            "Usuário inativo.",
                            "USER_INACTIVE"
                        );


                case "erro-interno":
                    throw new Error(
                        "segredo-interno-do-servidor"
                    );

                case "erro-operacional-nao-permitido":
                    throw AppError
                        .badRequest(
                            "Detalhe interno que não pertence ao contrato realtime.",
                            "INTERNAL_BUSINESS_CODE"
                        );


                default:
                    throw AppError
                        .unauthorized(
                            "Token inválido.",
                            "TOKEN_INVALID"
                        );
            }
        },
    };
}


/*
 * =====================================================
 * SERVIDOR DE TESTE
 * =====================================================
 */

async function createRealtimeServer() {
    const authService =
        createTestAuthService();


    const httpServer =
        createServer();


    const io =
        createSocketServer(
            httpServer,
            {
                authService,
            }
        );


    await new Promise(
        (
            resolve,
            reject
        ) => {

            httpServer.once(
                "error",
                reject
            );


            httpServer.listen(
                0,
                "127.0.0.1",
                () => {

                    httpServer.off(
                        "error",
                        reject
                    );

                    resolve();
                }
            );
        }
    );


    const address =
        httpServer.address();


    return {
        authService,
        httpServer,
        io,

        url:
            `http://127.0.0.1:${address.port}`,
    };
}


/*
 * =====================================================
 * CLIENTE DE TESTE
 * =====================================================
 */

function createTestClient(
    url,
    auth = {}
) {
    return createClient(
        url,
        {
            autoConnect:
                false,

            forceNew:
                true,

            reconnection:
                false,

            timeout:
                2000,

            transports: [
                "websocket",
            ],

            auth,
        }
    );
}


function waitForConnect(
    client
) {
    return new Promise(
        (
            resolve,
            reject
        ) => {

            client.once(
                "connect",
                resolve
            );


            client.once(
                "connect_error",
                reject
            );


            client.connect();
        }
    );
}


function waitForConnectError(
    client
) {
    return new Promise(
        (
            resolve,
            reject
        ) => {

            client.once(
                "connect_error",
                resolve
            );


            client.once(
                "connect",
                () => {
                    reject(
                        new Error(
                            "A conexão deveria ter sido rejeitada."
                        )
                    );
                }
            );


            client.connect();
        }
    );
}


/*
 * =====================================================
 * CLEANUP
 * =====================================================
 */

async function closeRealtime({
    client,
    io,
    httpServer,
}) {
    if (client) {
        client.removeAllListeners();
        client.disconnect();
    }


    if (io) {
        await new Promise(
            resolve => {

                io.close(
                    () =>
                        resolve()
                );
            }
        );
    }


    if (
        httpServer &&
        httpServer.listening
    ) {
        await new Promise(
            (
                resolve,
                reject
            ) => {

                httpServer.close(
                    error => {

                        if (
                            error &&
                            error.code !==
                                "ERR_SERVER_NOT_RUNNING"
                        ) {
                            reject(
                                error
                            );

                            return;
                        }


                        resolve();
                    }
                );
            }
        );
    }
}


/*
 * =====================================================
 * CONEXÃO AUTENTICADA
 * =====================================================
 */

test(
    "BE-10 SOCKET: usuário autenticado consegue estabelecer conexão",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                {
                    token:
                        "token-valido",
                }
            );


        try {
            await waitForConnect(
                client
            );


            assert.equal(
                client.connected,
                true
            );


            assert.deepEqual(
                context
                    .authService
                    .calls,

                [
                    "token-valido",
                ]
            );

        } finally {
            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);


test(
    "BE-10 SOCKET SECURITY: identidade autenticada é armazenada em socket.data.user",

    async () => {
        const context =
            await createRealtimeServer();


        const serverUserPromise =
            new Promise(
                resolve => {

                    context.io.once(
                        "connection",
                        socket => {

                            resolve(
                                socket
                                    .data
                                    .user
                            );
                        }
                    );
                }
            );


        const client =
            createTestClient(
                context.url,
                {
                    token:
                        "token-valido",
                }
            );


        try {
            await waitForConnect(
                client
            );


            const serverUser =
                await serverUserPromise;


            assert.equal(
                serverUser.user_id,
                USER_ID
            );


            assert.equal(
                serverUser.email,
                "socket@corp.local"
            );


            assert.equal(
                serverUser.status,
                "ACTIVE"
            );

        } finally {
            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);


/*
 * =====================================================
 * TOKEN AUSENTE
 * =====================================================
 */

test(
    "BE-10 SOCKET SECURITY: conexão sem token retorna TOKEN_MISSING",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url
            );


        try {
            const error =
                await waitForConnectError(
                    client
                );


            assert.equal(
                error.message,
                "Não foi possível autenticar a conexão."
            );


            assert.equal(
                error.data.code,
                "TOKEN_MISSING"
            );


            assert.equal(
                context
                    .authService
                    .calls
                    .length,

                0
            );

        } finally {
            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);


/*
 * =====================================================
 * TOKEN INVÁLIDO
 * =====================================================
 */

test(
    "BE-10 SOCKET SECURITY: token inválido é rejeitado",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                {
                    token:
                        "token-invalido",
                }
            );


        try {
            const error =
                await waitForConnectError(
                    client
                );


            assert.equal(
                error.data.code,
                "TOKEN_INVALID"
            );


            assert.deepEqual(
                context
                    .authService
                    .calls,

                [
                    "token-invalido",
                ]
            );

        } finally {
            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);


/*
 * =====================================================
 * TOKEN EXPIRADO
 * =====================================================
 */

test(
    "BE-10 SOCKET SECURITY: token expirado é rejeitado",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                {
                    token:
                        "token-expirado",
                }
            );


        try {
            const error =
                await waitForConnectError(
                    client
                );


            assert.equal(
                error.data.code,
                "TOKEN_EXPIRED"
            );

        } finally {
            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);


/*
 * =====================================================
 * SESSÃO REVOGADA
 * =====================================================
 */

test(
    "BE-10 SOCKET SECURITY: sessão revogada é rejeitada",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                {
                    token:
                        "token-revogado",
                }
            );


        try {
            const error =
                await waitForConnectError(
                    client
                );


            assert.equal(
                error.data.code,
                "TOKEN_REVOKED"
            );

        } finally {
            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);


/*
 * =====================================================
 * USUÁRIO INATIVO
 * =====================================================
 */

test(
    "BE-10 SOCKET SECURITY: usuário INACTIVE não estabelece conexão",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                {
                    token:
                        "usuario-inativo",
                }
            );


        try {
            const error =
                await waitForConnectError(
                    client
                );


            assert.equal(
                error.data.code,
                "USER_INACTIVE"
            );

        } finally {
            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);


/*
 * =====================================================
 * IDENTIDADE NÃO CONFIÁVEL DO CLIENTE
 * =====================================================
 */

test(
    "BE-10 SOCKET SECURITY: userId enviado pelo cliente não substitui identidade autenticada",

    async () => {
        const context =
            await createRealtimeServer();


        const serverUserPromise =
            new Promise(
                resolve => {

                    context.io.once(
                        "connection",
                        socket => {

                            resolve(
                                socket
                                    .data
                                    .user
                            );
                        }
                    );
                }
            );


        const client =
            createTestClient(
                context.url,
                {
                    token:
                        "token-valido",

                    /*
                     * Tentativa de falsificação.
                     *
                     * O servidor deve ignorar.
                     */
                    userId:
                        OTHER_USER_ID,
                }
            );


        try {
            await waitForConnect(
                client
            );


            const serverUser =
                await serverUserPromise;


            assert.equal(
                serverUser.user_id,
                USER_ID
            );


            assert.notEqual(
                serverUser.user_id,
                OTHER_USER_ID
            );

        } finally {
            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);


/*
 * =====================================================
 * ERRO INTERNO
 * =====================================================
 */

test(
    "BE-10 SOCKET SECURITY: erro inesperado não vaza detalhes internos",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                {
                    token:
                        "erro-interno",
                }
            );


        try {
            const error =
                await waitForConnectError(
                    client
                );


            assert.equal(
                error.data.code,
                "SOCKET_AUTH_ERROR"
            );


            assert.equal(
                error.message,
                "Não foi possível autenticar a conexão."
            );


            assert.equal(
                JSON
                    .stringify(
                        error
                    )
                    .includes(
                        "segredo-interno-do-servidor"
                    ),

                false
            );

        } finally {
            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);

test(
    "BE-10 SOCKET SECURITY: código operacional fora da whitelist não é exposto",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                {
                    token:
                        "erro-operacional-nao-permitido",
                }
            );


        try {
            const error =
                await waitForConnectError(
                    client
                );


            assert.equal(
                error.data.code,
                "SOCKET_AUTH_ERROR"
            );


            assert.equal(
                error.message,
                "Não foi possível autenticar a conexão."
            );


            assert.notEqual(
                error.data.code,
                "INTERNAL_BUSINESS_CODE"
            );

        } finally {
            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);
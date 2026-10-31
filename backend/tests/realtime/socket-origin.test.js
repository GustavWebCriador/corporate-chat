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


const {
    createSocketServer,
} = require(
    "../../src/realtime/socketServer"
);


/*
 * 
 * CONSTANTES
 * 
 */

const USER_ID =
    "22222222-2222-4222-8222-222222222222";


const ALLOWED_ORIGIN =
    "https://app.corp.local";


const BLOCKED_ORIGIN =
    "https://evil.example";


/*
 * 
 * ENV HELPER
 * 
 */

async function withEnv(
    values,
    run
) {
    const previous =
        {};


    for (
        const key of
        Object.keys(
            values
        )
    ) {
        previous[key] = {
            exists:
                Object
                    .prototype
                    .hasOwnProperty
                    .call(
                        process.env,
                        key
                    ),

            value:
                process.env[
                    key
                ],
        };


        if (
            values[key] ===
            undefined
        ) {
            delete process
                .env[key];

        } else {
            process.env[
                key
            ] =
                values[key];
        }
    }


    try {
        return await run();

    } finally {
        for (
            const key of
            Object.keys(
                values
            )
        ) {
            if (
                previous[key]
                    .exists
            ) {
                process.env[
                    key
                ] =
                    previous[key]
                        .value;

            } else {
                delete process
                    .env[key];
            }
        }
    }
}


/*
 * 
 * AUTH SERVICE
 * 
 */

function createAuthService() {
    const calls =
        [];


    return {
        calls,


        async authenticateToken(
            token
        ) {
            calls.push(
                token
            );


            if (
                token !==
                "token-valido"
            ) {
                throw new Error(
                    "Token inesperado no teste."
                );
            }


            return {
                user_id:
                    USER_ID,

                name:
                    "Usuário Teste",

                email:
                    "usuario@corp.local",

                status:
                    "ACTIVE",

                is_admin:
                    false,
            };
        },
    };
}


/*
 * 
 * SERVER
 * 
 */

async function createRealtimeServer() {
    const authService =
        createAuthService();


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


    return {
        authService,
        httpServer,
        io,

        url:
            `http://127.0.0.1:${httpServer.address().port}`,
    };
}


/*
 * 
 * CLIENT
 * 
 */

function createTestClient(
    url,
    origin
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

            auth: {
                token:
                    "token-valido",
            },

            /*
             * socket.io-client executado no Node.js
             * permite informar headers adicionais.
             *
             * Assim conseguimos simular a Origin
             * enviada por um navegador.
             */
            extraHeaders: {
                Origin:
                    origin,
            },
        }
    );
}


/*
 * 
 * CONNECTION HELPERS
 * 
 */

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
                            "A conexão deveria ter sido rejeitada pela Origin."
                        )
                    );
                }
            );


            client.connect();
        }
    );
}


/*
 * 
 * CLEANUP
 * 
 */

async function closeRealtime({
    client,
    io,
    httpServer,
}) {
    if (
        client
    ) {
        client.disconnect();
    }


    await new Promise(
        resolve =>
            io.close(
                resolve
            )
    );


    if (
        httpServer.listening
    ) {
        await new Promise(
            resolve =>
                httpServer.close(
                    resolve
                )
        );
    }
}


/*
 * 
 * TESTES
 * 
 */

test(
    "BE-12 SOCKET ORIGIN: origem permitida alcança autenticação",

    async () => {
        await withEnv(
            {
                NODE_ENV:
                    "test",

                CORS_ORIGIN:
                    ALLOWED_ORIGIN,
            },

            async () => {
                const context =
                    await createRealtimeServer();


                const client =
                    createTestClient(
                        context.url,
                        ALLOWED_ORIGIN
                    );


                try {
                    await waitForConnect(
                        client
                    );


                    assert.equal(
                        client.connected,
                        true
                    );


                    /*
                     * Depois que a Origin é aceita,
                     * o JWT continua sendo validado.
                     */
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
    }
);


test(
    "BE-12 SOCKET ORIGIN: origem não autorizada é rejeitada antes da autenticação",

    async () => {
        await withEnv(
            {
                NODE_ENV:
                    "test",

                CORS_ORIGIN:
                    ALLOWED_ORIGIN,
            },

            async () => {
                const context =
                    await createRealtimeServer();


                const client =
                    createTestClient(
                        context.url,
                        BLOCKED_ORIGIN
                    );


                try {
                    const error =
                        await waitForConnectError(
                            client
                        );


                    assert.ok(
                        error
                    );


                    assert.equal(
                        client.connected,
                        false
                    );


                    /*
                     * A conexão deve morrer no
                     * allowRequest.
                     *
                     * Portanto nem chega ao
                     * middleware JWT.
                     */
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
    }
);
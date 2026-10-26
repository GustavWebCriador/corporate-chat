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

const {
    createConnectionRegistry,
} = require(
    "../../src/realtime/connectionRegistry"
);

const {
    REALTIME_EVENTS,
} = require(
    "../../src/realtime/events"
);


/*
 * =====================================================
 * CONSTANTES
 * =====================================================
 */

const USER_ID =
    "22222222-2222-4222-8222-222222222222";

const CONVERSATION_ID =
    "507f1f77bcf86cd799439011";

const MESSAGE_ID =
    "607f1f77bcf86cd799439011";


/*
 * =====================================================
 * AUTH
 * =====================================================
 */

function createAuthService() {
    const calls = [];


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
                "token-user-a"
            ) {
                throw AppError
                    .unauthorized(
                        "Token inválido.",
                        "TOKEN_INVALID"
                    );
            }


            return {
                user_id:
                    USER_ID,

                name:
                    "Usuário A",

                email:
                    "a@test.local",

                status:
                    "ACTIVE",

                is_admin:
                    false,
            };
        },
    };
}


/*
 * =====================================================
 * SERVICES AUXILIARES
 * =====================================================
 */

function createMessageServiceMock() {
    return {
        async sendMessage() {
            throw new Error(
                "sendMessage não esperado."
            );
        },

        async markDelivered() {
            throw new Error(
                "markDelivered não esperado."
            );
        },

        async markRead() {
            throw new Error(
                "markRead não esperado."
            );
        },
    };
}


function createAudienceServiceMock() {
    return {
        async getActiveUserIds() {
            return [
                USER_ID,
            ];
        },
    };
}


function createSyncServiceMock() {
    const calls = [];


    return {
        calls,


        async syncConversation(
            params
        ) {
            calls.push(
                params
            );


            return {
                mode:
                    "incremental",

                items: [],

                hasMore:
                    false,

                nextAfterMessageId:
                    params
                        .afterMessageId ??
                    null,
            };
        },
    };
}


/*
 * =====================================================
 * SERVER
 * =====================================================
 */

async function createRealtimeServer() {
    const httpServer =
        createServer();


    const authService =
        createAuthService();

    const connectionRegistry =
        createConnectionRegistry();

    const syncService =
        createSyncServiceMock();


    const io =
        createSocketServer(
            httpServer,
            {
                authService,

                connectionRegistry,

                messageService:
                    createMessageServiceMock(),

                audienceService:
                    createAudienceServiceMock(),

                syncService,
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
        httpServer,
        io,
        authService,
        connectionRegistry,
        syncService,

        url:
            `http://127.0.0.1:${httpServer.address().port}`,
    };
}


/*
 * =====================================================
 * CLIENT
 * =====================================================
 */

function createTestClient(
    url
) {
    return createClient(
        url,
        {
            autoConnect:
                false,

            forceNew:
                true,

            reconnection:
                true,

            reconnectionAttempts:
                5,

            reconnectionDelay:
                20,

            reconnectionDelayMax:
                50,

            randomizationFactor:
                0,

            timeout:
                1000,

            transports: [
                "websocket",
            ],

            auth: {
                token:
                    "token-user-a",
            },
        }
    );
}


function connectClient(
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


/*
 * Evita teste pendurado indefinidamente.
 */
function waitForEvent(
    emitter,
    eventName,
    timeout =
        3000
) {
    return new Promise(
        (
            resolve,
            reject
        ) => {

            const timer =
                setTimeout(
                    () => {

                        emitter.off(
                            eventName,
                            handler
                        );


                        reject(
                            new Error(
                                `Timeout aguardando evento ${eventName}.`
                            )
                        );
                    },
                    timeout
                );


            function handler(
                ...args
            ) {
                clearTimeout(
                    timer
                );


                emitter.off(
                    eventName,
                    handler
                );


                resolve(
                    args.length <= 1
                        ? args[0]
                        : args
                );
            }


            emitter.on(
                eventName,
                handler
            );
        }
    );
}


/*
 * =====================================================
 * CLEANUP
 * =====================================================
 */

async function closeRealtime(
    context,
    client
) {
    if (client) {
        client.removeAllListeners();
        client.io.removeAllListeners();
        client.disconnect();
    }


    await new Promise(
        resolve => {

            context.io.close(
                () =>
                    resolve()
            );
        }
    );


    if (
        context
            .httpServer
            .listening
    ) {
        await new Promise(
            (
                resolve,
                reject
            ) => {

                context
                    .httpServer
                    .close(
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

test(
    "BE-11 RECONNECTION: queda de transporte provoca reconexão automática e nova autenticação",

    async () => {
        const context =
            await createRealtimeServer();

        const client =
            createTestClient(
                context.url
            );


        try {
            await connectClient(
                client
            );


            assert.equal(
                client.connected,
                true
            );


            assert.equal(
                context
                    .connectionRegistry
                    .isUserOnline(
                        USER_ID
                    ),
                true
            );


            assert.equal(
                context
                    .connectionRegistry
                    .getConnectionCount(
                        USER_ID
                    ),
                1
            );


            /*
             * Registramos todos os listeners
             * ANTES de interromper o transporte.
             */
            const disconnectPromise =
                waitForEvent(
                    client,
                    "disconnect"
                );


            const reconnectAttemptPromise =
                waitForEvent(
                    client.io,
                    "reconnect_attempt"
                );


            const reconnectPromise =
                waitForEvent(
                    client,
                    "connect"
                );


            const readyPromise =
                waitForReadyAfterDisconnect(
                    client
                );

            /*
             * Simula falha do transporte.
             *
             * NÃO utilizar client.disconnect(),
             * pois aquilo representa uma
             * desconexão voluntária.
             */
            client
                .io
                .engine
                .close();


            await disconnectPromise;

            await reconnectAttemptPromise;

            await reconnectPromise;

            const ready =
                await readyPromise;


            assert.equal(
                client.connected,
                true
            );


            /*
             * skipMiddlewares=false:
             *
             * o middleware de autenticação
             * deve executar novamente.
             */
            assert.ok(
                context
                    .authService
                    .calls
                    .length >= 2
            );


            assert.equal(
                context
                    .connectionRegistry
                    .isUserOnline(
                        USER_ID
                    ),
                true
            );


            assert.equal(
                context
                    .connectionRegistry
                    .getConnectionCount(
                        USER_ID
                    ),
                1
            );


            assert.equal(
                typeof ready.recovered,
                "boolean"
            );

        } finally {
            await closeRealtime(
                context,
                client
            );
        }
    }
);

test(
    "BE-11 RECONNECTION: após reconectar o cliente continua utilizando realtime:sync",

    async () => {
        const context =
            await createRealtimeServer();

        const client =
            createTestClient(
                context.url
            );


        try {
            await connectClient(
                client
            );


            const reconnectPromise =
                waitForEvent(
                    client,
                    "connect"
                );


            client
                .io
                .engine
                .close();


            await reconnectPromise;


            const ack =
                await client
                    .timeout(
                        2000
                    )
                    .emitWithAck(
                        REALTIME_EVENTS
                            .SYNC,

                        {
                            conversationId:
                                CONVERSATION_ID,

                            afterMessageId:
                                MESSAGE_ID,

                            limit:
                                50,
                        }
                    );


            assert.equal(
                ack.ok,
                true
            );


            assert.equal(
                ack.data.mode,
                "incremental"
            );


            assert.equal(
                context
                    .syncService
                    .calls
                    .length,
                1
            );


            assert.deepEqual(
                context
                    .syncService
                    .calls[0],

                {
                    conversationId:
                        CONVERSATION_ID,

                    userId:
                        USER_ID,

                    afterMessageId:
                        MESSAGE_ID,

                    limit:
                        50,
                }
            );

        } finally {
            await closeRealtime(
                context,
                client
            );
        }
    }
);

function waitForReadyAfterDisconnect(
    client,
    timeout =
        3000
) {
    return new Promise(
        (
            resolve,
            reject
        ) => {

            let disconnected =
                false;


            const timer =
                setTimeout(
                    () => {

                        cleanup();


                        reject(
                            new Error(
                                "Timeout aguardando realtime:ready após reconexão."
                            )
                        );
                    },
                    timeout
                );


            function cleanup() {
                clearTimeout(
                    timer
                );


                client.off(
                    "disconnect",
                    onDisconnect
                );


                client.off(
                    REALTIME_EVENTS.READY,
                    onReady
                );
            }


            function onDisconnect() {
                /*
                 * A partir daqui qualquer READY
                 * pertence a uma conexão posterior
                 * à queda.
                 */
                disconnected =
                    true;
            }


            function onReady(
                payload
            ) {
                /*
                 * Ignora eventual READY atrasado
                 * da conexão inicial.
                 */
                if (!disconnected) {
                    return;
                }


                cleanup();


                resolve(
                    payload
                );
            }


            client.on(
                "disconnect",
                onDisconnect
            );


            client.on(
                REALTIME_EVENTS.READY,
                onReady
            );
        }
    );
}
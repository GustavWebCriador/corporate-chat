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
    REALTIME_EVENTS,
} = require(
    "../../src/realtime/events"
);


/*
 * =====================================================
 * CONSTANTES
 * =====================================================
 */

const USER_A_ID =
    "22222222-2222-4222-8222-222222222222";

const FORGED_USER_ID =
    "44444444-4444-4444-8444-444444444444";

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
    return {
        async authenticateToken(
            token
        ) {
            if (
                token ===
                "token-user-a"
            ) {
                return {
                    user_id:
                        USER_A_ID,

                    name:
                        "Usuário A",

                    email:
                        "a@test.local",

                    status:
                        "ACTIVE",

                    is_admin:
                        false,
                };
            }


            throw AppError
                .unauthorized(
                    "Token inválido.",
                    "TOKEN_INVALID"
                );
        },
    };
}


/*
 * =====================================================
 * MESSAGE SERVICE
 * =====================================================
 *
 * O socketServer exige messageService,
 * mesmo que este teste seja somente de sync.
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


/*
 * =====================================================
 * AUDIENCE SERVICE
 * =====================================================
 */

function createAudienceServiceMock() {
    return {
        async getActiveUserIds() {
            return [];
        },
    };
}


/*
 * =====================================================
 * SYNC SERVICE
 * =====================================================
 */

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
                        .afterMessageId,
            };
        },
    };
}


/*
 * =====================================================
 * SERVIDOR
 * =====================================================
 */

async function createRealtimeServer({
    syncService =
        createSyncServiceMock(),
} = {}) {
    const httpServer =
        createServer();


    const io =
        createSocketServer(
            httpServer,
            {
                authService:
                    createAuthService(),

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
        syncService,

        url:
            `http://127.0.0.1:${httpServer.address().port}`,
    };
}


/*
 * =====================================================
 * CLIENTE
 * =====================================================
 */

function createTestClient(
    url,
    token
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
                token,
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
 * =====================================================
 * CLEANUP
 * =====================================================
 */

async function closeRealtime(
    context,
    clients = []
) {
    for (
        const client of
        clients
    ) {
        client.removeAllListeners();
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

/*
 * =====================================================
 * SYNC
 * =====================================================
 */

test(
    "BE-11 SYNC: sincronização utiliza identidade autenticada e ignora userId do payload",

    async () => {
        const syncService =
            createSyncServiceMock();


        const context =
            await createRealtimeServer({
                syncService,
            });


        const client =
            createTestClient(
                context.url,
                "token-user-a"
            );


        try {
            await connectClient(
                client
            );


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

                            /*
                             * Tentativa de falsificação.
                             * Deve ser ignorada.
                             */
                            userId:
                                FORGED_USER_ID,
                        }
                    );


            assert.equal(
                ack.ok,
                true
            );


            assert.deepEqual(
                syncService.calls[0],
                {
                    conversationId:
                        CONVERSATION_ID,

                    userId:
                        USER_A_ID,

                    afterMessageId:
                        MESSAGE_ID,

                    limit:
                        50,
                }
            );


            assert.notEqual(
                syncService
                    .calls[0]
                    .userId,

                FORGED_USER_ID
            );


            assert.equal(
                ack.data.mode,
                "incremental"
            );


            assert.equal(
                ack.data.hasMore,
                false
            );


            assert.equal(
                ack.data
                    .nextAfterMessageId,
                MESSAGE_ID
            );

        } finally {
            await closeRealtime(
                context,
                [
                    client,
                ]
            );
        }
    }
);

test(
    "BE-11 SYNC: resultado incremental é retornado pelo ACK",

    async () => {
        const syncService = {
            calls: [],

            async syncConversation(
                params
            ) {
                this.calls.push(
                    params
                );


                return {
                    mode:
                        "incremental",

                    items: [
                        {
                            _id:
                                "707f1f77bcf86cd799439011",

                            conversation_id:
                                CONVERSATION_ID,

                            sender_id:
                                USER_A_ID,

                            client_message_id:
                                "sync-message-001",

                            content:
                                "Mensagem recuperada",

                            created_at:
                                new Date(
                                    "2030-01-01T10:10:00.000Z"
                                ),
                        },
                    ],

                    hasMore:
                        false,

                    nextAfterMessageId:
                        "707f1f77bcf86cd799439011",
                };
            },
        };


        const context =
            await createRealtimeServer({
                syncService,
            });


        const client =
            createTestClient(
                context.url,
                "token-user-a"
            );


        try {
            await connectClient(
                client
            );


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
                ack.data.items.length,
                1
            );


            assert.equal(
                ack.data
                    .items[0]
                    .content,
                "Mensagem recuperada"
            );


            assert.equal(
                ack.data
                    .nextAfterMessageId,
                "707f1f77bcf86cd799439011"
            );

        } finally {
            await closeRealtime(
                context,
                [
                    client,
                ]
            );
        }
    }
);

test(
    "BE-11 SYNC: ausência de afterMessageId permite sincronização por snapshot",

    async () => {
        const syncService = {
            calls: [],

            async syncConversation(
                params
            ) {
                this.calls.push(
                    params
                );


                return {
                    mode:
                        "snapshot",

                    items: [],

                    hasMore:
                        false,

                    nextAfterMessageId:
                        null,
                };
            },
        };


        const context =
            await createRealtimeServer({
                syncService,
            });


        const client =
            createTestClient(
                context.url,
                "token-user-a"
            );


        try {
            await connectClient(
                client
            );


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
                "snapshot"
            );


            assert.deepEqual(
                syncService.calls[0],
                {
                    conversationId:
                        CONVERSATION_ID,

                    userId:
                        USER_A_ID,

                    afterMessageId:
                        null,

                    limit:
                        50,
                }
            );

        } finally {
            await closeRealtime(
                context,
                [
                    client,
                ]
            );
        }
    }
);

test(
    "BE-11 SYNC SECURITY: erro inesperado não expõe detalhes internos",

    async () => {
        const syncService = {
            async syncConversation() {
                throw new Error(
                    "segredo-interno-sync"
                );
            },
        };


        const context =
            await createRealtimeServer({
                syncService,
            });


        const client =
            createTestClient(
                context.url,
                "token-user-a"
            );


        try {
            await connectClient(
                client
            );


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
                false
            );


            assert.equal(
                ack.error.code,
                "INTERNAL_ERROR"
            );


            assert.equal(
                ack.error.message,
                "Erro interno do servidor."
            );


            assert.equal(
                JSON
                    .stringify(
                        ack
                    )
                    .includes(
                        "segredo-interno-sync"
                    ),
                false
            );

        } finally {
            await closeRealtime(
                context,
                [
                    client,
                ]
            );
        }
    }
);
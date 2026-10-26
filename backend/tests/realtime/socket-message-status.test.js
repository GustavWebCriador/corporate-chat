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

const USER_B_ID =
    "33333333-3333-4333-8333-333333333333";

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


            if (
                token ===
                "token-user-b"
            ) {
                return {
                    user_id:
                        USER_B_ID,

                    name:
                        "Usuário B",

                    email:
                        "b@test.local",

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
 */

function createMessageServiceMock() {
    const calls = {
        markDelivered: [],
        markRead: [],
    };


    return {
        calls,


        async sendMessage() {
            throw new Error(
                "sendMessage não esperado neste teste."
            );
        },


        async markDelivered(
            params
        ) {
            calls
                .markDelivered
                .push(
                    params
                );


            return {
                checkpoint: {
                    conversation_id:
                        params
                            .conversationId,

                    user_id:
                        params
                            .userId,

                    last_delivered_message_id:
                        params
                            .messageId,

                    last_delivered_at:
                        new Date(
                            "2030-01-01T10:01:00.000Z"
                        ),

                    last_read_message_id:
                        null,

                    last_read_at:
                        null,
                },

                advanced:
                    true,
            };
        },


        async markRead(
            params
        ) {
            calls
                .markRead
                .push(
                    params
                );


            return {
                checkpoint: {
                    conversation_id:
                        params
                            .conversationId,

                    user_id:
                        params
                            .userId,

                    last_delivered_message_id:
                        params
                            .messageId,

                    last_delivered_at:
                        new Date(
                            "2030-01-01T10:01:00.000Z"
                        ),

                    last_read_message_id:
                        params
                            .messageId,

                    last_read_at:
                        new Date(
                            "2030-01-01T10:02:00.000Z"
                        ),
                },

                advanced:
                    true,

                deliveryAdvanced:
                    true,
            };
        },
    };
}


/*
 * =====================================================
 * AUDIÊNCIA
 * =====================================================
 */

function createAudienceServiceMock() {
    const calls = [];


    return {
        calls,


        async getActiveUserIds(
            conversationId
        ) {
            calls.push(
                conversationId
            );


            return [
                USER_A_ID,
                USER_B_ID,
            ];
        },
    };
}


/*
 * =====================================================
 * SERVIDOR
 * =====================================================
 */

async function createRealtimeServer({
    messageService =
        createMessageServiceMock(),

    audienceService =
        createAudienceServiceMock(),
} = {}) {
    const httpServer =
        createServer();


    const io =
        createSocketServer(
            httpServer,
            {
                authService:
                    createAuthService(),

                messageService,

                audienceService,
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
        messageService,
        audienceService,

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


function waitForEvent(
    client,
    eventName
) {
    return new Promise(
        resolve => {

            client.once(
                eventName,
                resolve
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

test(
    "BE-11 DELIVERY: checkpoint de entrega é propagado aos participantes conectados",

    async () => {
        const context =
            await createRealtimeServer();


        const sender =
            createTestClient(
                context.url,
                "token-user-a"
            );


        const recipient =
            createTestClient(
                context.url,
                "token-user-b"
            );


        try {
            await connectClient(
                sender
            );


            await connectClient(
                recipient
            );


            const senderUpdate =
                waitForEvent(
                    sender,
                    REALTIME_EVENTS
                        .MESSAGE_DELIVERY_UPDATE
                );


            const recipientUpdate =
                waitForEvent(
                    recipient,
                    REALTIME_EVENTS
                        .MESSAGE_DELIVERY_UPDATE
                );


            const ack =
                await recipient
                    .timeout(
                        2000
                    )
                    .emitWithAck(
                        REALTIME_EVENTS
                            .MESSAGE_DELIVERED,

                        {
                            conversationId:
                                CONVERSATION_ID,

                            messageId:
                                MESSAGE_ID,
                        }
                    );


            const [
                updateA,
                updateB,
            ] =
                await Promise.all([
                    senderUpdate,
                    recipientUpdate,
                ]);


            assert.equal(
                ack.ok,
                true
            );


            assert.equal(
                ack.data.advanced,
                true
            );


            assert.equal(
                context
                    .messageService
                    .calls
                    .markDelivered[0]
                    .userId,
                USER_B_ID
            );


            assert.equal(
                updateA
                    .checkpoint
                    .user_id,
                USER_B_ID
            );


            assert.equal(
                updateA
                    .checkpoint
                    .last_delivered_message_id,
                MESSAGE_ID
            );


            assert.equal(
                updateB
                    .checkpoint
                    .last_delivered_message_id,
                MESSAGE_ID
            );

        } finally {
            await closeRealtime(
                context,
                [
                    sender,
                    recipient,
                ]
            );
        }
    }
);
test(
    "BE-11 DELIVERY SECURITY: userId do payload não substitui identidade autenticada",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                "token-user-b"
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
                            .MESSAGE_DELIVERED,

                        {
                            conversationId:
                                CONVERSATION_ID,

                            messageId:
                                MESSAGE_ID,

                            userId:
                                FORGED_USER_ID,
                        }
                    );


            assert.equal(
                ack.ok,
                true
            );


            assert.equal(
                context
                    .messageService
                    .calls
                    .markDelivered[0]
                    .userId,
                USER_B_ID
            );


            assert.notEqual(
                context
                    .messageService
                    .calls
                    .markDelivered[0]
                    .userId,
                FORGED_USER_ID
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
    "BE-11 DELIVERY: checkpoint não avançado ainda redistribui estado autoritativo",

    async () => {
        const messageService =
            createMessageServiceMock();


        messageService
            .markDelivered =
            async params => {

                messageService
                    .calls
                    .markDelivered
                    .push(
                        params
                    );


                return {
                    checkpoint: {
                        conversation_id:
                            CONVERSATION_ID,

                        user_id:
                            USER_B_ID,

                        /*
                         * Simula que o banco já está
                         * em uma mensagem posterior.
                         */
                        last_delivered_message_id:
                            "707f1f77bcf86cd799439011",

                        last_delivered_at:
                            new Date(
                                "2030-01-01T10:05:00.000Z"
                            ),

                        last_read_message_id:
                            null,

                        last_read_at:
                            null,
                    },

                    advanced:
                        false,
                };
            };


        const context =
            await createRealtimeServer({
                messageService,
            });


        const client =
            createTestClient(
                context.url,
                "token-user-b"
            );


        try {
            await connectClient(
                client
            );


            const updatePromise =
                waitForEvent(
                    client,
                    REALTIME_EVENTS
                        .MESSAGE_DELIVERY_UPDATE
                );


            const ack =
                await client
                    .timeout(
                        2000
                    )
                    .emitWithAck(
                        REALTIME_EVENTS
                            .MESSAGE_DELIVERED,

                        {
                            conversationId:
                                CONVERSATION_ID,

                            messageId:
                                MESSAGE_ID,
                        }
                    );


            const update =
                await updatePromise;


            assert.equal(
                ack.ok,
                true
            );


            assert.equal(
                ack.data.advanced,
                false
            );


            assert.equal(
                update.advanced,
                false
            );


            assert.equal(
                update
                    .checkpoint
                    .last_delivered_message_id,
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
    "BE-11 DELIVERY SECURITY: AppError retorna ACK e não propaga checkpoint",

    async () => {
        const messageService =
            createMessageServiceMock();


        messageService
            .markDelivered =
            async () => {

                throw AppError
                    .forbidden(
                        "Usuário não é membro ativo da conversa.",
                        "USER_NOT_ACTIVE_MEMBER"
                    );
            };


        const context =
            await createRealtimeServer({
                messageService,
            });


        const client =
            createTestClient(
                context.url,
                "token-user-b"
            );


        let emitted =
            false;


        try {
            await connectClient(
                client
            );


            client.once(
                REALTIME_EVENTS
                    .MESSAGE_DELIVERY_UPDATE,
                () => {
                    emitted =
                        true;
                }
            );


            const ack =
                await client
                    .timeout(
                        2000
                    )
                    .emitWithAck(
                        REALTIME_EVENTS
                            .MESSAGE_DELIVERED,

                        {
                            conversationId:
                                CONVERSATION_ID,

                            messageId:
                                MESSAGE_ID,
                        }
                    );


            assert.equal(
                ack.ok,
                false
            );


            assert.equal(
                ack.error.code,
                "USER_NOT_ACTIVE_MEMBER"
            );


            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        50
                    )
            );


            assert.equal(
                emitted,
                false
            );


            assert.equal(
                context
                    .audienceService
                    .calls
                    .length,
                0
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
    "BE-11 READ: checkpoint de leitura é propagado aos participantes conectados",

    async () => {
        const context =
            await createRealtimeServer();


        const sender =
            createTestClient(
                context.url,
                "token-user-a"
            );


        const recipient =
            createTestClient(
                context.url,
                "token-user-b"
            );


        try {
            await connectClient(
                sender
            );


            await connectClient(
                recipient
            );


            const senderUpdate =
                waitForEvent(
                    sender,
                    REALTIME_EVENTS
                        .MESSAGE_READ_UPDATE
                );


            const recipientUpdate =
                waitForEvent(
                    recipient,
                    REALTIME_EVENTS
                        .MESSAGE_READ_UPDATE
                );


            const ack =
                await recipient
                    .timeout(
                        2000
                    )
                    .emitWithAck(
                        REALTIME_EVENTS
                            .MESSAGE_READ,

                        {
                            conversationId:
                                CONVERSATION_ID,

                            messageId:
                                MESSAGE_ID,
                        }
                    );


            const [
                updateA,
                updateB,
            ] =
                await Promise.all([
                    senderUpdate,
                    recipientUpdate,
                ]);


            assert.equal(
                ack.ok,
                true
            );


            assert.equal(
                ack.data.advanced,
                true
            );


            assert.equal(
                ack.data.deliveryAdvanced,
                true
            );


            assert.equal(
                context
                    .messageService
                    .calls
                    .markRead[0]
                    .userId,
                USER_B_ID
            );


            assert.equal(
                updateA
                    .checkpoint
                    .user_id,
                USER_B_ID
            );


            assert.equal(
                updateA
                    .checkpoint
                    .last_read_message_id,
                MESSAGE_ID
            );


            assert.equal(
                updateA
                    .checkpoint
                    .last_delivered_message_id,
                MESSAGE_ID
            );


            assert.equal(
                updateB
                    .checkpoint
                    .last_read_message_id,
                MESSAGE_ID
            );

        } finally {
            await closeRealtime(
                context,
                [
                    sender,
                    recipient,
                ]
            );
        }
    }
);
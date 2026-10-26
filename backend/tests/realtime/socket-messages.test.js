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

const CLIENT_MESSAGE_ID =
    "be11-client-message-001";


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
    const calls = [];


    return {
        calls,


        async sendMessage(
            params
        ) {
            calls.push(
                params
            );


            return {
                message: {
                    _id:
                        MESSAGE_ID,

                    conversation_id:
                        CONVERSATION_ID,

                    sender_id:
                        params.senderId,

                    client_message_id:
                        params.clientMessageId,

                    content:
                        params.content,

                    created_at:
                        new Date(
                            "2030-01-01T10:00:00.000Z"
                        ),
                },

                reused:
                    false,
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
 * SERVER
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
 * CLIENT
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


/*
 * =====================================================
 * ENVIO + BROADCAST
 * =====================================================
 */

test(
    "BE-11 SOCKET MESSAGE: mensagem persistida é distribuída aos membros ACTIVE",

    async () => {
        const context =
            await createRealtimeServer();


        const clientA =
            createTestClient(
                context.url,
                "token-user-a"
            );


        const clientB =
            createTestClient(
                context.url,
                "token-user-b"
            );


        try {
            await connectClient(
                clientA
            );


            await connectClient(
                clientB
            );


            const eventA =
                waitForEvent(
                    clientA,
                    REALTIME_EVENTS
                        .MESSAGE_NEW
                );


            const eventB =
                waitForEvent(
                    clientB,
                    REALTIME_EVENTS
                        .MESSAGE_NEW
                );


            const ack =
                await clientA
                    .timeout(
                        2000
                    )
                    .emitWithAck(
                        REALTIME_EVENTS
                            .MESSAGE_SEND,

                        {
                            conversationId:
                                CONVERSATION_ID,

                            clientMessageId:
                                CLIENT_MESSAGE_ID,

                            content:
                                "Mensagem realtime",
                        }
                    );


            const [
                payloadA,
                payloadB,
            ] =
                await Promise.all([
                    eventA,
                    eventB,
                ]);


            assert.equal(
                ack.ok,
                true
            );


            assert.equal(
                ack.data
                    .message
                    ._id,
                MESSAGE_ID
            );


            assert.equal(
                payloadA
                    .message
                    ._id,
                MESSAGE_ID
            );


            assert.equal(
                payloadB
                    .message
                    ._id,
                MESSAGE_ID
            );


            assert.equal(
                context
                    .audienceService
                    .calls[0],
                CONVERSATION_ID
            );

        } finally {
            await closeRealtime(
                context,
                [
                    clientA,
                    clientB,
                ]
            );
        }
    }
);


/*
 * =====================================================
 * IDENTIDADE
 * =====================================================
 */

test(
    "BE-11 SOCKET SECURITY: senderId do payload não substitui usuário autenticado",

    async () => {
        const context =
            await createRealtimeServer();


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
                            .MESSAGE_SEND,

                        {
                            conversationId:
                                CONVERSATION_ID,

                            clientMessageId:
                                CLIENT_MESSAGE_ID,

                            content:
                                "Tentativa",

                            senderId:
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
                    .calls[0]
                    .senderId,
                USER_A_ID
            );


            assert.notEqual(
                context
                    .messageService
                    .calls[0]
                    .senderId,
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


/*
 * =====================================================
 * ERRO OPERACIONAL
 * =====================================================
 */

test(
    "BE-11 SOCKET MESSAGE: AppError retorna ACK seguro e não faz broadcast",

    async () => {
        let emitted =
            false;


        const messageService = {
            async sendMessage() {
                throw AppError
                    .forbidden(
                        "Usuário não é membro ativo da conversa.",
                        "USER_NOT_ACTIVE_MEMBER"
                    );
            },
        };


        const context =
            await createRealtimeServer({
                messageService,
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


            client.once(
                REALTIME_EVENTS
                    .MESSAGE_NEW,
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
                            .MESSAGE_SEND,

                        {
                            conversationId:
                                CONVERSATION_ID,

                            clientMessageId:
                                CLIENT_MESSAGE_ID,

                            content:
                                "Mensagem",
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


/*
 * =====================================================
 * ERRO INTERNO
 * =====================================================
 */

test(
    "BE-11 SOCKET SECURITY: erro inesperado não vaza detalhes internos",

    async () => {
        const messageService = {
            async sendMessage() {
                throw new Error(
                    "segredo-interno-realtime"
                );
            },
        };


        const context =
            await createRealtimeServer({
                messageService,
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
                            .MESSAGE_SEND,

                        {
                            conversationId:
                                CONVERSATION_ID,

                            clientMessageId:
                                CLIENT_MESSAGE_ID,

                            content:
                                "Mensagem",
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
                        "segredo-interno-realtime"
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


/*
 * =====================================================
 * REENVIO IDEMPOTENTE
 * =====================================================
 */

test(
    "BE-11 SOCKET MESSAGE: mensagem reutilizada pode ser redistribuída com o mesmo identificador",

    async () => {
        const messageService =
            createMessageServiceMock();


        messageService
            .sendMessage =
            async params => {

                messageService
                    .calls
                    .push(
                        params
                    );


                return {
                    message: {
                        _id:
                            MESSAGE_ID,

                        conversation_id:
                            CONVERSATION_ID,

                        sender_id:
                            params.senderId,

                        client_message_id:
                            params
                                .clientMessageId,

                        content:
                            params.content,

                        created_at:
                            new Date(
                                "2030-01-01T10:00:00.000Z"
                            ),
                    },

                    reused:
                        true,
                };
            };


        const context =
            await createRealtimeServer({
                messageService,
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


            const eventPromise =
                waitForEvent(
                    client,
                    REALTIME_EVENTS
                        .MESSAGE_NEW
                );


            const ack =
                await client
                    .timeout(
                        2000
                    )
                    .emitWithAck(
                        REALTIME_EVENTS
                            .MESSAGE_SEND,

                        {
                            conversationId:
                                CONVERSATION_ID,

                            clientMessageId:
                                CLIENT_MESSAGE_ID,

                            content:
                                "Retry",
                        }
                    );


            const event =
                await eventPromise;


            assert.equal(
                ack.ok,
                true
            );


            assert.equal(
                ack.data.reused,
                true
            );


            assert.equal(
                event.message._id,
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
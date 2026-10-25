process.env.NODE_ENV = "test";

const test =
    require("node:test");

const assert =
    require("node:assert/strict");

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
 * CONSTANTES
 * =====================================================
 */

const USER_ID =
    "22222222-2222-4222-8222-222222222222";

const OTHER_USER_ID =
    "33333333-3333-4333-8333-333333333333";

const CONVERSATION_ID =
    "507f1f77bcf86cd799439011";

const MESSAGE_ID =
    "607f1f77bcf86cd799439011";

const CLIENT_MESSAGE_ID =
    "client-be09-001";


/*
 * =====================================================
 * SERVIDOR
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
        (
            resolve,
            reject
        ) => {

            server.close(
                error => {

                    if (error) {
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


/*
 * =====================================================
 * API DE TESTE
 * =====================================================
 */

function createTestApi() {

    const calls = {
        sendMessage: [],
        markDelivered: [],
        markRead: [],
    };


    const failures = {
        sendMessage: null,
        markDelivered: null,
        markRead: null,
    };


    /*
     * Autenticação simulada.
     *
     * O controller deve sempre utilizar
     * USER_ID proveniente daqui.
     */
    const authService = {

        async authenticateToken(
            token
        ) {

            if (
                token !==
                "token-de-teste"
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

                status:
                    "ACTIVE",

                is_admin:
                    false,
            };
        },
    };


    /*
     * Mock do service da BE-09.
     *
     * Nesta etapa não testamos MongoDB/PostgreSQL.
     * Isso já foi coberto pelos testes de integração.
     */
    const messageService = {

        async sendMessage(
            params
        ) {

            calls
                .sendMessage
                .push(
                    params
                );


            if (
                failures
                    .sendMessage
            ) {

                throw failures
                    .sendMessage;
            }


            return {
                message: {
                    _id:
                        MESSAGE_ID,

                    conversation_id:
                        params
                            .conversationId,

                    sender_id:
                        params
                            .senderId,

                    client_message_id:
                        params
                            .clientMessageId,

                    content:
                        params
                            .content,

                    created_at:
                        new Date(
                            "2030-01-01T10:00:00.000Z"
                        ),
                },

                reused:
                    false,
            };
        },


        async markDelivered(
            params
        ) {

            calls
                .markDelivered
                .push(
                    params
                );


            if (
                failures
                    .markDelivered
            ) {

                throw failures
                    .markDelivered;
            }


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


            if (
                failures
                    .markRead
            ) {

                throw failures
                    .markRead;
            }


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


    return {
        app:
            createApp({
                authService,
                messageService,
            }),

        calls,

        failures,

        messageService,
    };
}


/*
 * =====================================================
 * HELPERS HTTP
 * =====================================================
 */

function authorizationHeaders() {

    return {
        Authorization:
            "Bearer token-de-teste",
    };
}


function jsonHeaders() {

    return {
        ...authorizationHeaders(),

        "Content-Type":
            "application/json",
    };
}


async function withApi(
    run
) {

    const {
        app,
        calls,
        failures,
        messageService,
    } =
        createTestApi();


    const {
        server,
        baseUrl,
    } =
        await listen(
            app
        );


    try {

        await run({
            baseUrl,
            calls,
            failures,
            messageService,
        });

    } finally {

        await close(
            server
        );
    }
}


function sendMessage(
    baseUrl,
    {
        headers = {},
        body,
    } = {}
) {

    return fetch(
        `${baseUrl}/api/v1/conversations/${CONVERSATION_ID}/messages`,
        {
            method:
                "POST",

            headers: {
                "Content-Type":
                    "application/json",

                ...headers,
            },

            body,
        }
    );
}


function markDelivered(
    baseUrl,
    {
        headers = {},
        body,
    } = {}
) {

    return fetch(
        `${baseUrl}/api/v1/conversations/${CONVERSATION_ID}/delivery`,
        {
            method:
                "PATCH",

            headers: {
                "Content-Type":
                    "application/json",

                ...headers,
            },

            body,
        }
    );
}


function markRead(
    baseUrl,
    {
        headers = {},
        body,
    } = {}
) {

    return fetch(
        `${baseUrl}/api/v1/conversations/${CONVERSATION_ID}/read`,
        {
            method:
                "PATCH",

            headers: {
                "Content-Type":
                    "application/json",

                ...headers,
            },

            body,
        }
    );
}


/*
 * =====================================================
 * ENVIO
 * =====================================================
 */

test(
    "BE-09: enviar mensagem retorna 201",

    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await sendMessage(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    clientMessageId:
                                        CLIENT_MESSAGE_ID,

                                    content:
                                        "Mensagem BE-09",
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    201
                );


                assert.equal(
                    body.data.reused,
                    false
                );


                assert.equal(
                    body
                        .data
                        .message
                        .sender_id,

                    USER_ID
                );


                assert.equal(
                    body
                        .data
                        .message
                        .content,

                    "Mensagem BE-09"
                );


                assert.deepEqual(
                    calls.sendMessage,
                    [
                        {
                            conversationId:
                                CONVERSATION_ID,

                            senderId:
                                USER_ID,

                            clientMessageId:
                                CLIENT_MESSAGE_ID,

                            content:
                                "Mensagem BE-09",
                        },
                    ]
                );
            }
        );
    }
);


test(
    "BE-09: reenvio idempotente retorna 200",

    async () => {

        await withApi(
            async ({
                baseUrl,
                messageService,
            }) => {

                messageService
                    .sendMessage =
                    async params => ({
                        message: {
                            _id:
                                MESSAGE_ID,

                            conversation_id:
                                params
                                    .conversationId,

                            sender_id:
                                params
                                    .senderId,

                            client_message_id:
                                params
                                    .clientMessageId,

                            content:
                                params
                                    .content,

                            created_at:
                                new Date(
                                    "2030-01-01T10:00:00.000Z"
                                ),
                        },

                        reused:
                            true,
                    });


                const response =
                    await sendMessage(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    clientMessageId:
                                        CLIENT_MESSAGE_ID,

                                    content:
                                        "Mensagem BE-09",
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    200
                );


                assert.equal(
                    body.data.reused,
                    true
                );
            }
        );
    }
);


test(
    "BE-09 SECURITY: senderId vem do usuário autenticado",

    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await sendMessage(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    clientMessageId:
                                        CLIENT_MESSAGE_ID,

                                    content:
                                        "Mensagem segura",

                                    /*
                                     * Deve ser ignorado.
                                     */
                                    senderId:
                                        OTHER_USER_ID,
                                }),
                        }
                    );


                assert.equal(
                    response.status,
                    201
                );


                assert.equal(
                    calls
                        .sendMessage[0]
                        .senderId,

                    USER_ID
                );


                assert.notEqual(
                    calls
                        .sendMessage[0]
                        .senderId,

                    OTHER_USER_ID
                );
            }
        );
    }
);


/*
 * =====================================================
 * ENTREGA
 * =====================================================
 */

test(
    "BE-09: marcar mensagem como entregue retorna 200",

    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await markDelivered(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    messageId:
                                        MESSAGE_ID,
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    200
                );


                assert.equal(
                    body.data.advanced,
                    true
                );


                assert.equal(
                    body
                        .data
                        .checkpoint
                        .last_delivered_message_id,

                    MESSAGE_ID
                );


                assert.deepEqual(
                    calls.markDelivered,
                    [
                        {
                            conversationId:
                                CONVERSATION_ID,

                            userId:
                                USER_ID,

                            messageId:
                                MESSAGE_ID,
                        },
                    ]
                );
            }
        );
    }
);


test(
    "BE-09 SECURITY: usuário do ACK de entrega vem da autenticação",

    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await markDelivered(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    messageId:
                                        MESSAGE_ID,

                                    userId:
                                        OTHER_USER_ID,
                                }),
                        }
                    );


                assert.equal(
                    response.status,
                    200
                );


                assert.equal(
                    calls
                        .markDelivered[0]
                        .userId,

                    USER_ID
                );
            }
        );
    }
);


/*
 * =====================================================
 * LEITURA
 * =====================================================
 */

test(
    "BE-09: marcar mensagem como lida retorna 200",

    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await markRead(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    messageId:
                                        MESSAGE_ID,
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    200
                );


                assert.equal(
                    body.data.advanced,
                    true
                );


                assert.equal(
                    body
                        .data
                        .deliveryAdvanced,

                    true
                );


                assert.equal(
                    body
                        .data
                        .checkpoint
                        .last_read_message_id,

                    MESSAGE_ID
                );


                assert.deepEqual(
                    calls.markRead,
                    [
                        {
                            conversationId:
                                CONVERSATION_ID,

                            userId:
                                USER_ID,

                            messageId:
                                MESSAGE_ID,
                        },
                    ]
                );
            }
        );
    }
);


test(
    "BE-09 SECURITY: usuário do ACK de leitura vem da autenticação",

    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await markRead(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    messageId:
                                        MESSAGE_ID,

                                    userId:
                                        OTHER_USER_ID,
                                }),
                        }
                    );


                assert.equal(
                    response.status,
                    200
                );


                assert.equal(
                    calls
                        .markRead[0]
                        .userId,

                    USER_ID
                );
            }
        );
    }
);


/*
 * =====================================================
 * AUTENTICAÇÃO
 * =====================================================
 */

test(
    "BE-09 SECURITY: envio sem autenticação retorna 401 TOKEN_MISSING",

    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await sendMessage(
                        baseUrl,
                        {
                            body:
                                JSON.stringify({
                                    clientMessageId:
                                        CLIENT_MESSAGE_ID,

                                    content:
                                        "Mensagem",
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    401
                );


                assert.equal(
                    body.error.code,
                    "TOKEN_MISSING"
                );


                assert.equal(
                    calls
                        .sendMessage
                        .length,

                    0
                );
            }
        );
    }
);


test(
    "BE-09 SECURITY: token inválido retorna 401 TOKEN_INVALID",

    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await sendMessage(
                        baseUrl,
                        {
                            headers: {
                                Authorization:
                                    "Bearer token-invalido",

                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    clientMessageId:
                                        CLIENT_MESSAGE_ID,

                                    content:
                                        "Mensagem",
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    401
                );


                assert.equal(
                    body.error.code,
                    "TOKEN_INVALID"
                );


                assert.equal(
                    calls
                        .sendMessage
                        .length,

                    0
                );
            }
        );
    }
);


test(
    "BE-09 SECURITY: ACK de entrega sem autenticação retorna 401",

    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await markDelivered(
                        baseUrl,
                        {
                            body:
                                JSON.stringify({
                                    messageId:
                                        MESSAGE_ID,
                                }),
                        }
                    );


                assert.equal(
                    response.status,
                    401
                );


                assert.equal(
                    calls
                        .markDelivered
                        .length,

                    0
                );
            }
        );
    }
);


test(
    "BE-09 SECURITY: ACK de leitura sem autenticação retorna 401",

    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await markRead(
                        baseUrl,
                        {
                            body:
                                JSON.stringify({
                                    messageId:
                                        MESSAGE_ID,
                                }),
                        }
                    );


                assert.equal(
                    response.status,
                    401
                );


                assert.equal(
                    calls
                        .markRead
                        .length,

                    0
                );
            }
        );
    }
);


/*
 * =====================================================
 * VALIDAÇÃO / ERROS OPERACIONAIS
 * =====================================================
 */

test(
    "BE-09: conteúdo inválido retorna 400",

    async () => {

        await withApi(
            async ({
                baseUrl,
                failures,
            }) => {

                failures
                    .sendMessage =
                    AppError.badRequest(
                        "A mensagem não pode estar vazia.",
                        "MESSAGE_CONTENT_REQUIRED"
                    );


                const response =
                    await sendMessage(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    clientMessageId:
                                        CLIENT_MESSAGE_ID,

                                    content:
                                        "",
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    400
                );


                assert.equal(
                    body.error.code,
                    "MESSAGE_CONTENT_REQUIRED"
                );
            }
        );
    }
);


test(
    "BE-09: messageId inválido retorna 400",

    async () => {

        await withApi(
            async ({
                baseUrl,
                failures,
            }) => {

                failures
                    .markDelivered =
                    AppError.badRequest(
                        "messageId inválido.",
                        "INVALID_MESSAGE_ID"
                    );


                const response =
                    await markDelivered(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    messageId:
                                        "invalido",
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    400
                );


                assert.equal(
                    body.error.code,
                    "INVALID_MESSAGE_ID"
                );
            }
        );
    }
);


test(
    "BE-09: usuário sem vínculo ACTIVE retorna 403",

    async () => {

        await withApi(
            async ({
                baseUrl,
                failures,
            }) => {

                failures
                    .markRead =
                    AppError.forbidden(
                        "Usuário não é membro ativo da conversa.",
                        "USER_NOT_ACTIVE_MEMBER"
                    );


                const response =
                    await markRead(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    messageId:
                                        MESSAGE_ID,
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    403
                );


                assert.equal(
                    body.error.code,
                    "USER_NOT_ACTIVE_MEMBER"
                );
            }
        );
    }
);


test(
    "BE-09: mensagem inexistente na conversa retorna 404",

    async () => {

        await withApi(
            async ({
                baseUrl,
                failures,
            }) => {

                failures
                    .markDelivered =
                    AppError.notFound(
                        "Mensagem não encontrada na conversa.",
                        "MESSAGE_NOT_FOUND"
                    );


                const response =
                    await markDelivered(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    messageId:
                                        MESSAGE_ID,
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    404
                );


                assert.equal(
                    body.error.code,
                    "MESSAGE_NOT_FOUND"
                );
            }
        );
    }
);


test(
    "BE-09: clientMessageId reutilizado em outra conversa retorna 409",

    async () => {

        await withApi(
            async ({
                baseUrl,
                failures,
            }) => {

                failures
                    .sendMessage =
                    AppError.conflict(
                        "clientMessageId já utilizado pelo remetente em outra conversa.",
                        "CLIENT_MESSAGE_ID_CONFLICT"
                    );


                const response =
                    await sendMessage(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    clientMessageId:
                                        CLIENT_MESSAGE_ID,

                                    content:
                                        "Mensagem",
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    409
                );


                assert.equal(
                    body.error.code,
                    "CLIENT_MESSAGE_ID_CONFLICT"
                );
            }
        );
    }
);


/*
 * =====================================================
 * JSON / ERRO INTERNO
 * =====================================================
 */

test(
    "BE-09: JSON malformado retorna 400 INVALID_JSON",

    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await sendMessage(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                "{\"content\":",
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    400
                );


                assert.equal(
                    body.error.code,
                    "INVALID_JSON"
                );


                assert.equal(
                    calls
                        .sendMessage
                        .length,

                    0
                );
            }
        );
    }
);


test(
    "BE-09: erro inesperado retorna 500 sem vazar detalhes",

    async () => {

        await withApi(
            async ({
                baseUrl,
                failures,
            }) => {

                failures
                    .sendMessage =
                    new Error(
                        "senha-interna-super-secreta"
                    );


                const response =
                    await sendMessage(
                        baseUrl,
                        {
                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    clientMessageId:
                                        CLIENT_MESSAGE_ID,

                                    content:
                                        "Mensagem",
                                }),
                        }
                    );


                const body =
                    await response
                        .json();


                assert.equal(
                    response.status,
                    500
                );


                assert.equal(
                    body.error.code,
                    "INTERNAL_ERROR"
                );


                assert.equal(
                    JSON
                        .stringify(
                            body
                        )
                        .includes(
                            "senha-interna-super-secreta"
                        ),

                    false
                );
            }
        );
    }
);
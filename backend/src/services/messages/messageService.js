const mongoose = require("mongoose");

const AppError = require(
    "../../errors/AppError"
);

const Message = require(
    "../../models/mongodb/Message"
);

const ConversationMember = require(
    "../../models/mongodb/ConversationMember"
);

const {
    createMessage,
} = require(
    "../integration/chatPersistenceService"
);

const {
    assertUserActive,
} = require(
    "../integration/userIdentityService"
);


const MESSAGE_MAX_LENGTH = 1000;


/*
 * =====================================================
 * VALIDAÇÕES
 * =====================================================
 */

function normalizeObjectId(
    value,
    {
        field,
        code,
    }
) {
    if (
        typeof value !== "string" ||
        !mongoose.isValidObjectId(
            value.trim()
        )
    ) {
        throw AppError.badRequest(
            `${field} inválido.`,
            code
        );
    }

    return value.trim();
}


function normalizeClientMessageId(
    value
) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        throw AppError.badRequest(
            "clientMessageId é obrigatório.",
            "CLIENT_MESSAGE_ID_REQUIRED"
        );
    }

    return value.trim();
}


function normalizeContent(
    value
) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        throw AppError.badRequest(
            "A mensagem não pode estar vazia.",
            "MESSAGE_CONTENT_REQUIRED"
        );
    }


    const content =
        value.trim();


    if (
        content.length >
        MESSAGE_MAX_LENGTH
    ) {
        throw AppError.badRequest(
            "A mensagem pode possuir no máximo 1000 caracteres.",
            "MESSAGE_CONTENT_TOO_LONG",
            {
                max:
                    MESSAGE_MAX_LENGTH,

                received:
                    content.length,
            }
        );
    }


    return content;
}


/*
 * =====================================================
 * ERROS DA CAMADA DE PERSISTÊNCIA
 * =====================================================
 */

function throwPersistenceError(
    error
) {
    if (
        !error ||
        error.name !==
            "PersistenceIntegrationError"
    ) {
        throw error;
    }


    if (
        error.code ===
        "INVALID_CONVERSATION_ID"
    ) {
        throw AppError.badRequest(
            error.message,
            error.code,
            error.details
        );
    }


    if (
        error.code ===
        "CONVERSATION_NOT_FOUND"
    ) {
        throw AppError.notFound(
            error.message,
            error.code
        );
    }


    if (
        error.code ===
        "USER_INACTIVE"
    ) {
        throw AppError.forbidden(
            error.message,
            error.code
        );
    }


    if (
        error.code ===
            "SENDER_NOT_ACTIVE_MEMBER" ||
        error.code ===
            "USER_NOT_ACTIVE_MEMBER"
    ) {
        throw AppError.forbidden(
            error.message,
            error.code
        );
    }


    if (
        error.code ===
        "USER_NOT_FOUND"
    ) {
        throw AppError.unauthorized(
            "Usuário autenticado não encontrado.",
            "TOKEN_INVALID"
        );
    }


    throw error;
}


/*
 * =====================================================
 * SERIALIZAÇÃO
 * =====================================================
 */

function serializeMessage(
    message
) {
    if (!message) {
        return null;
    }


    const source =
        typeof message.toObject ===
        "function"
            ? message.toObject()
            : message;


    return {
        _id:
            source._id.toString(),

        conversation_id:
            source.conversation_id
                .toString(),

        sender_id:
            source.sender_id,

        client_message_id:
            source.client_message_id,

        content:
            source.content,

        created_at:
            source.created_at,
    };
}


function serializeCheckpoint(
    membership
) {
    return {
        conversation_id:
            membership.conversation_id
                .toString(),

        user_id:
            membership.user_id,

        last_delivered_message_id:
            membership
                .last_delivered_message_id
                ? membership
                    .last_delivered_message_id
                    .toString()
                : null,

        last_delivered_at:
            membership
                .last_delivered_at ??
            null,

        last_read_message_id:
            membership
                .last_read_message_id
                ? membership
                    .last_read_message_id
                    .toString()
                : null,

        last_read_at:
            membership
                .last_read_at ??
            null,
    };
}


/*
 * =====================================================
 * ORDENAÇÃO DE CHECKPOINTS
 * =====================================================
 *
 * A mesma ordenação utilizada pelo histórico:
 *
 * created_at
 * _id
 *
 * Isso impede que um ACK antigo faça o checkpoint
 * retroceder.
 */

function compareMessages(
    left,
    right
) {
    const leftTime =
        new Date(
            left.created_at
        ).getTime();

    const rightTime =
        new Date(
            right.created_at
        ).getTime();


    if (
        leftTime !==
        rightTime
    ) {
        return (
            leftTime >
            rightTime
                ? 1
                : -1
        );
    }


    return left._id
        .toString()
        .localeCompare(
            right._id.toString()
        );
}


/*
 * =====================================================
 * SERVICE
 * =====================================================
 */

function createMessageService({
    MessageModel =
        Message,

    ConversationMemberModel =
        ConversationMember,

    createMessagePersistence =
        createMessage,

    assertActiveUser =
        assertUserActive,

    now =
        () => new Date(),
} = {}) {


    async function assertActiveMembership({
        conversationId,
        userId,
    }) {
        try {
            await assertActiveUser(
                userId
            );
        } catch (error) {
            throwPersistenceError(
                error
            );
        }


        const membership =
            await ConversationMemberModel
                .findOne({
                    conversation_id:
                        conversationId,

                    user_id:
                        userId,

                    status:
                        "ACTIVE",
                });


        if (!membership) {
            throw AppError.forbidden(
                "Usuário não é membro ativo da conversa.",
                "USER_NOT_ACTIVE_MEMBER",
                {
                    conversation_id:
                        conversationId,

                    user_id:
                        userId,
                }
            );
        }


        return membership;
    }


    async function findMessageOrFail({
        conversationId,
        messageId,
    }) {
        const message =
            await MessageModel
                .findOne({
                    _id:
                        messageId,

                    conversation_id:
                        conversationId,
                });


        if (!message) {
            throw AppError.notFound(
                "Mensagem não encontrada na conversa.",
                "MESSAGE_NOT_FOUND"
            );
        }


        return message;
    }


    async function loadCheckpointMessage({
        conversationId,
        messageId,
    }) {
        if (!messageId) {
            return null;
        }


        const message =
            await MessageModel
                .findOne({
                    _id:
                        messageId,

                    conversation_id:
                        conversationId,
                });


        if (!message) {
            /*
             * Um checkpoint referenciando uma mensagem
             * inexistente representa inconsistência de
             * persistência, não erro do cliente.
             */
            throw new Error(
                "Checkpoint de mensagem referencia registro inexistente."
            );
        }


        return message;
    }


    /*
     * Atualização monotônica.
     *
     * O filtro inclui o valor atual do checkpoint.
     * Se outra requisição atualizar o registro entre
     * a leitura e o update, fazemos nova leitura e
     * tentamos novamente.
     *
     * Isso evita:
     *
     * mensagem 10 -> mensagem 12 -> mensagem 11
     */
    async function advanceCheckpoint({
        membership,
        conversationId,
        targetMessage,
        messageField,
        dateField,
    }) {
        let currentMembership =
            membership;


        for (
            let attempt = 1;
            attempt <= 3;
            attempt += 1
        ) {
            const currentMessageId =
                currentMembership[
                    messageField
                ];


            /*
             * ACK repetido:
             * operação idempotente.
             */
            if (
                currentMessageId &&
                currentMessageId
                    .toString() ===
                    targetMessage._id
                        .toString()
            ) {
                return {
                    membership:
                        currentMembership,

                    advanced:
                        false,
                };
            }


            const currentMessage =
                await loadCheckpointMessage({
                    conversationId,

                    messageId:
                        currentMessageId,
                });


            /*
             * ACK atrasado.
             *
             * Não gera erro e não retrocede
             * o checkpoint.
             */
            if (
                currentMessage &&
                compareMessages(
                    targetMessage,
                    currentMessage
                ) <= 0
            ) {
                return {
                    membership:
                        currentMembership,

                    advanced:
                        false,
                };
            }


            const filter = {
                _id:
                    currentMembership._id,

                status:
                    "ACTIVE",

                [messageField]:
                    currentMessageId ??
                    null,
            };


            const result =
                await ConversationMemberModel
                    .updateOne(
                        filter,
                        {
                            $set: {
                                [messageField]:
                                    targetMessage._id,

                                [dateField]:
                                    now(),
                            },
                        },
                        {
                            runValidators:
                                true,
                        }
                    );


            if (
                result.modifiedCount ===
                1
            ) {
                const refreshed =
                    await ConversationMemberModel
                        .findOne({
                            _id:
                                currentMembership._id,

                            status:
                                "ACTIVE",
                        });


                if (!refreshed) {
                    throw AppError.forbidden(
                        "Usuário não é mais membro ativo da conversa.",
                        "USER_NOT_ACTIVE_MEMBER"
                    );
                }


                return {
                    membership:
                        refreshed,

                    advanced:
                        true,
                };
            }


            /*
             * Outro ACK venceu a corrida.
             * Recarregamos o vínculo e
             * reavaliamos a posição.
             */
            currentMembership =
                await ConversationMemberModel
                    .findOne({
                        _id:
                            currentMembership._id,

                        status:
                            "ACTIVE",
                    });


            if (!currentMembership) {
                throw AppError.forbidden(
                    "Usuário não é mais membro ativo da conversa.",
                    "USER_NOT_ACTIVE_MEMBER"
                );
            }
        }


        throw AppError.conflict(
            "Não foi possível atualizar o estado da mensagem devido a atualizações concorrentes.",
            "MESSAGE_CHECKPOINT_CONFLICT"
        );
    }


    /*
     * =================================================
     * ENVIO
     * =================================================
     */

    async function sendMessage({
        conversationId,
        senderId,
        clientMessageId,
        content,
    }) {
        const normalizedConversationId =
            normalizeObjectId(
                conversationId,
                {
                    field:
                        "conversationId",

                    code:
                        "INVALID_CONVERSATION_ID",
                }
            );


        const normalizedClientMessageId =
            normalizeClientMessageId(
                clientMessageId
            );


        const normalizedContent =
            normalizeContent(
                content
            );


        let result;


        try {
            result =
                await createMessagePersistence({
                    conversationId:
                        normalizedConversationId,

                    senderId,

                    clientMessageId:
                        normalizedClientMessageId,

                    content:
                        normalizedContent,
                });
        } catch (error) {
            throwPersistenceError(
                error
            );
        }


        if (
            !result ||
            !result.message
        ) {
            throw new Error(
                "Persistência de mensagem retornou resultado inválido."
            );
        }


        /*
         * O índice atual garante unicidade por:
         *
         * sender_id + client_message_id
         *
         * Portanto, se o mesmo clientMessageId for
         * reutilizado pelo remetente em outra conversa,
         * não devolvemos silenciosamente uma mensagem
         * pertencente ao contexto errado.
         */
        if (
            result.message
                .conversation_id
                .toString() !==
            normalizedConversationId
        ) {
            throw AppError.conflict(
                "clientMessageId já utilizado pelo remetente em outra conversa.",
                "CLIENT_MESSAGE_ID_CONFLICT"
            );
        }


        return {
            message:
                serializeMessage(
                    result.message
                ),

            reused:
                Boolean(
                    result.reused
                ),
        };
    }


    /*
     * =================================================
     * ENTREGA
     * =================================================
     */

    async function markDelivered({
        conversationId,
        userId,
        messageId,
    }) {
        const normalizedConversationId =
            normalizeObjectId(
                conversationId,
                {
                    field:
                        "conversationId",

                    code:
                        "INVALID_CONVERSATION_ID",
                }
            );


        const normalizedMessageId =
            normalizeObjectId(
                messageId,
                {
                    field:
                        "messageId",

                    code:
                        "INVALID_MESSAGE_ID",
                }
            );


        /*
         * Primeiro autorização.
         *
         * Assim um usuário externo não pode usar
         * este endpoint para descobrir se determinada
         * mensagem existe.
         */
        const membership =
            await assertActiveMembership({
                conversationId:
                    normalizedConversationId,

                userId,
            });


        const message =
            await findMessageOrFail({
                conversationId:
                    normalizedConversationId,

                messageId:
                    normalizedMessageId,
            });


        const result =
            await advanceCheckpoint({
                membership,

                conversationId:
                    normalizedConversationId,

                targetMessage:
                    message,

                messageField:
                    "last_delivered_message_id",

                dateField:
                    "last_delivered_at",
            });


        return {
            checkpoint:
                serializeCheckpoint(
                    result.membership
                ),

            advanced:
                result.advanced,
        };
    }


    /*
     * =================================================
     * LEITURA
     * =================================================
     */

    async function markRead({
        conversationId,
        userId,
        messageId,
    }) {
        const normalizedConversationId =
            normalizeObjectId(
                conversationId,
                {
                    field:
                        "conversationId",

                    code:
                        "INVALID_CONVERSATION_ID",
                }
            );


        const normalizedMessageId =
            normalizeObjectId(
                messageId,
                {
                    field:
                        "messageId",

                    code:
                        "INVALID_MESSAGE_ID",
                }
            );


        let membership =
            await assertActiveMembership({
                conversationId:
                    normalizedConversationId,

                userId,
            });


        const message =
            await findMessageOrFail({
                conversationId:
                    normalizedConversationId,

                messageId:
                    normalizedMessageId,
            });


        /*
         * Uma mensagem LIDA necessariamente
         * já foi ENTREGUE.
         *
         * Primeiro garantimos o avanço de delivery.
         */
        const deliveryResult =
            await advanceCheckpoint({
                membership,

                conversationId:
                    normalizedConversationId,

                targetMessage:
                    message,

                messageField:
                    "last_delivered_message_id",

                dateField:
                    "last_delivered_at",
            });


        membership =
            deliveryResult.membership;


        /*
         * Depois avançamos o checkpoint de leitura.
         */
        const readResult =
            await advanceCheckpoint({
                membership,

                conversationId:
                    normalizedConversationId,

                targetMessage:
                    message,

                messageField:
                    "last_read_message_id",

                dateField:
                    "last_read_at",
            });


        return {
            checkpoint:
                serializeCheckpoint(
                    readResult.membership
                ),

            advanced:
                readResult.advanced,

            deliveryAdvanced:
                deliveryResult.advanced,
        };
    }


    return {
        sendMessage,
        markDelivered,
        markRead,
    };
}


module.exports = {
    createMessageService,
};
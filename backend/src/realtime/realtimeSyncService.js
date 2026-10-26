const AppError =
    require(
        "../errors/AppError"
    );

const {
    getLatestMessages,
    getMessagesAfter,
} = require(
    "../services/queries/messageQueryService"
);


/*
 * =====================================================
 * ERROS DE QUERY -> CONTRATO REALTIME
 * =====================================================
 */

function throwSyncError(
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
            "INVALID_CONVERSATION_ID" ||
        error.code ===
            "INVALID_MESSAGE_ID"
    ) {
        throw AppError
            .badRequest(
                error.message,
                error.code,
                error.details
            );
    }


    if (
        error.code ===
            "USER_INACTIVE" ||
        error.code ===
            "USER_NOT_ACTIVE_MEMBER"
    ) {
        throw AppError
            .forbidden(
                error.message,
                error.code
            );
    }


    if (
        error.code ===
        "SYNC_ANCHOR_NOT_FOUND"
    ) {
        throw AppError
            .conflict(
                "Não foi possível continuar a sincronização a partir da mensagem informada.",
                "SYNC_ANCHOR_NOT_FOUND"
            );
    }


    throw error;
}


function serializeMessage(
    message
) {
    return {
        _id:
            message
                ._id
                .toString(),

        conversation_id:
            message
                .conversation_id
                .toString(),

        sender_id:
            message
                .sender_id,

        client_message_id:
            message
                .client_message_id,

        content:
            message
                .content,

        created_at:
            message
                .created_at,
    };
}


function createRealtimeSyncService({
    getLatest =
        getLatestMessages,

    getAfter =
        getMessagesAfter,
} = {}) {

    async function syncConversation({
        conversationId,
        userId,
        afterMessageId =
            null,

        limit =
            50,
    }) {
        try {
            /*
             * Sem cursor:
             *
             * devolvemos snapshot das mensagens
             * mais recentes.
             *
             * Normalmente usado quando o cliente
             * perdeu seu estado local.
             */
            if (!afterMessageId) {
                const result =
                    await getLatest({
                        conversationId,
                        userId,
                        limit,
                    });


                const items =
                    result
                        .items
                        .map(
                            serializeMessage
                        );


                return {
                    mode:
                        "snapshot",

                    items,

                    hasMore:
                        false,

                    nextAfterMessageId:
                        items.length > 0
                            ? items[
                                items.length - 1
                            ]._id
                            : null,
                };
            }


            /*
             * Cursor conhecido:
             *
             * buscar somente o que apareceu
             * depois da última mensagem local.
             */
            const result =
                await getAfter({
                    conversationId,
                    userId,
                    afterMessageId,
                    limit,
                });


            return {
                mode:
                    "incremental",

                items:
                    result
                        .items
                        .map(
                            serializeMessage
                        ),

                hasMore:
                    result
                        .hasMore,

                nextAfterMessageId:
                    result
                        .nextAfterMessageId,
            };

        } catch (error) {
            throwSyncError(
                error
            );
        }
    }


    return {
        syncConversation,
    };
}


module.exports = {
    createRealtimeSyncService,
};
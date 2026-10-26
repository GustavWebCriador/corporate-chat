const mongoose =
    require("mongoose");


const Message =
    require(
        "../../models/mongodb/Message"
    );


const ConversationMember =
    require(
        "../../models/mongodb/ConversationMember"
    );


const {
    PersistenceIntegrationError,
    assertUserActive,
} = require(
    "../integration/userIdentityService"
);


const {
    normalizeLimit,
    encodeCursor,
    decodeCursor,
} = require(
    "./queryCursor"
);

async function assertActiveMembership(
    {
        conversationId,
        userId,
    }
) {

    if (
        !mongoose.isValidObjectId(
            conversationId
        )
    ) {

        throw new PersistenceIntegrationError(

            "INVALID_CONVERSATION_ID",

            "conversationId inválido."
        );
    }


    /*
     * PostgreSQL
     */
    await assertUserActive(
        userId
    );


    /*
     * MongoDB
     */
    const membership =
        await ConversationMember
            .findOne({

                conversation_id:
                    conversationId,

                user_id:
                    userId,

                status:
                    "ACTIVE",
            });


    if (!membership) {

        throw new PersistenceIntegrationError(

            "USER_NOT_ACTIVE_MEMBER",

            "Usuário não é membro ativo da conversa.",

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
async function getMessageHistory(
    {
        conversationId,
        userId,
        limit = 50,
        before = null,
    }
) {

    await assertActiveMembership({

        conversationId,

        userId,
    });


    const pageSize =
        normalizeLimit(
            limit,
            50,
            100
        );


    const cursor =
        decodeCursor(
            before
        );


    const filter = {

        conversation_id:
            new mongoose
                .Types
                .ObjectId(
                    conversationId
                ),
    };


    /*
     * Queremos registros ANTERIORES
     * ao cursor.
     */
    if (cursor) {

        if (
            !mongoose.isValidObjectId(
                cursor.id
            )
        ) {

            throw new PersistenceIntegrationError(

                "INVALID_QUERY_CURSOR",

                "ObjectId do cursor inválido."
            );
        }


        filter.$or = [

            {
                created_at: {

                    $lt:
                        cursor.timestamp,
                },
            },

            {
                created_at:
                    cursor.timestamp,

                _id: {

                    $lt:
                        new mongoose
                            .Types
                            .ObjectId(
                                cursor.id
                            ),
                },
            },
        ];
    }


    /*
     * Busca DESC para obter rapidamente
     * as últimas mensagens.
     */
    const result =
        await Message
            .find(
                filter
            )
            .sort({

                created_at:
                    -1,

                _id:
                    -1,
            })
            .limit(
                pageSize + 1
            )
            .lean();


    const hasMore =
        result.length >
        pageSize;


    const pageDescending =
        result.slice(
            0,
            pageSize
        );


    let nextCursor =
        null;


    if (
        hasMore &&
        pageDescending.length >
        0
    ) {

        /*
         * Último item em DESC =
         * mensagem mais antiga da página.
         */
        const oldest =
            pageDescending[
                pageDescending.length -
                1
            ];


        nextCursor =
            encodeCursor({

                timestamp:
                    oldest.created_at,

                id:
                    oldest._id,
            });
    }


    /*
     * Para o frontend de chat
     * devolvemos ordem cronológica:
     *
     * antiga -> nova
     */
    const items =
        pageDescending
            .reverse();


    return {

        items,
        hasMore,
        nextCursor,
    };
}
async function getLatestMessages(
    {
        conversationId,
        userId,
        limit = 50,
    }
) {

    return getMessageHistory({

        conversationId,

        userId,

        limit,

        before:
            null,
    });
}
async function countUnreadMessages(
    {
        conversationId,
        userId,
    }
) {

    const membership =
        await assertActiveMembership({

            conversationId,

            userId,
        });


    const filter = {

        conversation_id:
            new mongoose
                .Types
                .ObjectId(
                    conversationId
                ),


        /*
         * Mensagem enviada pelo próprio
         * usuário não entra como "não lida".
         */
        sender_id: {

            $ne:
                userId,
        },
    };


    /*
     * Nunca leu nada.
     */
    if (
        !membership
            .last_read_message_id
    ) {

        return Message
            .countDocuments(
                filter
            );
    }


    /*
     * Descobre a posição temporal
     * do cursor de leitura.
     */
    const lastReadMessage =
        await Message.findOne({

            _id:
                membership
                    .last_read_message_id,

            conversation_id:
                conversationId,
        })
        .lean();


    if (!lastReadMessage) {

        throw new PersistenceIntegrationError(

            "LAST_READ_MESSAGE_NOT_FOUND",

            "Cursor de leitura aponta para mensagem inexistente.",

            {
                conversation_id:
                    conversationId,

                message_id:
                    membership
                        .last_read_message_id,
            }
        );
    }


    filter.$or = [

        {
            created_at: {

                $gt:
                    lastReadMessage
                        .created_at,
            },
        },

        {
            created_at:
                lastReadMessage
                    .created_at,

            _id: {

                $gt:
                    lastReadMessage
                        ._id,
            },
        },
    ];


    return Message
        .countDocuments(
            filter
        );
}

async function getMessagesAfter(
    {
        conversationId,
        userId,
        afterMessageId,
        limit = 50,
    }
) {
    await assertActiveMembership({
        conversationId,
        userId,
    });


    const numericLimit =
        Number(
            limit
        );


    const pageSize =
        Number.isInteger(
            numericLimit
        ) &&
        numericLimit > 0
            ? Math.min(
                numericLimit,
                100
            )
            : 50;


    if (
        typeof afterMessageId !==
            "string" ||
        !mongoose.isValidObjectId(
            afterMessageId
        )
    ) {
        throw new PersistenceIntegrationError(
            "INVALID_MESSAGE_ID",
            "afterMessageId inválido."
        );
    }


    /*
     * O cursor precisa pertencer à própria
     * conversa solicitada.
     */
    const anchor =
        await Message
            .findOne({
                _id:
                    afterMessageId,

                conversation_id:
                    conversationId,
            })
            .lean();


    if (!anchor) {
        throw new PersistenceIntegrationError(
            "SYNC_ANCHOR_NOT_FOUND",
            "Mensagem de referência da sincronização não encontrada."
        );
    }


    const filter = {
        conversation_id:
            new mongoose
                .Types
                .ObjectId(
                    conversationId
                ),

        $or: [
            {
                created_at: {
                    $gt:
                        anchor
                            .created_at,
                },
            },

            {
                created_at:
                    anchor
                        .created_at,

                _id: {
                    $gt:
                        anchor
                            ._id,
                },
            },
        ],
    };


    /*
     * Diferente do histórico:
     *
     * aqui queremos:
     *
     * antiga perdida -> nova perdida
     */
    const result =
        await Message
            .find(
                filter
            )
            .sort({
                created_at:
                    1,

                _id:
                    1,
            })
            .limit(
                pageSize + 1
            )
            .lean();


    const hasMore =
        result.length >
        pageSize;


    const items =
        result.slice(
            0,
            pageSize
        );


    const lastItem =
        items.length > 0
            ? items[
                items.length - 1
            ]
            : null;


    return {
        items,

        hasMore,

        nextAfterMessageId:
            lastItem
                ? lastItem
                    ._id
                    .toString()
                : afterMessageId,
    };
}

module.exports = {

    assertActiveMembership,
    getLatestMessages,
    getMessageHistory,
    getMessagesAfter,
    countUnreadMessages,
};

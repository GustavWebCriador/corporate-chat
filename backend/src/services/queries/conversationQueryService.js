const Conversation =
    require(
        "../../models/mongodb/Conversation"
    );


const ConversationMember =
    require(
        "../../models/mongodb/ConversationMember"
    );


const Message =
    require(
        "../../models/mongodb/Message"
    );


const {
    assertUserActive,
} = require(
    "../integration/userIdentityService"
);


const {
    normalizeLimit,
} = require(
    "./queryCursor"
);


async function listUserConversations(
    {
        userId,
        limit = 50,
    }
) {

    /*
     * PostgreSQL:
     * usuário precisa continuar ativo
     * para utilizar o sistema.
     */
    await assertUserActive(
        userId
    );


    const pageSize =
        normalizeLimit(
            limit,
            50,
            100
        );


    /*
     * Índice utilizado:
     *
     * user_id + status
     */
    const memberships =
        await ConversationMember
            .find({

                user_id:
                    userId,

                status:
                    "ACTIVE",
            })
            .select({

                conversation_id:
                    1,

                role:
                    1,

                _id:
                    0,
            })
            .lean();


    if (
        memberships.length ===
        0
    ) {

        return [];
    }


    const membershipMap =
        new Map(

            memberships.map(
                member => [

                    member
                        .conversation_id
                        .toString(),

                    member,
                ]
            )
        );


    const conversationIds =
        memberships.map(
            member =>
                member
                    .conversation_id
        );


    /*
     * Conversas com mensagem aparecem
     * primeiro.
     *
     * Conversas sem mensagem ficam
     * ordenadas pela criação.
     */
    const conversations =
        await Conversation
            .find({

                _id: {

                    $in:
                        conversationIds,
                },
            })
            .sort({

                last_message_at:
                    -1,

                created_at:
                    -1,

                _id:
                    -1,
            })
            .limit(
                pageSize
            )
            .lean();


    /*
     * Busca as últimas mensagens
     * em uma única operação.
     *
     * Evita uma query por conversa.
     */
    const lastMessageIds =
        conversations
            .map(
                conversation =>
                    conversation
                        .last_message_id
            )
            .filter(
                Boolean
            );


    const lastMessages =
        lastMessageIds.length
            ? await Message
                .find({

                    _id: {

                        $in:
                            lastMessageIds,
                    },
                })
                .lean()

            : [];


    const lastMessageMap =
        new Map(

            lastMessages.map(
                message => [

                    message
                        ._id
                        .toString(),

                    message,
                ]
            )
        );


    return conversations.map(
        conversation => {

            const membership =
                membershipMap.get(

                    conversation
                        ._id
                        .toString()
                );


            const lastMessage =
                conversation
                    .last_message_id

                    ? lastMessageMap.get(

                        conversation
                            .last_message_id
                            .toString()
                    ) ?? null

                    : null;


            return {

                ...conversation,

                membership: {

                    role:
                        membership
                            ?.role,
                },

                last_message:
                    lastMessage,
            };
        }
    );
}


module.exports = {

    listUserConversations,
};
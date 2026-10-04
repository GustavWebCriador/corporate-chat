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
    PersistenceIntegrationError,
    assertUserActive,
    assertUsersActive,
} = require(
    "./userIdentityService"
);

function generatePrivateKey(
    userA,
    userB
) {

    return [
        userA,
        userB,
    ]
        .sort()
        .join(":");
}
async function createPrivateConversation(
    {
        requesterId,
        otherUserId,
    }
) {

    /*
     * Não permitimos conversa
     * privada consigo mesmo.
     */
    if (
        requesterId ===
        otherUserId
    ) {

        throw new PersistenceIntegrationError(

            "PRIVATE_CONVERSATION_SAME_USER",

            "Uma conversa privada exige dois usuários diferentes."
        );
    }


    /*
     * POSTGRESQL
     *
     * Os dois usuários precisam existir
     * e estar ACTIVE.
     */
    await assertUsersActive([
        requesterId,
        otherUserId,
    ]);


    /*
     * Chave canônica.
     */
    const privateKey =
        generatePrivateKey(
            requesterId,
            otherUserId
        );


    /*
     * Reutilizamos conversa existente.
     */
    let conversation =
        await Conversation.findOne({

            type:
                "PRIVATE",

            private_key:
                privateKey,
        });


    if (!conversation) {

        try {

            conversation =
                await Conversation.create({

                    type:
                        "PRIVATE",

                    created_by:
                        requesterId,

                    private_key:
                        privateKey,
                });

        } catch (error) {

            /*
             * Pode ocorrer corrida:
             *
             * requisição A cria
             * requisição B tenta criar
             *
             * índice UNIQUE bloqueia B.
             */
            if (
                error.code ===
                11000
            ) {

                conversation =
                    await Conversation
                        .findOne({

                            type:
                                "PRIVATE",

                            private_key:
                                privateKey,
                        });

            } else {

                throw error;
            }
        }
    }


    /*
     * Garante os dois membros.
     *
     * $setOnInsert evita alterar
     * dados caso já existam.
     */
    await ConversationMember
        .updateOne(

            {
                conversation_id:
                    conversation._id,

                user_id:
                    requesterId,
            },

            {
                $setOnInsert: {

                    conversation_id:
                        conversation._id,

                    user_id:
                        requesterId,

                    role:
                        "CREATOR",

                    status:
                        "ACTIVE",

                    joined_at:
                        new Date(),
                },
            },

            {
                upsert:
                    true,

                runValidators:
                    true,
            }
        );


    await ConversationMember
        .updateOne(

            {
                conversation_id:
                    conversation._id,

                user_id:
                    otherUserId,
            },

            {
                $setOnInsert: {

                    conversation_id:
                        conversation._id,

                    user_id:
                        otherUserId,

                    role:
                        "MEMBER",

                    status:
                        "ACTIVE",

                    joined_at:
                        new Date(),
                },
            },

            {
                upsert:
                    true,

                runValidators:
                    true,
            }
        );


    return conversation;
}
async function createGroupConversation(
    {
        creatorId,
        memberIds,
        name,
    }
) {

    /*
     * Creator sempre faz parte
     * do grupo.
     */
    const users =
        [
            ...new Set([
                creatorId,
                ...memberIds,
            ]),
        ];


    /*
     * Regra atual:
     * grupo = 2 até 50 usuários.
     */
    if (
        users.length < 2 ||
        users.length > 50
    ) {

        throw new PersistenceIntegrationError(

            "INVALID_GROUP_SIZE",

            "O grupo deve possuir entre 2 e 50 participantes.",

            {
                total:
                    users.length,
            }
        );
    }


    /*
     * Todos precisam existir
     * e estar ACTIVE no PostgreSQL.
     */
    await assertUsersActive(
        users
    );


    const conversation =
        await Conversation.create({

            type:
                "GROUP",

            name,

            created_by:
                creatorId,
        });


    for (
        const userId of users
    ) {

        await ConversationMember.create({

            conversation_id:
                conversation._id,

            user_id:
                userId,

            role:
                userId ===
                creatorId
                    ? "CREATOR"
                    : "MEMBER",

            status:
                "ACTIVE",
        });
    }


    return conversation;
}
async function createMessage(
    {
        conversationId,
        senderId,
        clientMessageId,
        content,
    }
) {

    /*
     * 1.
     * Usuário precisa existir
     * e estar ACTIVE no PostgreSQL.
     */
    await assertUserActive(
        senderId
    );


    /*
     * 2.
     * Conversa precisa existir.
     */
    const conversation =
        await Conversation.findById(
            conversationId
        );


    if (!conversation) {

        throw new PersistenceIntegrationError(

            "CONVERSATION_NOT_FOUND",

            "Conversa não encontrada.",

            {
                conversation_id:
                    conversationId,
            }
        );
    }


    /*
     * 3.
     * Usuário precisa participar
     * ativamente da conversa.
     */
    const membership =
        await ConversationMember.findOne({

            conversation_id:
                conversationId,

            user_id:
                senderId,

            status:
                "ACTIVE",
        });


    if (!membership) {

        throw new PersistenceIntegrationError(

            "SENDER_NOT_ACTIVE_MEMBER",

            "Usuário não é membro ativo da conversa.",

            {
                conversation_id:
                    conversationId,

                sender_id:
                    senderId,
            }
        );
    }


    /*
     * 4.
     * Idempotência.
     *
     * Se o frontend reenviar
     * client_message_id já persistido,
     * devolvemos a mensagem existente.
     */
    const existingMessage =
        await Message.findOne({

            sender_id:
                senderId,

            client_message_id:
                clientMessageId,
        });


    if (
        existingMessage
    ) {

        return {

            message:
                existingMessage,

            reused:
                true,
        };
    }


    let message;


    try {

        message =
            await Message.create({

                conversation_id:
                    conversationId,

                sender_id:
                    senderId,

                client_message_id:
                    clientMessageId,

                content,
            });

    } catch (error) {

        /*
         * Proteção contra condição
         * de corrida.
         */
        if (
            error.code ===
            11000
        ) {

            const duplicated =
                await Message.findOne({

                    sender_id:
                        senderId,

                    client_message_id:
                        clientMessageId,
                });


            return {

                message:
                    duplicated,

                reused:
                    true,
            };
        }


        throw error;
    }


    /*
     * Atualizamos os metadados
     * da conversa.
     */
    conversation.last_message_id =
        message._id;

    conversation.last_message_at =
        message.created_at;

    await conversation.save();


    return {

        message,

        reused:
            false,
    };
}

module.exports = {

    createPrivateConversation,

    createGroupConversation,

    createMessage,
};
require("dotenv").config();

const {
    test,
    before,
    after,
    afterEach,
} = require("node:test");

const assert =
    require("node:assert/strict");

const {
    randomUUID,
} = require("node:crypto");

const mongoose =
    require("mongoose");

const {
    sequelize,
    User,
} = require(
    "../../../src/models/postgres"
);

const {
    connectMongoDB,
} = require(
    "../../../src/config/db/mongodb"
);

const Conversation =
    require(
        "../../../src/models/mongodb/Conversation"
    );

const ConversationMember =
    require(
        "../../../src/models/mongodb/ConversationMember"
    );

const Message =
    require(
        "../../../src/models/mongodb/Message"
    );

const {
    createPrivateConversation,
    createGroupConversation,
} = require(
    "../../../src/services/integration/chatPersistenceService"
);

const {
    createMessageService,
} = require(
    "../../../src/services/messages/messageService"
);


/*
 * =====================================================
 * DADOS TEMPORÁRIOS
 * =====================================================
 */

const testUserIds =
    new Set();

const testConversationIds =
    new Set();

let messageService;


/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

async function createTestUser({
    status = "ACTIVE",
    name = "BE09 Integration User",
} = {}) {
    const userId =
        randomUUID();

    const user =
        await User.create({
            user_id:
                userId,

            name,

            email:
                `be09-${userId.slice(0, 8)}@test.local`,

            password_hash:
                "be09-integration-test-hash",

            status,

            is_admin:
                false,
        });

    testUserIds.add(
        user.user_id
    );

    return user;
}


function rememberConversation(
    conversation
) {
    testConversationIds.add(
        conversation
            ._id
            .toString()
    );

    return conversation;
}


async function createPrivate(
    userA,
    userB
) {
    const conversation =
        await createPrivateConversation({
            requesterId:
                userA.user_id,

            otherUserId:
                userB.user_id,
        });

    return rememberConversation(
        conversation
    );
}


async function createGroup(
    creator,
    members
) {
    const conversation =
        await createGroupConversation({
            creatorId:
                creator.user_id,

            memberIds:
                members.map(
                    member =>
                        member.user_id
                ),

            name:
                "Grupo BE-09",
        });

    return rememberConversation(
        conversation
    );
}


async function createStoredMessage({
    conversationId,
    senderId,
    content,
    createdAt,
}) {
    return Message.create({
        conversation_id:
            conversationId,

        sender_id:
            senderId,

        client_message_id:
            `be09-${randomUUID()}`,

        content,

        created_at:
            createdAt,
    });
}


async function getMembership(
    conversationId,
    userId
) {
    return ConversationMember
        .findOne({
            conversation_id:
                conversationId,

            user_id:
                userId,
        });
}


/*
 * =====================================================
 * SETUP
 * =====================================================
 */

before(async () => {
    if (
        process.env.NODE_ENV !==
        "development"
    ) {
        throw new Error(
            "Este teste deve executar somente no ambiente development."
        );
    }

    await sequelize.authenticate();

    await connectMongoDB();

    await Conversation.syncIndexes();

    await ConversationMember
        .syncIndexes();

    await Message.syncIndexes();

    messageService =
        createMessageService();
});


/*
 * =====================================================
 * CLEANUP
 * =====================================================
 */

async function cleanup() {
    const conversationIds =
        [...testConversationIds]
            .map(
                id =>
                    new mongoose.Types.ObjectId(
                        id
                    )
            );

    if (
        conversationIds.length >
        0
    ) {
        await Message.deleteMany({
            conversation_id: {
                $in:
                    conversationIds,
            },
        });

        await ConversationMember
            .deleteMany({
                conversation_id: {
                    $in:
                        conversationIds,
                },
            });

        await Conversation.deleteMany({
            _id: {
                $in:
                    conversationIds,
            },
        });
    }

    testConversationIds.clear();

    if (
        testUserIds.size >
        0
    ) {
        await User.destroy({
            where: {
                user_id:
                    [...testUserIds],
            },
        });
    }

    testUserIds.clear();
}


afterEach(async () => {
    await cleanup();
});


after(async () => {
    await cleanup();

    await mongoose.disconnect();

    await sequelize.close();
});


/*
 * =====================================================
 * ENVIO
 * =====================================================
 */

test(
    "BE-09 INTEGRATION: membro ACTIVE envia mensagem e atualiza metadados da conversa",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const conversation =
            await createPrivate(
                userA,
                userB
            );

        const clientMessageId =
            `client-${randomUUID()}`;

        const result =
            await messageService
                .sendMessage({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    senderId:
                        userA.user_id,

                    clientMessageId,

                    content:
                        "Mensagem BE-09",
                });

        assert.equal(
            result.reused,
            false
        );

        assert.equal(
            result.message.sender_id,
            userA.user_id
        );

        assert.equal(
            result.message.content,
            "Mensagem BE-09"
        );

        assert.equal(
            result.message
                .client_message_id,
            clientMessageId
        );

        assert.ok(
            result.message.created_at
        );

        const persisted =
            await Message.findById(
                result.message._id
            );

        assert.ok(
            persisted
        );

        const updatedConversation =
            await Conversation.findById(
                conversation._id
            );

        assert.equal(
            updatedConversation
                .last_message_id
                .toString(),

            persisted
                ._id
                .toString()
        );

        assert.equal(
            updatedConversation
                .last_message_at
                .getTime(),

            persisted
                .created_at
                .getTime()
        );
    }
);


test(
    "BE-09 INTEGRATION: reenvio idempotente reutiliza a mesma mensagem",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const conversation =
            await createPrivate(
                userA,
                userB
            );

        const clientMessageId =
            `client-${randomUUID()}`;

        const first =
            await messageService
                .sendMessage({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    senderId:
                        userA.user_id,

                    clientMessageId,

                    content:
                        "Mensagem idempotente",
                });

        const second =
            await messageService
                .sendMessage({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    senderId:
                        userA.user_id,

                    clientMessageId,

                    content:
                        "Mensagem idempotente",
                });

        assert.equal(
            first.reused,
            false
        );

        assert.equal(
            second.reused,
            true
        );

        assert.equal(
            first.message._id,
            second.message._id
        );

        const count =
            await Message.countDocuments({
                sender_id:
                    userA.user_id,

                client_message_id:
                    clientMessageId,
            });

        assert.equal(
            count,
            1
        );
    }
);


test(
    "BE-09 INTEGRATION: usuário fora da conversa não pode enviar mensagem",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const outsider =
            await createTestUser();

        const conversation =
            await createPrivate(
                userA,
                userB
            );

        await assert.rejects(
            () =>
                messageService
                    .sendMessage({
                        conversationId:
                            conversation
                                ._id
                                .toString(),

                        senderId:
                            outsider.user_id,

                        clientMessageId:
                            `client-${randomUUID()}`,

                        content:
                            "Não autorizado",
                    }),

            error => {
                assert.equal(
                    error.statusCode,
                    403
                );

                assert.equal(
                    error.code,
                    "SENDER_NOT_ACTIVE_MEMBER"
                );

                return true;
            }
        );

        const count =
            await Message.countDocuments({
                conversation_id:
                    conversation._id,

                sender_id:
                    outsider.user_id,
            });

        assert.equal(
            count,
            0
        );
    }
);


test(
    "BE-09 INTEGRATION: membro ACTIVE de grupo pode enviar mensagem",

    async () => {
        const creator =
            await createTestUser();

        const memberA =
            await createTestUser();

        const memberB =
            await createTestUser();

        const group =
            await createGroup(
                creator,
                [
                    memberA,
                    memberB,
                ]
            );

        const result =
            await messageService
                .sendMessage({
                    conversationId:
                        group
                            ._id
                            .toString(),

                    senderId:
                        memberA.user_id,

                    clientMessageId:
                        `client-${randomUUID()}`,

                    content:
                        "Mensagem para o grupo",
                });

        assert.equal(
            result.reused,
            false
        );

        assert.equal(
            result.message.sender_id,
            memberA.user_id
        );

        assert.equal(
            result.message
                .conversation_id,

            group
                ._id
                .toString()
        );
    }
);


/*
 * =====================================================
 * ENTREGA
 * =====================================================
 */
test(
    "BE-09 INTEGRATION: clientMessageId ausente deve ser rejeitado",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const conversation =
            await createPrivate(
                userA,
                userB
            );


        await assert.rejects(
            () =>
                messageService
                    .sendMessage({
                        conversationId:
                            conversation
                                ._id
                                .toString(),

                        senderId:
                            userA.user_id,

                        content:
                            "Mensagem sem clientMessageId",
                    }),

            error => {
                assert.equal(
                    error.statusCode,
                    400
                );

                assert.equal(
                    error.code,
                    "CLIENT_MESSAGE_ID_REQUIRED"
                );

                return true;
            }
        );


        const count =
            await Message.countDocuments({
                conversation_id:
                    conversation._id,
            });


        assert.equal(
            count,
            0
        );
    }
);


test(
    "BE-09 INTEGRATION: mensagem vazia ou somente com espaços deve ser rejeitada",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const conversation =
            await createPrivate(
                userA,
                userB
            );


        await assert.rejects(
            () =>
                messageService
                    .sendMessage({
                        conversationId:
                            conversation
                                ._id
                                .toString(),

                        senderId:
                            userA.user_id,

                        clientMessageId:
                            `client-${randomUUID()}`,

                        content:
                            "     ",
                    }),

            error => {
                assert.equal(
                    error.statusCode,
                    400
                );

                assert.equal(
                    error.code,
                    "MESSAGE_CONTENT_REQUIRED"
                );

                return true;
            }
        );


        const count =
            await Message.countDocuments({
                conversation_id:
                    conversation._id,
            });


        assert.equal(
            count,
            0
        );
    }
);


test(
    "BE-09 INTEGRATION: mensagem com mais de 1000 caracteres deve ser rejeitada",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const conversation =
            await createPrivate(
                userA,
                userB
            );


        const content =
            "A".repeat(
                1001
            );


        await assert.rejects(
            () =>
                messageService
                    .sendMessage({
                        conversationId:
                            conversation
                                ._id
                                .toString(),

                        senderId:
                            userA.user_id,

                        clientMessageId:
                            `client-${randomUUID()}`,

                        content,
                    }),

            error => {
                assert.equal(
                    error.statusCode,
                    400
                );

                assert.equal(
                    error.code,
                    "MESSAGE_CONTENT_TOO_LONG"
                );

                assert.equal(
                    error.details.max,
                    1000
                );

                assert.equal(
                    error.details.received,
                    1001
                );

                return true;
            }
        );


        const count =
            await Message.countDocuments({
                conversation_id:
                    conversation._id,
            });


        assert.equal(
            count,
            0
        );
    }
);


test(
    "BE-09 INTEGRATION: mensagem com exatamente 1000 caracteres deve ser aceita",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const conversation =
            await createPrivate(
                userA,
                userB
            );


        const content =
            "A".repeat(
                1000
            );


        const result =
            await messageService
                .sendMessage({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    senderId:
                        userA.user_id,

                    clientMessageId:
                        `client-${randomUUID()}`,

                    content,
                });


        assert.equal(
            result.reused,
            false
        );


        assert.equal(
            result
                .message
                .content
                .length,

            1000
        );


        const persisted =
            await Message.findById(
                result.message._id
            );


        assert.ok(
            persisted
        );


        assert.equal(
            persisted
                .content
                .length,

            1000
        );
    }
);

test(
    "BE-09 INTEGRATION: destinatário avança checkpoint de entrega",

    async () => {
        const sender =
            await createTestUser();

        const recipient =
            await createTestUser();

        const conversation =
            await createPrivate(
                sender,
                recipient
            );

        const message =
            await createStoredMessage({
                conversationId:
                    conversation._id,

                senderId:
                    sender.user_id,

                content:
                    "Mensagem entregue",

                createdAt:
                    new Date(
                        "2030-01-01T10:00:00.000Z"
                    ),
            });

        const result =
            await messageService
                .markDelivered({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    userId:
                        recipient.user_id,

                    messageId:
                        message
                            ._id
                            .toString(),
                });

        assert.equal(
            result.advanced,
            true
        );

        assert.equal(
            result
                .checkpoint
                .last_delivered_message_id,

            message
                ._id
                .toString()
        );

        assert.ok(
            result
                .checkpoint
                .last_delivered_at
        );

        const persistedMembership =
            await getMembership(
                conversation._id,
                recipient.user_id
            );

        assert.equal(
            persistedMembership
                .last_delivered_message_id
                .toString(),

            message
                ._id
                .toString()
        );
    }
);


test(
    "BE-09 INTEGRATION: repetir ACK de entrega é idempotente",

    async () => {
        const sender =
            await createTestUser();

        const recipient =
            await createTestUser();

        const conversation =
            await createPrivate(
                sender,
                recipient
            );

        const message =
            await createStoredMessage({
                conversationId:
                    conversation._id,

                senderId:
                    sender.user_id,

                content:
                    "Mensagem entregue uma vez",

                createdAt:
                    new Date(
                        "2030-01-01T10:00:00.000Z"
                    ),
            });

        const first =
            await messageService
                .markDelivered({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    userId:
                        recipient.user_id,

                    messageId:
                        message
                            ._id
                            .toString(),
                });

        const firstDeliveredAt =
            first
                .checkpoint
                .last_delivered_at
                .getTime();

        const second =
            await messageService
                .markDelivered({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    userId:
                        recipient.user_id,

                    messageId:
                        message
                            ._id
                            .toString(),
                });

        assert.equal(
            first.advanced,
            true
        );

        assert.equal(
            second.advanced,
            false
        );

        assert.equal(
            second
                .checkpoint
                .last_delivered_at
                .getTime(),

            firstDeliveredAt
        );
    }
);


test(
    "BE-09 INTEGRATION: ACK antigo não faz checkpoint de entrega regredir",

    async () => {
        const sender =
            await createTestUser();

        const recipient =
            await createTestUser();

        const conversation =
            await createPrivate(
                sender,
                recipient
            );

        const olderMessage =
            await createStoredMessage({
                conversationId:
                    conversation._id,

                senderId:
                    sender.user_id,

                content:
                    "Mensagem antiga",

                createdAt:
                    new Date(
                        "2030-01-01T10:00:00.000Z"
                    ),
            });

        const newerMessage =
            await createStoredMessage({
                conversationId:
                    conversation._id,

                senderId:
                    sender.user_id,

                content:
                    "Mensagem nova",

                createdAt:
                    new Date(
                        "2030-01-01T10:01:00.000Z"
                    ),
            });

        await messageService
            .markDelivered({
                conversationId:
                    conversation
                        ._id
                        .toString(),

                userId:
                    recipient.user_id,

                messageId:
                    newerMessage
                        ._id
                        .toString(),
            });

        const oldAck =
            await messageService
                .markDelivered({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    userId:
                        recipient.user_id,

                    messageId:
                        olderMessage
                            ._id
                            .toString(),
                });

        assert.equal(
            oldAck.advanced,
            false
        );

        assert.equal(
            oldAck
                .checkpoint
                .last_delivered_message_id,

            newerMessage
                ._id
                .toString()
        );
    }
);


/*
 * =====================================================
 * LEITURA
 * =====================================================
 */

test(
    "BE-09 INTEGRATION: leitura avança checkpoints de entregue e lida",

    async () => {
        const sender =
            await createTestUser();

        const recipient =
            await createTestUser();

        const conversation =
            await createPrivate(
                sender,
                recipient
            );

        const message =
            await createStoredMessage({
                conversationId:
                    conversation._id,

                senderId:
                    sender.user_id,

                content:
                    "Mensagem lida",

                createdAt:
                    new Date(
                        "2030-01-01T10:00:00.000Z"
                    ),
            });

        const result =
            await messageService
                .markRead({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    userId:
                        recipient.user_id,

                    messageId:
                        message
                            ._id
                            .toString(),
                });

        assert.equal(
            result.advanced,
            true
        );

        assert.equal(
            result.deliveryAdvanced,
            true
        );

        assert.equal(
            result
                .checkpoint
                .last_delivered_message_id,

            message
                ._id
                .toString()
        );

        assert.equal(
            result
                .checkpoint
                .last_read_message_id,

            message
                ._id
                .toString()
        );

        assert.ok(
            result
                .checkpoint
                .last_delivered_at
        );

        assert.ok(
            result
                .checkpoint
                .last_read_at
        );
    }
);


test(
    "BE-09 INTEGRATION: ACK antigo de leitura não faz checkpoint regredir",

    async () => {
        const sender =
            await createTestUser();

        const recipient =
            await createTestUser();

        const conversation =
            await createPrivate(
                sender,
                recipient
            );

        const olderMessage =
            await createStoredMessage({
                conversationId:
                    conversation._id,

                senderId:
                    sender.user_id,

                content:
                    "Leitura antiga",

                createdAt:
                    new Date(
                        "2030-01-01T10:00:00.000Z"
                    ),
            });

        const newerMessage =
            await createStoredMessage({
                conversationId:
                    conversation._id,

                senderId:
                    sender.user_id,

                content:
                    "Leitura nova",

                createdAt:
                    new Date(
                        "2030-01-01T10:01:00.000Z"
                    ),
            });

        await messageService
            .markRead({
                conversationId:
                    conversation
                        ._id
                        .toString(),

                userId:
                    recipient.user_id,

                messageId:
                    newerMessage
                        ._id
                        .toString(),
            });

        const result =
            await messageService
                .markRead({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    userId:
                        recipient.user_id,

                    messageId:
                        olderMessage
                            ._id
                            .toString(),
                });

        assert.equal(
            result.advanced,
            false
        );

        assert.equal(
            result
                .checkpoint
                .last_read_message_id,

            newerMessage
                ._id
                .toString()
        );

        assert.equal(
            result
                .checkpoint
                .last_delivered_message_id,

            newerMessage
                ._id
                .toString()
        );
    }
);


/*
 * =====================================================
 * SEGURANÇA
 * =====================================================
 */

test(
    "BE-09 INTEGRATION SECURITY: usuário fora da conversa não pode marcar entrega",

    async () => {
        const sender =
            await createTestUser();

        const recipient =
            await createTestUser();

        const outsider =
            await createTestUser();

        const conversation =
            await createPrivate(
                sender,
                recipient
            );

        const message =
            await createStoredMessage({
                conversationId:
                    conversation._id,

                senderId:
                    sender.user_id,

                content:
                    "Mensagem privada",

                createdAt:
                    new Date(
                        "2030-01-01T10:00:00.000Z"
                    ),
            });

        await assert.rejects(
            () =>
                messageService
                    .markDelivered({
                        conversationId:
                            conversation
                                ._id
                                .toString(),

                        userId:
                            outsider.user_id,

                        messageId:
                            message
                                ._id
                                .toString(),
                    }),

            error => {
                assert.equal(
                    error.statusCode,
                    403
                );

                assert.equal(
                    error.code,
                    "USER_NOT_ACTIVE_MEMBER"
                );

                return true;
            }
        );
    }
);


test(
    "BE-09 INTEGRATION: mensagem de outra conversa não pode atualizar checkpoint",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const userC =
            await createTestUser();

        const conversationA =
            await createPrivate(
                userA,
                userB
            );

        const conversationB =
            await createPrivate(
                userA,
                userC
            );

        const foreignMessage =
            await createStoredMessage({
                conversationId:
                    conversationB._id,

                senderId:
                    userA.user_id,

                content:
                    "Outra conversa",

                createdAt:
                    new Date(
                        "2030-01-01T10:00:00.000Z"
                    ),
            });

        await assert.rejects(
            () =>
                messageService
                    .markDelivered({
                        conversationId:
                            conversationA
                                ._id
                                .toString(),

                        userId:
                            userB.user_id,

                        messageId:
                            foreignMessage
                                ._id
                                .toString(),
                    }),

            error => {
                assert.equal(
                    error.statusCode,
                    404
                );

                assert.equal(
                    error.code,
                    "MESSAGE_NOT_FOUND"
                );

                return true;
            }
        );

        const membership =
            await getMembership(
                conversationA._id,
                userB.user_id
            );

        assert.equal(
            membership
                .last_delivered_message_id,

            null
        );
    }
);


/*
 * =====================================================
 * CONCORRÊNCIA
 * =====================================================
 */

test(
    "BE-09 INTEGRATION CONCURRENCY: ACKs simultâneos preservam o checkpoint mais recente",

    async () => {
        const sender =
            await createTestUser();

        const recipient =
            await createTestUser();

        const conversation =
            await createPrivate(
                sender,
                recipient
            );

        const olderMessage =
            await createStoredMessage({
                conversationId:
                    conversation._id,

                senderId:
                    sender.user_id,

                content:
                    "Mensagem concorrente antiga",

                createdAt:
                    new Date(
                        "2030-01-01T10:00:00.000Z"
                    ),
            });

        const newerMessage =
            await createStoredMessage({
                conversationId:
                    conversation._id,

                senderId:
                    sender.user_id,

                content:
                    "Mensagem concorrente nova",

                createdAt:
                    new Date(
                        "2030-01-01T10:01:00.000Z"
                    ),
            });

        await Promise.all([
            messageService
                .markDelivered({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    userId:
                        recipient.user_id,

                    messageId:
                        olderMessage
                            ._id
                            .toString(),
                }),

            messageService
                .markDelivered({
                    conversationId:
                        conversation
                            ._id
                            .toString(),

                    userId:
                        recipient.user_id,

                    messageId:
                        newerMessage
                            ._id
                            .toString(),
                }),
        ]);

        const membership =
            await getMembership(
                conversation._id,
                recipient.user_id
            );

        assert.equal(
            membership
                .last_delivered_message_id
                .toString(),

            newerMessage
                ._id
                .toString()
        );
    }
);
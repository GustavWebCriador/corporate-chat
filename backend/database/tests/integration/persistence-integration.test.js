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
    connectMongoDB
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
    assertUserActive,
} = require(
    "../../../src/services/integration/userIdentityService"
);


const {
    createPrivateConversation,
    createGroupConversation,
    createMessage,
} = require(
    "../../../src/services/integration/chatPersistenceService"
);


const {
    auditCrossDatabaseIntegrity,
} = require(
    "../../../src/services/integration/crossDatabaseIntegrityService"
);


/*
 * Dados criados exclusivamente
 * pelos testes.
 */
const testUserIds =
    new Set();

const testConversationIds =
    new Set();


async function createTestUser(
    {
        status = "ACTIVE",
        isAdmin = false,
    } = {}
) {

    const id =
        randomUUID();


    const user =
        await User.create({

            user_id:
                id,

            name:
                "PER08 Test User",

            email:
                `per08-${id.slice(0, 8)}@test.local`,

            password_hash:
                "per08-test-hash",

            status,

            is_admin:
                isAdmin,
        });


    testUserIds.add(
        user.user_id
    );


    return user;
}


before(async () => {

    await sequelize.authenticate();

    await connectMongoDB();

    await Conversation.syncIndexes();

    await ConversationMember
        .syncIndexes();

    await Message.syncIndexes();
});


async function cleanup() {

    const conversationIds =
        [
            ...testConversationIds,
        ].map(
            id =>
                new mongoose
                    .Types
                    .ObjectId(id)
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


        await Conversation
            .deleteMany({

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

                user_id: [
                    ...testUserIds,
                ],
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


test(
    "INTEGRATION: usuário ACTIVE deve ser aceito",

    async () => {

        const user =
            await createTestUser();


        const result =
            await assertUserActive(
                user.user_id
            );


        assert.equal(
            result.user_id,
            user.user_id
        );
    }
);


test(
    "INTEGRATION: usuário inexistente deve ser rejeitado",

    async () => {

        await assert.rejects(

            () =>
                assertUserActive(
                    randomUUID()
                ),

            error =>
                error.code ===
                "USER_NOT_FOUND"
        );
    }
);


test(
    "INTEGRATION: usuário INACTIVE deve ser rejeitado",

    async () => {

        const user =
            await createTestUser({
                status:
                    "INACTIVE",
            });


        await assert.rejects(

            () =>
                assertUserActive(
                    user.user_id
                ),

            error =>
                error.code ===
                "USER_INACTIVE"
        );
    }
);


test(
    "INTEGRATION: conversa privada deve usar usuários PostgreSQL válidos",

    async () => {

        const userA =
            await createTestUser();

        const userB =
            await createTestUser();


        const conversation =
            await createPrivateConversation({

                requesterId:
                    userA.user_id,

                otherUserId:
                    userB.user_id,
            });


        testConversationIds.add(
            conversation
                ._id
                .toString()
        );


        const members =
            await ConversationMember
                .find({

                    conversation_id:
                        conversation._id,
                });


        assert.equal(
            members.length,
            2
        );
    }
);


test(
    "INTEGRATION: conversa privada deve ser reutilizada",

    async () => {

        const userA =
            await createTestUser();

        const userB =
            await createTestUser();


        const first =
            await createPrivateConversation({

                requesterId:
                    userA.user_id,

                otherUserId:
                    userB.user_id,
            });


        testConversationIds.add(
            first._id.toString()
        );


        const second =
            await createPrivateConversation({

                requesterId:
                    userB.user_id,

                otherUserId:
                    userA.user_id,
            });


        assert.equal(
            first._id.toString(),
            second._id.toString()
        );
    }
);


test(
    "INTEGRATION: grupo deve rejeitar usuário INACTIVE",

    async () => {

        const creator =
            await createTestUser();

        const inactive =
            await createTestUser({
                status:
                    "INACTIVE",
            });


        await assert.rejects(

            () =>
                createGroupConversation({

                    creatorId:
                        creator.user_id,

                    memberIds: [
                        inactive.user_id,
                    ],

                    name:
                        "PER08 Group",
                }),

            error =>
                error.code ===
                "USERS_INACTIVE"
        );
    }
);


test(
    "INTEGRATION: membro ACTIVE pode enviar mensagem",

    async () => {

        const userA =
            await createTestUser();

        const userB =
            await createTestUser();


        const conversation =
            await createPrivateConversation({

                requesterId:
                    userA.user_id,

                otherUserId:
                    userB.user_id,
            });


        testConversationIds.add(
            conversation
                ._id
                .toString()
        );


        const result =
            await createMessage({

                conversationId:
                    conversation._id,

                senderId:
                    userA.user_id,

                clientMessageId:
                    `per08-${randomUUID()}`,

                content:
                    "Mensagem integração PER-08",
            });


        assert.equal(
            result.reused,
            false
        );


        assert.equal(
            result.message.sender_id,
            userA.user_id
        );
    }
);


test(
    "INTEGRATION: usuário que não pertence à conversa não pode enviar mensagem",

    async () => {

        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const outsider =
            await createTestUser();


        const conversation =
            await createPrivateConversation({

                requesterId:
                    userA.user_id,

                otherUserId:
                    userB.user_id,
            });


        testConversationIds.add(
            conversation
                ._id
                .toString()
        );


        await assert.rejects(

            () =>
                createMessage({

                    conversationId:
                        conversation._id,

                    senderId:
                        outsider.user_id,

                    clientMessageId:
                        `per08-${randomUUID()}`,

                    content:
                        "Não deveria enviar.",
                }),

            error =>
                error.code ===
                "SENDER_NOT_ACTIVE_MEMBER"
        );
    }
);


test(
    "INTEGRATION: reenvio deve reutilizar a mesma mensagem",

    async () => {

        const userA =
            await createTestUser();

        const userB =
            await createTestUser();


        const conversation =
            await createPrivateConversation({

                requesterId:
                    userA.user_id,

                otherUserId:
                    userB.user_id,
            });


        testConversationIds.add(
            conversation
                ._id
                .toString()
        );


        const clientMessageId =
            `per08-${randomUUID()}`;


        const first =
            await createMessage({

                conversationId:
                    conversation._id,

                senderId:
                    userA.user_id,

                clientMessageId,

                content:
                    "Primeiro envio",
            });


        const second =
            await createMessage({

                conversationId:
                    conversation._id,

                senderId:
                    userA.user_id,

                clientMessageId,

                content:
                    "Reenvio",
            });


        assert.equal(
            first.message
                ._id
                .toString(),

            second.message
                ._id
                .toString()
        );


        assert.equal(
            second.reused,
            true
        );
    }
);


test(
    "INTEGRATION: auditoria deve detectar referência órfã",

    async () => {

        const conversation =
            await Conversation.create({

                type:
                    "GROUP",

                name:
                    "PER08 Invalid Reference",

                created_by:
                    randomUUID(),
            });


        testConversationIds.add(
            conversation
                ._id
                .toString()
        );


        const report =
            await auditCrossDatabaseIntegrity();


        assert.equal(
            report.valid,
            false
        );


        assert.ok(
            report
                .missingUserIds
                .includes(
                    conversation
                        .created_by
                )
        );
    }
);
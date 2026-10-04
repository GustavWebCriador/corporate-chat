require("dotenv").config();

const {
    test,
    before,
    after,
    afterEach,
} = require(
    "node:test"
);

const assert =
    require(
        "node:assert/strict"
    );

const {
    randomUUID
} = require(
    "node:crypto"
);

const mongoose =
    require(
        "mongoose"
    );

const {
    Op
} = require(
    "sequelize"
);


const {
    sequelize,
    User,
    RegistrationRequest,
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
    createPrivateConversation,
} = require(
    "../../../src/services/integration/chatPersistenceService"
);


const {
    findUserForAuthentication,
    listPendingRegistrationRequests,
} = require(
    "../../../src/services/queries/postgresQueryService"
);


const {
    getLatestMessages,
    getMessageHistory,
    countUnreadMessages,
} = require(
    "../../../src/services/queries/messageQueryService"
);


const {
    listUserConversations,
} = require(
    "../../../src/services/queries/conversationQueryService"
);


/*
 * ============================================
 * DADOS TEMPORÁRIOS
 * ============================================
 */

const testUserIds =
    new Set();

const testRequestIds =
    new Set();

const testConversationIds =
    new Set();


async function createUser() {

    const id =
        randomUUID();


    const user =
        await User.create({

            user_id:
                id,

            name:
                "PER09 User",

            email:
                `per09-${id.slice(0, 8)}@test.local`,

            password_hash:
                "per09-hash",

            status:
                "ACTIVE",

            is_admin:
                false,
        });


    testUserIds.add(
        id
    );


    return user;
}


async function createPendingRequest(
    date
) {

    const id =
        randomUUID();


    const request =
        await RegistrationRequest
            .create({

                request_id:
                    id,

                name:
                    "PER09 Request",

                email:
                    `per09-request-${id.slice(0, 8)}@test.local`,

                status:
                    "PENDING",

                requested_at:
                    date,
            });


    testRequestIds.add(
        id
    );


    return request;
}


before(async () => {

    await sequelize.authenticate();

    await connectMongoDB();
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
        conversationIds.length
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


    if (
        testRequestIds.size
    ) {

        await RegistrationRequest
            .destroy({

                where: {

                    request_id: {

                        [Op.in]:
                            [
                                ...testRequestIds,
                            ],
                    },
                },
            });
    }


    if (
        testUserIds.size
    ) {

        await User.destroy({

            where: {

                user_id: {

                    [Op.in]:
                        [
                            ...testUserIds,
                        ],
                },
            },
        });
    }


    testConversationIds.clear();
    testRequestIds.clear();
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
    "QUERY: usuário deve ser localizado por e-mail normalizado",

    async () => {

        const user =
            await createUser();


        const result =
            await findUserForAuthentication(

                user.email
                    .toUpperCase()
            );


        assert.ok(
            result
        );


        assert.equal(
            result.user_id,
            user.user_id
        );
    }
);


test(
    "QUERY: solicitações PENDING devem possuir paginação por cursor",

    async () => {

        const base =
            new Date(
                "2030-01-01T12:00:00.000Z"
            );


        await createPendingRequest(
            new Date(
                base.getTime() +
                1000
            )
        );

        await createPendingRequest(
            new Date(
                base.getTime() +
                2000
            )
        );

        await createPendingRequest(
            new Date(
                base.getTime() +
                3000
            )
        );


        const first =
            await listPendingRegistrationRequests({

                limit:
                    2,
            });


        assert.equal(
            first.items.length,
            2
        );


        assert.equal(
            first.hasMore,
            true
        );


        assert.ok(
            first.nextCursor
        );


        const second =
            await listPendingRegistrationRequests({

                limit:
                    2,

                before:
                    first.nextCursor,
            });


        /*
         * Pode existir a fixture da PER-06,
         * portanto validamos ausência de
         * duplicação entre páginas.
         */

        const firstIds =
            new Set(

                first.items.map(
                    item =>
                        item.request_id
                )
            );


        for (
            const item of
            second.items
        ) {

            assert.equal(
                firstIds.has(
                    item.request_id
                ),
                false
            );
        }
    }
);


test(
    "QUERY: histórico deve carregar últimas 50 e depois mensagens anteriores",

    async () => {

        const userA =
            await createUser();

        const userB =
            await createUser();


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


        const baseDate =
            new Date(
                "2030-02-01T12:00:00.000Z"
            );


        const documents = [];


        for (
            let index = 0;
            index < 55;
            index++
        ) {

            documents.push({

                conversation_id:
                    conversation._id,

                sender_id:
                    index % 2 === 0
                        ? userA.user_id
                        : userB.user_id,

                client_message_id:
                    `per09-${randomUUID()}`,

                content:
                    `Mensagem ${index + 1}`,

                created_at:
                    new Date(
                        baseDate.getTime() +
                        (
                            index *
                            1000
                        )
                    ),
            });
        }


        await Message.insertMany(
            documents
        );


        const firstPage =
            await getLatestMessages({

                conversationId:
                    conversation._id,

                userId:
                    userA.user_id,

                limit:
                    50,
            });


        assert.equal(
            firstPage.items.length,
            50
        );


        assert.equal(
            firstPage.hasMore,
            true
        );


        assert.ok(
            firstPage.nextCursor
        );


        const secondPage =
            await getMessageHistory({

                conversationId:
                    conversation._id,

                userId:
                    userA.user_id,

                limit:
                    50,

                before:
                    firstPage.nextCursor,
            });


        assert.equal(
            secondPage.items.length,
            5
        );


        assert.equal(
            secondPage.hasMore,
            false
        );


        const firstIds =
            new Set(

                firstPage.items.map(
                    message =>
                        message
                            ._id
                            .toString()
                )
            );


        for (
            const message of
            secondPage.items
        ) {

            assert.equal(
                firstIds.has(
                    message
                        ._id
                        .toString()
                ),
                false
            );
        }
    }
);


test(
    "QUERY: conversas devem ser listadas para membro ACTIVE",

    async () => {

        const userA =
            await createUser();

        const userB =
            await createUser();

        const userC =
            await createUser();


        const first =
            await createPrivateConversation({

                requesterId:
                    userA.user_id,

                otherUserId:
                    userB.user_id,
            });


        const second =
            await createPrivateConversation({

                requesterId:
                    userA.user_id,

                otherUserId:
                    userC.user_id,
            });


        testConversationIds.add(
            first._id.toString()
        );

        testConversationIds.add(
            second._id.toString()
        );


        const conversations =
            await listUserConversations({

                userId:
                    userA.user_id,
            });


        const ids =
            conversations.map(
                conversation =>
                    conversation
                        ._id
                        .toString()
            );


        assert.ok(
            ids.includes(
                first._id.toString()
            )
        );


        assert.ok(
            ids.includes(
                second._id.toString()
            )
        );
    }
);


test(
    "QUERY: contador deve retornar somente mensagens não lidas recebidas",

    async () => {

        const userA =
            await createUser();

        const userB =
            await createUser();


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


        const base =
            new Date(
                "2030-03-01T12:00:00.000Z"
            );


        const messages =
            await Message.insertMany([

                {
                    conversation_id:
                        conversation._id,

                    sender_id:
                        userB.user_id,

                    client_message_id:
                        `per09-${randomUUID()}`,

                    content:
                        "Mensagem 1",

                    created_at:
                        new Date(
                            base.getTime() +
                            1000
                        ),
                },

                {
                    conversation_id:
                        conversation._id,

                    sender_id:
                        userA.user_id,

                    client_message_id:
                        `per09-${randomUUID()}`,

                    content:
                        "Mensagem própria",

                    created_at:
                        new Date(
                            base.getTime() +
                            2000
                        ),
                },

                {
                    conversation_id:
                        conversation._id,

                    sender_id:
                        userB.user_id,

                    client_message_id:
                        `per09-${randomUUID()}`,

                    content:
                        "Mensagem 3",

                    created_at:
                        new Date(
                            base.getTime() +
                            3000
                        ),
                },
            ]);


        /*
         * User A leu até a primeira.
         */
        await ConversationMember
            .updateOne(

                {
                    conversation_id:
                        conversation._id,

                    user_id:
                        userA.user_id,
                },

                {
                    $set: {

                        last_read_message_id:
                            messages[0]._id,

                        last_read_at:
                            messages[0]
                                .created_at,
                    },
                }
            );


        const unread =
            await countUnreadMessages({

                conversationId:
                    conversation._id,

                userId:
                    userA.user_id,
            });


        /*
         * Mensagem 2:
         * enviada pelo próprio A → não conta.
         *
         * Mensagem 3:
         * enviada por B → não lida.
         */
        assert.equal(
            unread,
            1
        );
    }
);
require("dotenv").config();

const mongoose =
    require("mongoose");

const {
    Op
} =
    require("sequelize");

const {
    sequelize,
    User,
    RegistrationRequest,
} =
    require(
        "../src/models/postgres"
    );

const { connectMongoDB } = require("../src/config/db/mongodb");

const Conversation =
    require(
        "../src/models/mongodb/Conversation"
    );

const ConversationMember =
    require(
        "../src/models/mongodb/ConversationMember"
    );

const Message =
    require(
        "../src/models/mongodb/Message"
    );

const {
    users,
    registrationRequests,
    mongoIds,
} =
    require(
        "./shared/dev-fixtures"
    );


async function verify() {

    try {

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            " Development Seed Verification"
        );

        console.log(
            "========================================"
        );


        /*
         * POSTGRESQL
         */
        await sequelize.authenticate();


        const expectedUserIds =
            Object.values(users)
                .map(
                    user =>
                        user.user_id
                );


        const postgresUsers =
            await User.findAll({

                where: {

                    user_id: {
                        [Op.in]:
                            expectedUserIds,
                    },
                },
            });


        if (
            postgresUsers.length !==
            expectedUserIds.length
        ) {

            throw new Error(
                "Usuários DEV PostgreSQL incompletos."
            );
        }


        console.log(
            `[POSTGRES] Users: ${postgresUsers.length}/${expectedUserIds.length} OK`
        );


        const expectedRequestIds =
            Object.values(
                registrationRequests
            )
                .map(
                    request =>
                        request.request_id
                );


        const requests =
            await RegistrationRequest
                .findAll({

                    where: {

                        request_id: {
                            [Op.in]:
                                expectedRequestIds,
                        },
                    },
                });


        if (
            requests.length !==
            expectedRequestIds.length
        ) {

            throw new Error(
                "Registration requests DEV incompletas."
            );
        }


        console.log(
            `[POSTGRES] Requests: ${requests.length}/${expectedRequestIds.length} OK`
        );


        /*
         * MONGODB
         */
        await connectMongoDB();


        const conversationIds = [

            new mongoose.Types.ObjectId(
                mongoIds
                    .conversations
                    .private
            ),

            new mongoose.Types.ObjectId(
                mongoIds
                    .conversations
                    .group
            ),
        ];


        const conversationCount =
            await Conversation
                .countDocuments({

                    _id: {
                        $in:
                            conversationIds,
                    },
                });


        if (
            conversationCount !== 2
        ) {

            throw new Error(
                "Conversas DEV incompletas."
            );
        }


        console.log(
            "[MONGODB] Conversations: 2/2 OK"
        );
        /*
 * Verifica se todas as conversas DEV
 * possuem o usuário criador.
 */
        const conversationsWithCreator =
            await Conversation.countDocuments({

                _id: {
                    $in:
                        conversationIds,
                },

                created_by: {
                    $exists:
                        true,

                    $nin: [
                        null,
                        "",
                    ],
                },
            });


        if (
            conversationsWithCreator !==
            conversationIds.length
        ) {

            throw new Error(
                "Existem conversas DEV sem created_by."
            );
        }


        console.log(
            "[MONGODB] Conversation creators: OK"
        );


        const memberCount =
            await ConversationMember
                .countDocuments({

                    conversation_id: {
                        $in:
                            conversationIds,
                    },
                });


        if (
            memberCount !== 6
        ) {

            throw new Error(
                `Quantidade de membros inválida: ${memberCount}`
            );
        }


        console.log(
            "[MONGODB] Members: 6/6 OK"
        );



        /*
         * Verifica as cinco mensagens originais
         * da massa de desenvolvimento PER-06.
         *
         * Mensagens adicionais criadas durante
         * o uso da aplicação são permitidas.
         */
        const expectedSeedMessages = [
            ["private1", conversationIds[0]],
            ["private2", conversationIds[0]],
            ["group1", conversationIds[1]],
            ["group2", conversationIds[1]],
            ["group3", conversationIds[1]],
        ];

        const seedMessageCount = await Message.countDocuments({
            $or: expectedSeedMessages.map(
                ([messageKey, conversationId]) => ({
                    _id: new mongoose.Types.ObjectId(
                        mongoIds.messages[messageKey]
                    ),
                    conversation_id: conversationId,
                })
            ),
        });

        if (seedMessageCount !== expectedSeedMessages.length) {
            throw new Error(
                "Mensagens originais do seed incompletas ou em conversas incorretas."
            );
        }

        const totalMessageCount = await Message.countDocuments({
            conversation_id: {
                $in: conversationIds,
            },
        });

        console.log(
            `[MONGODB] Seed messages: ${seedMessageCount}/${expectedSeedMessages.length} OK`
        );

        console.log(
            `[MONGODB] Total messages in DEV conversations: ${totalMessageCount}`
        );



        /*
         * Validação PostgreSQL ↔ MongoDB
         */

        const memberUserIds =
            await ConversationMember
                .distinct(
                    "user_id",

                    {
                        conversation_id: {
                            $in:
                                conversationIds,
                        },
                    }
                );


        const senderIds =
            await Message
                .distinct(
                    "sender_id",

                    {
                        conversation_id: {
                            $in:
                                conversationIds,
                        },
                    }
                );


        const creatorIds =
            await Conversation
                .distinct(
                    "created_by",

                    {
                        _id: {
                            $in:
                                conversationIds,
                        },
                    }
                );


        const mongoUserIds =
            new Set([
                ...memberUserIds,
                ...senderIds,
                ...creatorIds,
            ]);


        const postgresUserIds =
            new Set(
                postgresUsers.map(
                    user =>
                        user.user_id
                )
            );


        const invalidReferences =
            [
                ...mongoUserIds,
            ]
                .filter(
                    id =>
                        !postgresUserIds.has(
                            id
                        )
                );


        if (
            invalidReferences.length > 0
        ) {

            throw new Error(
                `UUID MongoDB sem usuário PostgreSQL: ${invalidReferences.join(", ")}`
            );
        }


        console.log(
            "[INTEGRATION] PostgreSQL ↔ MongoDB UUID references: OK"
        );


        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            " Development seed: VALID"
        );

        console.log(
            "========================================"
        );


    } catch (error) {

        console.error("");
        console.error(
            "Development seed: INVALID"
        );

        console.error(
            error.message
        );

        process.exitCode = 1;


    } finally {

        await mongoose.disconnect();

        await sequelize.close();
    }
}


verify();
require("dotenv").config();

const mongoose =
    require("mongoose");


const {
    sequelize
} = require(
    "../src/config/db/postgres"
);


const {
    connectMongoDB
} = require(
    "../src/config/db/mongodb"
);


const {
    users,
    registrationRequests,
    mongoIds,
} = require(
    "./shared/dev-fixtures"
);


const {
    findUserForAuthentication,
    listPendingRegistrationRequests,
} = require(
    "../src/services/queries/postgresQueryService"
);


const {
    getLatestMessages,
    countUnreadMessages,
} = require(
    "../src/services/queries/messageQueryService"
);


const {
    listUserConversations,
} = require(
    "../src/services/queries/conversationQueryService"
);


async function verify() {

    try {

        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            " Corporate Chat - Critical Queries"
        );

        console.log(
            "========================================"
        );


        await sequelize.authenticate();

        await connectMongoDB();


        /*
         * =====================================
         * USER AUTH QUERY
         * =====================================
         */

        const user =
            await findUserForAuthentication(
                users
                    .gustavo
                    .email
            );


        if (!user) {

            throw new Error(
                "Usuário DEV não encontrado."
            );
        }


        console.log(
            "[QUERY] User by email: OK"
        );


        /*
         * =====================================
         * PENDING REQUESTS
         * =====================================
         */

        const pending =
            await listPendingRegistrationRequests({

                limit:
                    20,
            });


        const expectedPending =
            pending.items.some(
                item =>
                    item.request_id ===
                    registrationRequests
                        .pending
                        .request_id
            );


        if (!expectedPending) {

            throw new Error(
                "Solicitação PENDING DEV não encontrada."
            );
        }


        console.log(
            "[QUERY] Pending requests: OK"
        );


        /*
         * =====================================
         * USER CONVERSATIONS
         * =====================================
         */

        const conversations =
            await listUserConversations({

                userId:
                    users
                        .gustavo
                        .user_id,
            });


        if (
            conversations.length <
            2
        ) {

            throw new Error(
                "Conversas DEV incompletas."
            );
        }


        console.log(
            `[QUERY] User conversations: ${conversations.length} OK`
        );


        /*
         * =====================================
         * PRIVATE HISTORY
         * =====================================
         */

        const history =
            await getLatestMessages({

                conversationId:
                    mongoIds
                        .conversations
                        .private,

                userId:
                    users
                        .gustavo
                        .user_id,

                limit:
                    50,
            });


        if (
            history.items.length !==
            2
        ) {

            throw new Error(
                "Histórico PRIVATE DEV inválido."
            );
        }


        console.log(
            "[QUERY] Latest messages: 2/2 OK"
        );


        /*
         * =====================================
         * UNREAD
         *
         * Na fixture da PER-06,
         * Eduardo leu até groupMessage2.
         * groupMessage3 foi enviada por Mauricio.
         *
         * Portanto unread = 1.
         * =====================================
         */

        const unread =
            await countUnreadMessages({

                conversationId:
                    mongoIds
                        .conversations
                        .group,

                userId:
                    users
                        .eduardo
                        .user_id,
            });


        if (
            unread !==
            1
        ) {

            throw new Error(
                `Unread esperado: 1. Encontrado: ${unread}`
            );
        }


        console.log(
            "[QUERY] Unread messages: 1/1 OK"
        );


        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            " Critical persistence queries: VALID"
        );

        console.log(
            "========================================"
        );


    } catch (error) {

        console.error("");

        console.error(
            "Critical persistence queries: FAILED"
        );

        console.error(
            error
        );

        process.exitCode =
            1;


    } finally {

        await mongoose.disconnect();

        await sequelize.close();
    }
}


verify();
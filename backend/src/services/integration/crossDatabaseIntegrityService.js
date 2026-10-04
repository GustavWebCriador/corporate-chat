const {
    Op
} = require("sequelize");


const {
    User
} = require(
    "../../models/postgres"
);


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
    PersistenceIntegrationError
} = require(
    "./userIdentityService"
);


/*
 * Coleta todas as referências
 * de usuários existentes no MongoDB.
 */
async function collectMongoUserReferences() {

    const [
        creatorIds,
        memberIds,
        removedByIds,
        senderIds,
    ] =
        await Promise.all([

            Conversation.distinct(
                "created_by"
            ),

            ConversationMember.distinct(
                "user_id"
            ),

            ConversationMember.distinct(
                "removed_by",
                {
                    removed_by: {
                        $nin: [
                            null,
                            "",
                        ],
                    },
                }
            ),

            Message.distinct(
                "sender_id"
            ),
        ]);


    return {

        conversations_created_by:
            creatorIds.filter(Boolean),

        conversation_members_user_id:
            memberIds.filter(Boolean),

        conversation_members_removed_by:
            removedByIds.filter(Boolean),

        messages_sender_id:
            senderIds.filter(Boolean),
    };
}


/*
 * Audita todas as referências.
 *
 * Importante:
 *
 * Aqui exigimos que o usuário EXISTA.
 *
 * Não exigimos ACTIVE.
 *
 * Por quê?
 *
 * Porque um usuário INACTIVE pode ter
 * histórico antigo no MongoDB.
 */
async function auditCrossDatabaseIntegrity() {

    const references =
        await collectMongoUserReferences();


    const allIds =
        [
            ...new Set([
                ...references
                    .conversations_created_by,

                ...references
                    .conversation_members_user_id,

                ...references
                    .conversation_members_removed_by,

                ...references
                    .messages_sender_id,
            ]),
        ];


    if (
        allIds.length === 0
    ) {

        return {

            valid:
                true,

            totalReferences:
                0,

            referencedUsers:
                0,

            missingUserIds:
                [],

            references,
        };
    }


    const postgresUsers =
        await User.findAll({

            attributes: [
                "user_id",
                "status",
            ],

            where: {

                user_id: {

                    [Op.in]:
                        allIds,
                },
            },

            raw:
                true,
        });


    const postgresIds =
        new Set(

            postgresUsers.map(
                user =>
                    user.user_id
            )
        );


    const missingUserIds =
        allIds.filter(
            id =>
                !postgresIds.has(id)
        );


    return {

        valid:
            missingUserIds.length ===
            0,

        totalReferences:
            allIds.length,

        referencedUsers:
            postgresUsers.length,

        missingUserIds,

        references,
    };
}


/*
 * Versão que lança erro
 * quando encontra inconsistência.
 */
async function assertCrossDatabaseIntegrity() {

    const report =
        await auditCrossDatabaseIntegrity();


    if (!report.valid) {

        throw new PersistenceIntegrationError(

            "CROSS_DATABASE_INTEGRITY_ERROR",

            "MongoDB possui referências para usuários inexistentes no PostgreSQL.",

            {
                missing_user_ids:
                    report
                        .missingUserIds,
            }
        );
    }


    return report;
}


module.exports = {

    collectMongoUserReferences,

    auditCrossDatabaseIntegrity,

    assertCrossDatabaseIntegrity,
};
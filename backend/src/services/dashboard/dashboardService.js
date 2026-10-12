const AppError =
    require(
        "../../errors/AppError"
    );


const {
    createUserRepository,
} = require(
    "../../repositories/postgres/userRepository"
);


const {
    listUserConversations,
} = require(
    "../queries/conversationQueryService"
);


const DEFAULT_LIMIT =
    50;

const MAX_LIMIT =
    100;


/*
 * =====================================================
 * VALIDAÇÃO
 * =====================================================
 */

function validateDashboardQuery(
    query
) {

    const params =
        query &&
        typeof query === "object" &&
        !Array.isArray(query)
            ? query
            : {};


    if (
        params.limit ===
        undefined
    ) {

        return {
            limit:
                DEFAULT_LIMIT,
        };
    }


    const valid =
        typeof params.limit ===
            "string" &&
        /^\d+$/.test(
            params.limit
        ) &&
        Number(
            params.limit
        ) >= 1 &&
        Number(
            params.limit
        ) <=
            MAX_LIMIT;


    if (!valid) {

        throw AppError.badRequest(

            "Parâmetros do dashboard inválidos.",

            "VALIDATION_ERROR",

            [
                {
                    field:
                        "limit",

                    message:
                        `Informe um número inteiro entre 1 e ${MAX_LIMIT}.`,
                },
            ]
        );
    }


    return {
        limit:
            Number(
                params.limit
            ),
    };
}


/*
 * =====================================================
 * SERIALIZAÇÃO
 * =====================================================
 */

/**
 * Converte um identificador para string.
 *
 * Funciona tanto com ObjectId do MongoDB
 * quanto com strings utilizadas nos testes.
 */
function serializeId(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return null;
    }


    return value.toString();
}


/**
 * Representação pública de um contato.
 *
 * Nunca expõe:
 * - password_hash
 * - is_admin
 * - timestamps administrativos
 */
function toContact(
    user
) {

    return {

        user_id:
            user.user_id,

        name:
            user.name,

        email:
            user.email,

        status:
            user.status,
    };
}


/**
 * Representação segura da última mensagem.
 *
 * Não retorna:
 * - conversation_id
 * - client_message_id
 * - campos internos do Mongoose
 */
function toLastMessage(
    message
) {

    if (!message) {

        return null;
    }


    return {

        message_id:
            serializeId(
                message._id
            ),

        sender_id:
            message.sender_id,

        content:
            message.content,

        created_at:
            message.created_at,
    };
}


/*
 * =====================================================
 * ERROS DE CONSISTÊNCIA
 * =====================================================
 */

function dashboardDataInconsistent() {

    return new AppError(

        "Não foi possível montar os dados do dashboard.",

        {
            statusCode:
                500,

            code:
                "DASHBOARD_DATA_INCONSISTENT",
        }
    );
}


/*
 * =====================================================
 * SERVICE
 * =====================================================
 */

function createDashboardService({

    userRepository =
        createUserRepository(),

    listConversations =
        listUserConversations,

} = {}) {


    /**
     * Retorna os dados necessários
     * para montar o dashboard.
     *
     * O userId sempre deve vir do
     * usuário autenticado.
     */
    async function getDashboard({

        userId,

        query = {},

    }) {

        if (!userId) {

            throw dashboardDataInconsistent();
        }


        const {
            limit,
        } =
            validateDashboardQuery(
                query
            );


        /*
         * PostgreSQL e MongoDB podem
         * ser consultados em paralelo.
         */
        const [
            contacts,
            conversations,
        ] =
            await Promise.all([

                userRepository
                    .findActiveContacts({

                        excludeUserId:
                            userId,
                    }),

                listConversations({

                    userId,

                    limit,
                }),
            ]);


        /*
         * Coleta os UUIDs PostgreSQL
         * presentes nas conversas.
         */
        const participantUserIds = [

            ...new Set(

                conversations
                    .flatMap(

                        conversation =>
                            Array.isArray(
                                conversation
                                    .participant_user_ids
                            )

                                ? conversation
                                    .participant_user_ids

                                : []
                    )
            ),
        ];


        /*
         * Resolve os UUIDs MongoDB →
         * usuários PostgreSQL.
         */
        const conversationUsers =
            await userRepository
                .findPublicByIds(
                    participantUserIds
                );


        const userMap =
            new Map(

                conversationUsers.map(
                    user => [

                        user.user_id,

                        user,
                    ]
                )
            );


        /*
         * DTO seguro para o frontend.
         */
        const dashboardConversations =
            conversations.map(

                conversation => {

                    const conversationId =
                        serializeId(
                            conversation._id
                        );


                    let contact =
                        null;


                    /*
                     * Em PRIVATE precisamos
                     * identificar o outro usuário.
                     */
                    if (
                        conversation.type ===
                        "PRIVATE"
                    ) {

                        const otherUserId =
                            (
                                conversation
                                    .participant_user_ids ||
                                []
                            )
                                .find(
                                    participantId =>
                                        participantId !==
                                        userId
                                );


                        if (!otherUserId) {

                            throw dashboardDataInconsistent();
                        }


                        const otherUser =
                            userMap.get(
                                otherUserId
                            );


                        if (!otherUser) {

                            throw dashboardDataInconsistent();
                        }


                        contact =
                            toContact(
                                otherUser
                            );
                    }


                    return {

                        conversation_id:
                            conversationId,

                        type:
                            conversation.type,

                        /*
                         * GROUP possui nome.
                         * PRIVATE utiliza o contato.
                         */
                        name:
                            conversation.type ===
                            "GROUP"

                                ? conversation.name

                                : null,

                        contact,

                        membership: {

                            role:
                                conversation
                                    .membership
                                    ?.role ??
                                null,
                        },

                        last_message:
                            toLastMessage(
                                conversation
                                    .last_message
                            ),

                        last_message_at:
                            conversation
                                .last_message_at ??
                            null,

                        created_at:
                            conversation
                                .created_at,
                    };
                }
            );


        return {

            contacts:
                contacts.map(
                    toContact
                ),

            conversations:
                dashboardConversations,
        };
    }


    return {

        getDashboard,
    };
}


module.exports = {

    createDashboardService,

    dashboardService:
        createDashboardService(),
};
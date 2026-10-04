const {
    Op
} = require("sequelize");

const {
    User
} = require(
    "../../models/postgres"
);


/*
 * Erro específico da camada
 * de integração de persistência.
 */
class PersistenceIntegrationError
    extends Error {

    constructor(
        code,
        message,
        details = {}
    ) {

        super(message);

        this.name =
            "PersistenceIntegrationError";

        this.code =
            code;

        this.details =
            details;
    }
}


/*
 * Busca usuário pelo UUID.
 *
 * Não verifica status.
 */
async function getUserById(
    userId
) {

    const user =
        await User.findByPk(
            userId
        );


    if (!user) {

        throw new PersistenceIntegrationError(

            "USER_NOT_FOUND",

            `Usuário ${userId} não encontrado no PostgreSQL.`,

            {
                user_id:
                    userId,
            }
        );
    }


    return user;
}


/*
 * Verifica se o usuário:
 *
 * 1. existe;
 * 2. está ACTIVE.
 */
async function assertUserActive(
    userId
) {

    const user =
        await getUserById(
            userId
        );


    if (
        user.status !==
        "ACTIVE"
    ) {

        throw new PersistenceIntegrationError(

            "USER_INACTIVE",

            `Usuário ${userId} está inativo.`,

            {
                user_id:
                    userId,

                status:
                    user.status,
            }
        );
    }


    return user;
}


/*
 * Valida vários usuários
 * de uma única vez.
 *
 * Muito melhor do que fazer:
 *
 * SELECT user 1
 * SELECT user 2
 * SELECT user 3
 * ...
 */
async function assertUsersActive(
    userIds
) {

    const ids =
        [
            ...new Set(
                userIds.filter(
                    Boolean
                )
            ),
        ];


    if (
        ids.length === 0
    ) {

        return [];
    }


    const users =
        await User.findAll({

            where: {

                user_id: {

                    [Op.in]:
                        ids,
                },
            },
        });


    const userMap =
        new Map(

            users.map(
                user => [
                    user.user_id,
                    user,
                ]
            )
        );


    const missingIds =
        ids.filter(
            id =>
                !userMap.has(id)
        );


    if (
        missingIds.length > 0
    ) {

        throw new PersistenceIntegrationError(

            "USERS_NOT_FOUND",

            "Existem usuários não cadastrados no PostgreSQL.",

            {
                user_ids:
                    missingIds,
            }
        );
    }


    const inactiveUsers =
        users.filter(
            user =>
                user.status !==
                "ACTIVE"
        );


    if (
        inactiveUsers.length > 0
    ) {

        throw new PersistenceIntegrationError(

            "USERS_INACTIVE",

            "Existem usuários inativos.",

            {
                user_ids:
                    inactiveUsers.map(
                        user =>
                            user.user_id
                    ),
            }
        );
    }


    return users;
}


module.exports = {

    PersistenceIntegrationError,

    getUserById,

    assertUserActive,

    assertUsersActive,
};
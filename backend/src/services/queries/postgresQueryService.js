const {
    Op
} = require(
    "sequelize"
);


const {
    User,
    RegistrationRequest,
} = require(
    "../../models/postgres"
);


const {
    normalizeLimit,
    encodeCursor,
    decodeCursor,
} = require(
    "./queryCursor"
);


/*
 * ============================================
 * USUÁRIO PARA AUTENTICAÇÃO
 * ============================================
 */

async function findUserForAuthentication(
    email
) {

    if (
        !email ||
        typeof email !==
        "string"
    ) {

        return null;
    }


    const normalizedEmail =
        email
            .trim()
            .toLowerCase();


    return User.findOne({

        where: {

            email:
                normalizedEmail,
        },
    });
}


/*
 * ============================================
 * SOLICITAÇÕES PENDENTES
 * ============================================
 */

async function listPendingRegistrationRequests(
    {
        limit = 20,
        before = null,
    } = {}
) {

    const pageSize =
        normalizeLimit(
            limit,
            20,
            100
        );


    const cursor =
        decodeCursor(
            before
        );


    const where = {

        status:
            "PENDING",
    };


    if (cursor) {

        where[
            Op.or
        ] = [

            {
                requested_at: {

                    [Op.lt]:
                        cursor.timestamp,
                },
            },

            {
                requested_at:
                    cursor.timestamp,

                request_id: {

                    [Op.lt]:
                        cursor.id,
                },
            },
        ];
    }


    const rows =
        await RegistrationRequest
            .findAll({

                where,

                order: [

                    [
                        "requested_at",
                        "DESC",
                    ],

                    [
                        "request_id",
                        "DESC",
                    ],
                ],

                limit:
                    pageSize + 1,
            });


    const hasMore =
        rows.length >
        pageSize;


    const page =
        rows.slice(
            0,
            pageSize
        );


    let nextCursor =
        null;


    if (
        hasMore &&
        page.length > 0
    ) {

        const last =
            page[
                page.length - 1
            ];


        nextCursor =
            encodeCursor({

                timestamp:
                    last.requested_at,
                id:
                    last.request_id,
            });
    }


    return {

        items:
            page,
        hasMore,
        nextCursor,
    };
}


module.exports = {

    findUserForAuthentication,
    listPendingRegistrationRequests,
};
require("dotenv").config();

const {
    test,
    before,
    after,
} = require("node:test");

const assert =
    require("node:assert/strict");

const {
    randomUUID,
} = require("node:crypto");

const {
    sequelize,
} = require(
    "../../../src/config/db/postgres"
);


/*
 * ============================================
 * SETUP / TEARDOWN
 * ============================================
 */

before(async () => {

    await sequelize.authenticate();

});


after(async () => {

    await sequelize.close();

});


/*
 * Cada teste PostgreSQL roda dentro
 * de uma transaction.
 *
 * Ao final fazemos ROLLBACK.
 *
 * Portanto os testes NÃO deixam
 * sujeira no banco de desenvolvimento.
 */
async function withTransaction(
    callback
) {

    const transaction =
        await sequelize.transaction();

    try {

        await callback(
            transaction
        );

    } finally {

        await transaction.rollback();

    }
}


/*
 * ============================================
 * HELPERS
 * ============================================
 */

function createEmail(
    prefix = "user"
) {

    const suffix =
        randomUUID()
            .slice(0, 8);

    return (
        `per07-${prefix}-${suffix}` +
        "@test.local"
    );
}


async function insertUser(
    transaction,
    overrides = {}
) {

    const data = {

        user_id:
            randomUUID(),

        name:
            "PER07 Test User",

        email:
            createEmail(),

        password_hash:
            "per07-test-hash",

        status:
            "ACTIVE",

        is_admin:
            false,

        ...overrides,
    };


    await sequelize.query(
        `
        INSERT INTO users (
            user_id,
            name,
            email,
            password_hash,
            status,
            is_admin,
            created_at,
            updated_at
        )
        VALUES (
            :user_id,
            :name,
            :email,
            :password_hash,
            :status,
            :is_admin,
            NOW(),
            NOW()
        );
        `,

        {
            replacements:
                data,

            transaction,
        }
    );


    return data;
}


async function insertRequest(
    transaction,
    overrides = {}
) {

    const data = {

        request_id:
            randomUUID(),

        name:
            "PER07 Request",

        email:
            createEmail(
                "request"
            ),

        status:
            "PENDING",

        reviewed_at:
            null,

        reviewed_by:
            null,

        rejection_reason:
            null,

        created_user_id:
            null,

        ...overrides,
    };


    await sequelize.query(
        `
        INSERT INTO registration_requests (
            request_id,
            name,
            email,
            status,
            requested_at,
            reviewed_at,
            reviewed_by,
            rejection_reason,
            created_user_id
        )
        VALUES (
            :request_id,
            :name,
            :email,
            :status,
            NOW(),
            :reviewed_at,
            :reviewed_by,
            :rejection_reason,
            :created_user_id
        );
        `,

        {
            replacements:
                data,

            transaction,
        }
    );


    return data;
}


/*
 * Códigos PostgreSQL:
 *
 * 23505 = UNIQUE violation
 * 23514 = CHECK violation
 * 23503 = FOREIGN KEY violation
 */
async function expectPostgresError(
    action,
    expectedCode
) {

    await assert.rejects(
        action,

        (error) => {

            const code =
                error?.original?.code ??
                error?.parent?.code;


            assert.equal(
                code,
                expectedCode
            );


            return true;
        }
    );
}


/*
 * ============================================
 * USERS
 * ============================================
 */


test(
    "POSTGRES: usuário válido deve ser aceito",

    async () => {

        await withTransaction(
            async (
                transaction
            ) => {

                const user =
                    await insertUser(
                        transaction
                    );


                const [
                    rows
                ] =
                    await sequelize.query(
                        `
                        SELECT user_id
                        FROM users
                        WHERE user_id = :user_id;
                        `,

                        {
                            replacements: {
                                user_id:
                                    user.user_id,
                            },

                            transaction,
                        }
                    );


                assert.equal(
                    rows.length,
                    1
                );
            }
        );
    }
);


test(
    "POSTGRES: status inválido de usuário deve ser rejeitado",

    async () => {

        await withTransaction(
            async (
                transaction
            ) => {

                await expectPostgresError(

                    () =>
                        insertUser(
                            transaction,
                            {
                                status:
                                    "BLOCKED",
                            }
                        ),

                    "23514"
                );
            }
        );
    }
);


test(
    "POSTGRES: e-mail duplicado deve ser rejeitado",

    async () => {

        await withTransaction(
            async (
                transaction
            ) => {

                const email =
                    createEmail(
                        "duplicate"
                    );


                await insertUser(
                    transaction,
                    {
                        email,
                    }
                );


                await expectPostgresError(

                    () =>
                        insertUser(
                            transaction,
                            {
                                email,
                            }
                        ),

                    "23505"
                );
            }
        );
    }
);


/*
 * ============================================
 * REGISTRATION_REQUESTS
 * ============================================
 */


test(
    "POSTGRES: solicitação PENDING válida deve ser aceita",

    async () => {

        await withTransaction(
            async (
                transaction
            ) => {

                await insertRequest(
                    transaction
                );
            }
        );
    }
);


test(
    "POSTGRES: solicitação APPROVED válida deve ser aceita",

    async () => {

        await withTransaction(
            async (
                transaction
            ) => {

                const admin =
                    await insertUser(
                        transaction,
                        {
                            is_admin:
                                true,
                        }
                    );


                const createdUser =
                    await insertUser(
                        transaction
                    );


                await insertRequest(
                    transaction,
                    {
                        status:
                            "APPROVED",

                        reviewed_at:
                            new Date(),

                        reviewed_by:
                            admin.user_id,

                        created_user_id:
                            createdUser.user_id,
                    }
                );
            }
        );
    }
);


test(
    "POSTGRES: APPROVED sem revisão deve ser rejeitado",

    async () => {

        await withTransaction(
            async (
                transaction
            ) => {

                await expectPostgresError(

                    () =>
                        insertRequest(
                            transaction,
                            {
                                status:
                                    "APPROVED",

                                reviewed_at:
                                    null,

                                reviewed_by:
                                    null,
                            }
                        ),

                    "23514"
                );
            }
        );
    }
);


test(
    "POSTGRES: REJECTED sem motivo deve ser rejeitado",

    async () => {

        await withTransaction(
            async (
                transaction
            ) => {

                const admin =
                    await insertUser(
                        transaction,
                        {
                            is_admin:
                                true,
                        }
                    );


                await expectPostgresError(

                    () =>
                        insertRequest(
                            transaction,
                            {
                                status:
                                    "REJECTED",

                                reviewed_at:
                                    new Date(),

                                reviewed_by:
                                    admin.user_id,

                                rejection_reason:
                                    null,
                            }
                        ),

                    "23514"
                );
            }
        );
    }
);


test(
    "POSTGRES: reviewed_by inexistente deve ser rejeitado",

    async () => {

        await withTransaction(
            async (
                transaction
            ) => {

                await expectPostgresError(

                    () =>
                        insertRequest(
                            transaction,
                            {
                                reviewed_by:
                                    randomUUID(),
                            }
                        ),

                    "23503"
                );
            }
        );
    }
);


test(
    "POSTGRES: usuário referenciado não pode ser removido fisicamente",

    async () => {

        await withTransaction(
            async (
                transaction
            ) => {

                const admin =
                    await insertUser(
                        transaction,
                        {
                            is_admin:
                                true,
                        }
                    );


                await insertRequest(
                    transaction,
                    {
                        status:
                            "REJECTED",

                        reviewed_at:
                            new Date(),

                        reviewed_by:
                            admin.user_id,

                        rejection_reason:
                            "PER07 test",
                    }
                );


                await expectPostgresError(

                    () =>
                        sequelize.query(
                            `
                            DELETE
                            FROM users
                            WHERE user_id = :user_id;
                            `,

                            {
                                replacements: {
                                    user_id:
                                        admin.user_id,
                                },

                                transaction,
                            }
                        ),

                    "23503"
                );
            }
        );
    }
);

/*
 * ============================================
 * PER-02 — ALINHAMENTO AO DER v1.3
 * ============================================
 *
 * 22001 = string_data_right_truncation
 */

function emailWithLength(length) {

    const domain = "@test.local";

    return (
        "a".repeat(length - domain.length) +
        domain
    );
}


test(
    "POSTGRES: e-mail com 150 caracteres deve ser aceito em users e registration_requests",

    async () => {

        await withTransaction(
            async (transaction) => {

                const email =
                    emailWithLength(150);

                await insertUser(
                    transaction,
                    { email }
                );

                await insertRequest(
                    transaction,
                    { email }
                );
            }
        );
    }
);


test(
    "POSTGRES: e-mail com 151 caracteres deve ser rejeitado em users",

    async () => {

        await withTransaction(
            async (transaction) => {

                await expectPostgresError(
                    () =>
                        insertUser(
                            transaction,
                            {
                                email:
                                    emailWithLength(151),
                            }
                        ),
                    "22001"
                );
            }
        );
    }
);


test(
    "POSTGRES: e-mail com 151 caracteres deve ser rejeitado em registration_requests",

    async () => {

        await withTransaction(
            async (transaction) => {

                await expectPostgresError(
                    () =>
                        insertRequest(
                            transaction,
                            {
                                email:
                                    emailWithLength(151),
                            }
                        ),
                    "22001"
                );
            }
        );
    }
);


test(
    "POSTGRES: REJECTED sem reviewed_by deve ser rejeitado",

    async () => {

        await withTransaction(
            async (transaction) => {

                await expectPostgresError(
                    () =>
                        insertRequest(
                            transaction,
                            {
                                status:
                                    "REJECTED",
                                reviewed_at:
                                    new Date(),
                                rejection_reason:
                                    "Motivo de teste",
                            }
                        ),
                    "23514"
                );
            }
        );
    }
);


test(
    "POSTGRES: created_user_id inexistente deve ser rejeitado",

    async () => {

        await withTransaction(
            async (transaction) => {

                await expectPostgresError(
                    () =>
                        insertRequest(
                            transaction,
                            {
                                created_user_id:
                                    randomUUID(),
                            }
                        ),
                    "23503"
                );
            }
        );
    }
);

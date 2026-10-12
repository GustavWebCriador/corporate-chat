"use strict";

module.exports = {

    async up(queryInterface) {

        await queryInterface.bulkInsert(
            "users",
            [
                {
                    user_id:
                        "11111111-1111-4111-8111-111111111111",

                    name:
                        "Gustavo Medeiros",

                    email:
                        "gustavo@corporatechat.local",

                    /*
                     * Substituir por hash válido
                     * gerado pela aplicação.
                     */
                    password_hash:
                        "$2b$12$DEVELOPMENT_HASH",

                    status:
                        "ACTIVE",

                    is_admin:
                        true,

                    created_at:
                        new Date(),

                    updated_at:
                        new Date(),

                    last_login_at:
                        null,
                },

                {
                    user_id:
                        "22222222-2222-4222-8222-222222222222",

                    name:
                        "Eduardo",

                    email:
                        "eduardo@corporatechat.local",

                    password_hash:
                        "$2b$12$DEVELOPMENT_HASH",

                    status:
                        "ACTIVE",

                    is_admin:
                        false,

                    created_at:
                        new Date(),

                    updated_at:
                        new Date(),

                    last_login_at:
                        null,
                },

                {
                    user_id:
                        "33333333-3333-4333-8333-333333333333",

                    name:
                        "Alexandre",

                    email:
                        "alexandre@corporatechat.local",

                    password_hash:
                        "$2b$12$DEVELOPMENT_HASH",

                    status:
                        "ACTIVE",

                    is_admin:
                        false,

                    created_at:
                        new Date(),

                    updated_at:
                        new Date(),

                    last_login_at:
                        null,
                },

                {
                    user_id:
                        "44444444-4444-4444-8444-444444444444",

                    name:
                        "Mauricio",

                    email:
                        "mauricio@corporatechat.local",

                    password_hash:
                        "$2b$12$DEVELOPMENT_HASH",

                    status:
                        "ACTIVE",

                    is_admin:
                        false,

                    created_at:
                        new Date(),

                    updated_at:
                        new Date(),

                    last_login_at:
                        null,
                },
            ]
        );
    },


    async down(queryInterface) {

        await queryInterface.bulkDelete(
            "users",
            {
                email: [
                    "gustavo@corporatechat.local",
                    "eduardo@corporatechat.local",
                    "alexandre@corporatechat.local",
                    "mauricio@corporatechat.local",
                ],
            }
        );
    },
};
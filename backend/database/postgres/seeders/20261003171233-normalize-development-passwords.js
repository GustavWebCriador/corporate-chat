"use strict";

require("dotenv").config();

const bcrypt =
    require("bcryptjs");

const {
    Op
} = require("sequelize");

const {
    users
} = require("../../../scripts/shared/dev-fixtures");



module.exports = {

    async up(
        queryInterface
    ) {

        if (
            process.env.NODE_ENV !==
            "development"
        ) {

            throw new Error(
                "Development seed cannot run outside development."
            );
        }


        const password =
            process.env.DEV_SEED_PASSWORD;


        if (!password) {

            throw new Error(
                "DEV_SEED_PASSWORD não configurada."
            );
        }


        const passwordHash =
            await bcrypt.hash(
                password,
                12
            );


        const userIds =
            Object.values(users)
                .map(
                    user =>
                        user.user_id
                );


        await queryInterface.bulkUpdate(
            "users",

            {
                password_hash:
                    passwordHash,

                updated_at:
                    new Date(),
            },

            {
                user_id: {
                    [Op.in]:
                        userIds,
                },
            }
        );


        console.log(
            "[SEED] Development passwords normalized."
        );
    },


    async down() {

        /*
         * Normalização de credencial DEV.
         * Não restauramos hashes inválidos.
         */
    },
};
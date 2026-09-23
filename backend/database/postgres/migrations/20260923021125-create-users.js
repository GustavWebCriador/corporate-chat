"use strict";

module.exports = {

    async up(queryInterface, Sequelize) {

        await queryInterface.createTable(
            "users",
            {
                user_id: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    primaryKey: true,
                    defaultValue:
                        Sequelize.literal(
                            "gen_random_uuid()"
                        ),
                },

                name: {
                    type: Sequelize.STRING(150),
                    allowNull: false,
                },

                email: {
                    type: Sequelize.STRING(50),
                    allowNull: false,
                    unique: true,
                },

                password_hash: {
                    type: Sequelize.STRING(255),
                    allowNull: false,
                },

                status: {
                    type: Sequelize.STRING(20),
                    allowNull: false,
                    defaultValue: "ACTIVE",
                },

                is_admin: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },

                created_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue:
                        Sequelize.literal(
                            "CURRENT_TIMESTAMP"
                        ),
                },

                updated_at: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue:
                        Sequelize.literal(
                            "CURRENT_TIMESTAMP"
                        ),
                },

                last_login_at: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
            }
        );


        await queryInterface.addConstraint(
            "users",
            {
                fields: ["status"],

                type: "check",

                where: {
                    status: [
                        "ACTIVE",
                        "INACTIVE",
                    ],
                },

                name: "users_status_check",
            }
        );
    },


    async down(queryInterface) {

        await queryInterface.dropTable(
            "users"
        );
    },
};
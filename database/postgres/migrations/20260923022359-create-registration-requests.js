"use strict";

module.exports = {

    async up(queryInterface, Sequelize) {

        await queryInterface.createTable(
            "registration_requests",
            {
                request_id: {
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
                },

                status: {
                    type: Sequelize.STRING(20),
                    allowNull: false,
                    defaultValue: "PENDING",
                },

                requested_at: {
                    type: Sequelize.DATE,
                    allowNull: false,

                    defaultValue:
                        Sequelize.literal(
                            "CURRENT_TIMESTAMP"
                        ),
                },

                reviewed_at: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },

                reviewed_by: {
                    type: Sequelize.UUID,
                    allowNull: true,

                    references: {
                        model: "users",
                        key: "user_id",
                    },

                    onUpdate: "CASCADE",
                    onDelete: "RESTRICT",
                },

                rejection_reason: {
                    type: Sequelize.STRING(500),
                    allowNull: true,
                },

                created_user_id: {
                    type: Sequelize.UUID,
                    allowNull: true,

                    references: {
                        model: "users",
                        key: "user_id",
                    },

                    onUpdate: "CASCADE",
                    onDelete: "RESTRICT",
                },
            }
        );
    },


    async down(queryInterface) {

        await queryInterface.dropTable(
            "registration_requests"
        );
    },
};

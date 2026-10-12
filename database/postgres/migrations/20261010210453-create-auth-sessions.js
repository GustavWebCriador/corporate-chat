
"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("auth_sessions", {
            session_id: {
                type: Sequelize.UUID,
                primaryKey: true,
                allowNull: false,
            },

            user_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: "users",
                    key: "user_id",
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            },

            expires_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },

            revoked_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },

            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
        });

        await queryInterface.addIndex(
            "auth_sessions",
            ["user_id"],
            { name: "idx_auth_sessions_user_id" }
        );

        await queryInterface.addIndex(
            "auth_sessions",
            ["expires_at"],
            { name: "idx_auth_sessions_expires_at" }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable("auth_sessions");
    },
};

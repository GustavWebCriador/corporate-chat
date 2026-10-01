"use strict";

module.exports = {
    async up(queryInterface) {

        /*
         * ===========================================
         * USERS
         * ===========================================
         */

        await queryInterface.sequelize.query(`
            ALTER TABLE users
            ADD CONSTRAINT users_status_check
            CHECK (
                status IN ('ACTIVE', 'INACTIVE')
            );
        `);


        /*
         * ===========================================
         * REGISTRATION_REQUESTS
         * ===========================================
         */

        await queryInterface.sequelize.query(`
            ALTER TABLE registration_requests
            ADD CONSTRAINT registration_requests_status_check
            CHECK (
                status IN (
                    'PENDING',
                    'APPROVED',
                    'REJECTED'
                )
            );
        `);


        /*
         * APPROVED:
         *
         * precisa ter sido analisada.
         */
        await queryInterface.sequelize.query(`
            ALTER TABLE registration_requests
            ADD CONSTRAINT registration_requests_approved_check
            CHECK (
                status <> 'APPROVED'
                OR (
                    reviewed_by IS NOT NULL
                    AND reviewed_at IS NOT NULL
                )
            );
        `);


        /*
         * REJECTED:
         *
         * precisa ter:
         * - administrador
         * - data da análise
         * - motivo da rejeição
         */
        await queryInterface.sequelize.query(`
            ALTER TABLE registration_requests
            ADD CONSTRAINT registration_requests_rejected_check
            CHECK (
                status <> 'REJECTED'
                OR (
                    reviewed_by IS NOT NULL
                    AND reviewed_at IS NOT NULL
                    AND rejection_reason IS NOT NULL
                    AND LENGTH(TRIM(rejection_reason)) > 0
                )
            );
        `);


 
         //INDEXES
 

        await queryInterface.addIndex(
            "users",
            ["status"],
            {
                name: "idx_users_status",
            }
        );


        await queryInterface.addIndex(
            "registration_requests",
            ["status"],
            {
                name:
                    "idx_registration_requests_status",
            }
        );


        await queryInterface.addIndex(
            "registration_requests",
            ["email"],
            {
                name:
                    "idx_registration_requests_email",
            }
        );


        await queryInterface.addIndex(
            "registration_requests",
            ["reviewed_by"],
            {
                name:
                    "idx_registration_requests_reviewed_by",
            }
        );


        await queryInterface.addIndex(
            "registration_requests",
            ["created_user_id"],
            {
                name:
                    "idx_registration_requests_created_user_id",
            }
        );
    },


    async down(queryInterface) {

        /*
          INDEXES
         */

        await queryInterface.removeIndex(
            "registration_requests",
            "idx_registration_requests_created_user_id"
        );

        await queryInterface.removeIndex(
            "registration_requests",
            "idx_registration_requests_reviewed_by"
        );

        await queryInterface.removeIndex(
            "registration_requests",
            "idx_registration_requests_email"
        );

        await queryInterface.removeIndex(
            "registration_requests",
            "idx_registration_requests_status"
        );

        await queryInterface.removeIndex(
            "users",
            "idx_users_status"
        );


        /*
         * CONSTRAINTS
         */

        await queryInterface.removeConstraint(
            "registration_requests",
            "registration_requests_rejected_check"
        );

        await queryInterface.removeConstraint(
            "registration_requests",
            "registration_requests_approved_check"
        );

        await queryInterface.removeConstraint(
            "registration_requests",
            "registration_requests_status_check"
        );

        await queryInterface.removeConstraint(
            "users",
            "users_status_check"
        );
    },
};
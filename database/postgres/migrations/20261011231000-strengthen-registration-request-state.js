"use strict";

module.exports = {

    async up(queryInterface) {

        await queryInterface.sequelize.transaction(
            async (transaction) => {

                /*
                 * Remove as constraints anteriores,
                 * que validavam apenas parte do estado.
                 */
                await queryInterface.removeConstraint(
                    "registration_requests",
                    "registration_requests_approved_check",
                    { transaction }
                );

                await queryInterface.removeConstraint(
                    "registration_requests",
                    "registration_requests_rejected_check",
                    { transaction }
                );


                /*
                 * Garante consistência completa dos
                 * três estados da solicitação.
                 */
                await queryInterface.sequelize.query(
                    `
                    ALTER TABLE registration_requests
                    ADD CONSTRAINT registration_requests_state_consistency_check
                    CHECK (

                        (
                            status = 'PENDING'
                            AND reviewed_at IS NULL
                            AND reviewed_by IS NULL
                            AND rejection_reason IS NULL
                            AND created_user_id IS NULL
                        )

                        OR

                        (
                            status = 'APPROVED'
                            AND reviewed_at IS NOT NULL
                            AND reviewed_by IS NOT NULL
                            AND rejection_reason IS NULL
                            AND created_user_id IS NOT NULL
                        )

                        OR

                        (
                            status = 'REJECTED'
                            AND reviewed_at IS NOT NULL
                            AND reviewed_by IS NOT NULL
                            AND rejection_reason IS NOT NULL
                            AND LENGTH(TRIM(rejection_reason)) > 0
                            AND created_user_id IS NULL
                        )
                    );
                    `,
                    { transaction }
                );
            }
        );
    },


    async down(queryInterface) {

        await queryInterface.sequelize.transaction(
            async (transaction) => {

                await queryInterface.removeConstraint(
                    "registration_requests",
                    "registration_requests_state_consistency_check",
                    { transaction }
                );


                await queryInterface.sequelize.query(
                    `
                    ALTER TABLE registration_requests
                    ADD CONSTRAINT registration_requests_approved_check
                    CHECK (
                        status <> 'APPROVED'
                        OR (
                            reviewed_by IS NOT NULL
                            AND reviewed_at IS NOT NULL
                        )
                    );
                    `,
                    { transaction }
                );


                await queryInterface.sequelize.query(
                    `
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
                    `,
                    { transaction }
                );
            }
        );
    },
};
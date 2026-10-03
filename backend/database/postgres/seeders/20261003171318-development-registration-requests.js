"use strict";

const {
    users,
    registrationRequests,
} = require("../../../scripts/shared/dev-fixtures");


module.exports = {

    async up(
        queryInterface
    ) {

        const baseDate =
            new Date(
                "2026-09-30T12:00:00.000Z"
            );


        await queryInterface.bulkInsert(
            "registration_requests",

            [

                /*
                 * PENDING
                 */
                {
                    request_id:
                        registrationRequests
                            .pending
                            .request_id,

                    name:
                        registrationRequests
                            .pending
                            .name,

                    email:
                        registrationRequests
                            .pending
                            .email,

                    status:
                        "PENDING",

                    requested_at:
                        baseDate,

                    reviewed_at:
                        null,

                    reviewed_by:
                        null,

                    rejection_reason:
                        null,

                    created_user_id:
                        null,
                },


                /*
                 * REJECTED
                 */
                {
                    request_id:
                        registrationRequests
                            .rejected
                            .request_id,

                    name:
                        registrationRequests
                            .rejected
                            .name,

                    email:
                        registrationRequests
                            .rejected
                            .email,

                    status:
                        "REJECTED",

                    requested_at:
                        new Date(
                            "2026-09-30T12:10:00.000Z"
                        ),

                    reviewed_at:
                        new Date(
                            "2026-09-30T12:15:00.000Z"
                        ),

                    reviewed_by:
                        users.gustavo.user_id,

                    rejection_reason:
                        "Solicitação DEV para teste de rejeição.",

                    created_user_id:
                        null,
                },


                /*
                 * APPROVED
                 */
                {
                    request_id:
                        registrationRequests
                            .approved
                            .request_id,

                    name:
                        users.eduardo.name,

                    email:
                        users.eduardo.email,

                    status:
                        "APPROVED",

                    requested_at:
                        new Date(
                            "2026-09-30T12:20:00.000Z"
                        ),

                    reviewed_at:
                        new Date(
                            "2026-09-30T12:25:00.000Z"
                        ),

                    reviewed_by:
                        users.gustavo.user_id,

                    rejection_reason:
                        null,

                    created_user_id:
                        users.eduardo.user_id,
                },
            ]
        );


        console.log(
            "[SEED] Registration requests created."
        );
    },


    async down(
        queryInterface
    ) {

        await queryInterface.bulkDelete(
            "registration_requests",

            {
                request_id: [
                    registrationRequests
                        .pending
                        .request_id,

                    registrationRequests
                        .rejected
                        .request_id,

                    registrationRequests
                        .approved
                        .request_id,
                ],
            }
        );
    },
};
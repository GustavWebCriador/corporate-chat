"use strict";

module.exports = {

    async up(queryInterface) {

        /*
         * Remove índice simples antigo.
         */
        await queryInterface.removeIndex(
            "registration_requests",
            "idx_registration_requests_status"
        );


        /*
         * Novo índice para:
         *
         * WHERE status = 'PENDING'
         * ORDER BY requested_at DESC,
         *          request_id DESC
         */
        await queryInterface.addIndex(
            "registration_requests",

            [
                "status",
                "requested_at",
                "request_id",
            ],

            {
                name:
                    "idx_registration_requests_status_requested_at_request_id",
            }
        );
    },


    async down(queryInterface) {

        await queryInterface.removeIndex(
            "registration_requests",
            "idx_registration_requests_status_requested_at_request_id"
        );


        await queryInterface.addIndex(
            "registration_requests",

            [
                "status",
            ],

            {
                name:
                    "idx_registration_requests_status",
            }
        );
    },
};
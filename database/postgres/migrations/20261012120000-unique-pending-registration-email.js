"use strict";

/*
 * BE-05: impede duas solicitações PENDING para o mesmo e-mail.
 *
 * O serviço já verifica antes de gravar, mas duas requisições simultâneas
 * poderiam passar pela verificação ao mesmo tempo. Este índice único parcial
 * garante a regra no banco. Solicitações já analisadas (APPROVED/REJECTED)
 * não entram no índice, então um e-mail rejeitado pode solicitar de novo.
 */

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS
                idx_registration_requests_pending_email_unique
            ON registration_requests (LOWER(email))
            WHERE status = 'PENDING';
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            DROP INDEX IF EXISTS
                idx_registration_requests_pending_email_unique;
        `);
    },
};

"use strict";

/*
 * PER-02 — Alinhamento ao DER PostgreSQL v1.3.
 *
 * O DER define email como VARCHAR(150) em users e
 * registration_requests. As migrations iniciais criaram
 * VARCHAR(50). Esta migration corrige sem editar
 * migrations já executadas por outros integrantes.
 *
 * A constraint UNIQUE de users.email é preservada, pois
 * ALTER COLUMN ... TYPE não remove índices existentes.
 */

module.exports = {

    async up(queryInterface) {

        await queryInterface.sequelize.query(
            "ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(150);"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE registration_requests ALTER COLUMN email TYPE VARCHAR(150);"
        );
    },


    async down(queryInterface) {

        /*
         * Falha se existir e-mail com mais de 50 caracteres,
         * o que protege contra truncamento silencioso.
         */
        await queryInterface.sequelize.query(
            "ALTER TABLE registration_requests ALTER COLUMN email TYPE VARCHAR(50);"
        );

        await queryInterface.sequelize.query(
            "ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(50);"
        );
    },
};

require("dotenv").config();

const {
    QueryTypes
} = require("sequelize");

const {
    sequelize
} = require("../../src/config/db/postgres");


async function healthTest() {

    try {

        console.log("");
        console.log("======================================");
        console.log(" PostgreSQL Health Test");
        console.log("======================================");

        await sequelize.authenticate();

        console.log(
            "[POSTGRES] Connection: OK"
        );


        const tables = await sequelize.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN (
                'users',
                'registration_requests'
            )
            ORDER BY table_name;
            `,
            {
                type: QueryTypes.SELECT,
            }
        );


        const tableNames =
            tables.map(
                table => table.table_name
            );


        if (
            !tableNames.includes("users")
        ) {

            throw new Error(
                "Tabela users não encontrada."
            );
        }


        if (
            !tableNames.includes(
                "registration_requests"
            )
        ) {

            throw new Error(
                "Tabela registration_requests não encontrada."
            );
        }


        console.log(
            "[POSTGRES] users: OK"
        );

        console.log(
            "[POSTGRES] registration_requests: OK"
        );


        const migrations =
            await sequelize.query(
                `
                SELECT name
                FROM "SequelizeMeta"
                ORDER BY name;
                `,
                {
                    type: QueryTypes.SELECT,
                }
            );


        console.log(
            `[POSTGRES] Migrations applied: ${migrations.length}`
        );


        console.log("");
        console.log(
            "PostgreSQL environment: OK"
        );

    } catch (error) {

        console.error("");
        console.error(
            "PostgreSQL environment: FAILED"
        );

        console.error(
            error.message
        );

        process.exitCode = 1;

    } finally {

        await sequelize.close();
    }
}


healthTest();
require("dotenv").config();

const mongoose =
    require("mongoose");


const {
    sequelize
} = require(
    "../src/config/db/postgres"
);


const {
    connectMongoDB
} = require(
    "../src/config/db/mongodb"
);


const {
    auditCrossDatabaseIntegrity
} = require(
    "../src/services/integration/crossDatabaseIntegrityService"
);


async function verify() {

    try {

        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            " PostgreSQL <-> MongoDB Integrity"
        );

        console.log(
            "========================================"
        );


        await sequelize.authenticate();

        await connectMongoDB();


        const report =
            await auditCrossDatabaseIntegrity();


        console.log("");

        console.log(
            `[INTEGRATION] Referenced users: ${report.totalReferences}`
        );


        if (
            report.missingUserIds.length >
            0
        ) {

            console.error("");

            console.error(
                "[INTEGRATION] Missing users:"
            );


            for (
                const userId of
                report.missingUserIds
            ) {

                console.error(
                    ` - ${userId}`
                );
            }


            process.exitCode = 1;

            return;
        }


        console.log(
            "[INTEGRATION] Missing users: 0"
        );


        console.log("");

        console.log(
            "PostgreSQL <-> MongoDB integrity: VALID"
        );


    } catch (error) {

        console.error("");

        console.error(
            "Cross-database integrity: FAILED"
        );

        console.error(
            error
        );

        process.exitCode = 1;


    } finally {

        await mongoose.disconnect();

        await sequelize.close();
    }
}


verify();
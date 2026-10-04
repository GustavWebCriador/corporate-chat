require("dotenv").config();

module.exports = {

    development: {

        username:
            process.env.POSTGRES_USER,

        password:
            process.env.POSTGRES_PASSWORD,

        database:
            process.env.POSTGRES_DB,

        host:
            process.env.POSTGRES_HOST,

        port:
            Number(
                process.env.POSTGRES_PORT
            ),

        dialect:
            "postgres",

        logging:
            false,


        migrationStorage:
            "sequelize",

        migrationStorageTableName:
            "SequelizeMeta",


        seederStorage:
            "sequelize",

        seederStorageTableName:
            "SequelizeData",
    },


    test: {

        username:
            process.env.POSTGRES_USER,

        password:
            process.env.POSTGRES_PASSWORD,

        database:
            `${process.env.POSTGRES_DB}_test`,

        host:
            process.env.POSTGRES_HOST,

        port:
            Number(
                process.env.POSTGRES_PORT
            ),

        dialect:
            "postgres",

        logging:
            false,
    },
};
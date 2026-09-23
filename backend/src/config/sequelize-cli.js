require("dotenv").config();

module.exporst = {

    development: {
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT),
        dialect: "postgres",

        logging: false,

        migrationStorege: "sequelize",
        migrationStoregeTableName: "SequelizeMeta",

        seederStorage: "sequelize",
        seederStoregeName: "SequelizeData",
    },

    test: {
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: `${process.env.POSTGRES_DB}_test`,
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT),
        dialect: "postgres",
        logging: false,
    },
};
const { Sequelize } = require ("sequelize");

const sequelize = new Sequelize (
    process.env.POSTGRES_DB,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD,
    {
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT),

        dialect: "postgres",

        loggin: false,

        define: {
            timestamps: false,
            freezeTableName: true,
        },
    }
);

/*const pool = new Pool ({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,   
    database: process.env.POSTGRES_DB,
});*/

async function connectPostgres() {
    try {
        
        await sequelize.authenticate();

        console.log("[POSTGRES] Connection established successfully.");

        client.release();
    } catch (error) {
        console.error("[POSTGRES] Connection failed: ", error);

        throw error; 
    }
}

module.exports = {
    sequelize,
    connectPostgres,
};
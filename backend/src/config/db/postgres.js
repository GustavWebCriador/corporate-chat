const { Sequelize } = require ("sequelize");

const sequelize = new Sequelize (
    process.env.POSTGRES_DB,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD,
    {
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT),

        dialect: "postgres",

        logging: false,

        define: {
            timestamps: false,
            freezeTableName: true,
        },
    }
);

async function connectPostgres() {
    try {
        
        await sequelize.authenticate();

        console.log("[POSTGRES] Connection established successfully.");

    
    } catch (error) {
        console.error("[POSTGRES] Connection failed: ", error);

        throw error; 
    }
}

module.exports = {
    sequelize,
    connectPostgres,
};
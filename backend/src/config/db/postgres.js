const { Pool } = require('pg');

const pool = new Pool ({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,   
    database: process.env.POSTGRES_DB,
});

async function connectPostgres() {
    try {
        const client = await pool.connect();

        console.log("[POSTGRES] Connection established successfully.");

        client.release();
    } catch (error) {
        console.error("[POSTGRES] Connection failed: ", error);

        throw error; 
    }
}

module.exports = {
    pool,
    connectPostgres,
};


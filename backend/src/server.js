require("dotenv").config();

const { createApp } = require("./app");

const { connectPostgres } = require("./config/db/postgres");
const { connectMongoDB } = require("./config/db/mongodb");
const { getJwtConfig } = require("./config/jwt");

async function startServer() {
    try {
        // Falha cedo se JWT_SECRET estiver ausente (ou curto demais em produção).
        getJwtConfig();

        console.log("[DATABASE] Connecting...");

        await connectPostgres();
        await connectMongoDB();

        console.log("[DATABASE] Persistence environment ready.");

        const app = createApp();

        const PORT = process.env.PORT || 3000;

        app.listen(PORT, () => {
            console.log(`[SERVER] Listening on port ${PORT}`);
        });
    } catch (error) {
        console.error("[SERVER] Failed to start server:", error);
        process.exit(1);
    }
}

startServer();
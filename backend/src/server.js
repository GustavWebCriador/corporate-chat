require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectPostgres } = require("./config/db/postgres");
const { connectMongoDB } = require("./config/db/mongodb");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        application: "Corporate Chat API",
        status: "running",
    });
});

async function startServer() {
    try{
        console.log("[DATABASE] Connecting...");

        await connectPostgres();
        await connectMongoDB();

        console.log("[DATABASE] Persistence environment ready.");

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
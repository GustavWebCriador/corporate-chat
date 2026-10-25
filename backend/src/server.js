require("dotenv").config();

const {
    createServer,
} = require(
    "node:http"
);

const {
    createApp,
} = require(
    "./app"
);

const {
    createSocketServer,
} = require(
    "./realtime/socketServer"
);

const {
    connectPostgres,
} = require(
    "./config/db/postgres"
);

const {
    connectMongoDB,
} = require(
    "./config/db/mongodb"
);

const {
    getJwtConfig,
} = require(
    "./config/jwt"
);


async function startServer() {
    try {
        /*
         * Falha cedo se JWT_SECRET estiver ausente
         * ou inválido.
         */
        getJwtConfig();


        console.log(
            "[DATABASE] Connecting..."
        );


        await connectPostgres();

        await connectMongoDB();


        console.log(
            "[DATABASE] Persistence environment ready."
        );


        const app =
            createApp();


        /*
         * Express e Socket.IO compartilham
         * exatamente o mesmo HTTP server.
         */
        const httpServer =
            createServer(
                app
            );


        createSocketServer(
            httpServer
        );


        const PORT =
            process.env.PORT ||
            3000;


        httpServer.listen(
            PORT,
            () => {
                console.log(
                    `[SERVER] Listening on port ${PORT}`
                );

                console.log(
                    "[SOCKET.IO] Realtime server ready."
                );
            }
        );

    } catch (error) {

        console.error(
            "[SERVER] Failed to start server:",
            error
        );

        process.exit(1);
    }
}


startServer();
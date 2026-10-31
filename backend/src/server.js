require(
    "dotenv"
).config();


const {
    createServer,
} = require(
    "node:http"
);

const {
    validateRuntimeConfig,
} = require(
    "./config/runtime"
);


async function startServer() {
    try {
        const runtimeConfig =
            validateRuntimeConfig();


        /*
         * As dependências que leem configuração de banco
         * só são carregadas depois que o ambiente é validado.
         */
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
         * Express e Socket.IO compartilham o mesmo servidor
         * para evitar portas e ciclos de vida independentes.
         */
        const httpServer =
            createServer(
                app
            );


        createSocketServer(
            httpServer
        );


        httpServer.listen(
            runtimeConfig.port,
            () => {
                console.log(
                    `[SERVER] Listening on port ${runtimeConfig.port}`
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
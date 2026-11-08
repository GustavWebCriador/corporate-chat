
"use strict";

require("dotenv").config();

const { createServer } = require("node:http");

const {
    validateRuntimeConfig,
} = require("./config/runtime");

const {
    createShutdown,
} = require("./operations/shutdown");

async function startServer() {
    let httpServer;
    let io;
    let sequelize;
    let mongoose;

    try {
        const { port } = validateRuntimeConfig();

        // Carregamento após a validação do ambiente.
        const { createApp } = require("./app");

        const {
            createSocketServer,
        } = require("./realtime/socketServer");

        const postgres =
            require("./config/db/postgres");

        const {
            connectMongoDB,
        } = require("./config/db/mongodb");

        sequelize = postgres.sequelize;
        mongoose = require("mongoose");

        console.log("[DATABASE] Connecting...");

        await postgres.connectPostgres();
        await connectMongoDB();

        console.log(
            "[DATABASE] Persistence environment ready."
        );

        // HTTP e Socket.IO compartilham o servidor.
        httpServer = createServer(createApp());
        io = createSocketServer(httpServer);

        await new Promise((resolve, reject) => {
            const onError = (error) => reject(error);

            httpServer.once("error", onError);

            httpServer.listen(port, () => {
                httpServer.off("error", onError);
                resolve();
            });
        });

        const shutdown = createShutdown({
            httpServer,
            io,
            sequelize,
            mongoose,
        });

        let shuttingDown = false;

        function onSignal(signal) {
            if (shuttingDown) return;

            shuttingDown = true;

            console.log(
                `[SERVER] ${signal} recebido. Encerrando...`
            );

            // Limite máximo para evitar processo travado.
            const watchdog = setTimeout(() => {
                console.error(
                    "[SERVER] Tempo limite de desligamento excedido."
                );

                process.exit(1);
            }, 15000);

            shutdown()
                .then(() => {
                    console.log(
                        "[SERVER] Encerramento concluído."
                    );
                })
                .catch((error) => {
                    console.error(
                        "[SERVER] Erro no encerramento:",
                        error
                    );

                    process.exitCode = 1;
                })
                .finally(() => {
                    clearTimeout(watchdog);
                });
        }

        process.on(
            "SIGINT",
            () => onSignal("SIGINT")
        );

        process.on(
            "SIGTERM",
            () => onSignal("SIGTERM")
        );

        console.log(
            `[SERVER] Listening on port ${port}`
        );

        console.log(
            "[SOCKET.IO] Realtime server ready."
        );

    } catch (error) {
        console.error(
            "[SERVER] Failed to start server:",
            error
        );

        // Fecha conexões abertas parcialmente
        // caso ocorra erro durante a inicialização.
        try {
            await createShutdown({
                httpServer,
                io,
                sequelize,
                mongoose,
            })();

        } catch (cleanupError) {
            console.error(
                "[SERVER] Startup cleanup failed:",
                cleanupError
            );
        }

        process.exitCode = 1;
    }
}

startServer();

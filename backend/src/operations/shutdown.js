
"use strict";

function createShutdown({
    httpServer,
    io,
    sequelize,
    mongoose,
}) {
    let shutdownPromise;

    function shutdown() {
        // Evita executar a limpeza duas vezes.
        if (shutdownPromise) {
            return shutdownPromise;
        }

        shutdownPromise = (async () => {
            const errors = [];

            const steps = [
                ["Socket.IO", async () => {
                    if (!io) return;

                    await new Promise((resolve, reject) => {
                        try {
                            io.close((error) => {
                                if (error) reject(error);
                                else resolve();
                            });
                        } catch (error) {
                            reject(error);
                        }
                    });
                }],

                ["HTTP", async () => {
                    // io.close() também pode fechar
                    // o servidor HTTP compartilhado.
                    if (!httpServer?.listening) return;

                    await new Promise((resolve, reject) => {
                        httpServer.close((error) => {
                            if (
                                error &&
                                error.code !==
                                    "ERR_SERVER_NOT_RUNNING"
                            ) {
                                reject(error);
                            } else {
                                resolve();
                            }
                        });
                    });
                }],

                ["PostgreSQL", async () => {
                    if (sequelize) {
                        await sequelize.close();
                    }
                }],

                ["MongoDB", async () => {
                    if (mongoose) {
                        await mongoose.disconnect();
                    }
                }],
            ];

            for (const [name, operation] of steps) {
                try {
                    await operation();
                } catch (error) {
                    errors.push(
                        new Error(
                            `Falha ao encerrar ${name}`,
                            { cause: error }
                        )
                    );
                }
            }

            if (errors.length) {
                throw new AggregateError(
                    errors,
                    "Encerramento incompleto"
                );
            }
        })();

        return shutdownPromise;
    }

    return shutdown;
}

module.exports = {
    createShutdown,
};

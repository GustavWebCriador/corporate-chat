
const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createShutdown,
} = require("../../src/operations/shutdown");

test(
    "encerra Socket.IO, HTTP e bancos na ordem correta",
    async () => {
        const calls = [];

        const httpServer = {
            listening: true,

            close(callback) {
                calls.push("http");
                this.listening = false;
                callback();
            },
        };

        const shutdown = createShutdown({
            httpServer,

            io: {
                close(callback) {
                    calls.push("socket");
                    callback();
                },
            },

            sequelize: {
                async close() {
                    calls.push("postgres");
                },
            },

            mongoose: {
                async disconnect() {
                    calls.push("mongo");
                },
            },
        });

        const first = shutdown();
        const second = shutdown();

        assert.strictEqual(first, second);

        await first;

        assert.deepEqual(calls, [
            "socket",
            "http",
            "postgres",
            "mongo",
        ]);
    }
);

test(
    "não tenta fechar HTTP duas vezes",
    async () => {
        let httpCloseCalls = 0;

        const httpServer = {
            listening: true,

            close(callback) {
                httpCloseCalls += 1;
                this.listening = false;
                callback();
            },
        };

        const shutdown = createShutdown({
            httpServer,

            io: {
                close(callback) {
                    // Simula o Socket.IO fechando
                    // também o servidor HTTP.
                    httpServer.listening = false;
                    callback();
                },
            },
        });

        await shutdown();

        assert.equal(httpCloseCalls, 0);
    }
);

test(
    "libera os bancos mesmo se Socket.IO falhar",
    async () => {
        const calls = [];

        const shutdown = createShutdown({
            io: {
                close(callback) {
                    callback(
                        new Error("Falha simulada")
                    );
                },
            },

            sequelize: {
                async close() {
                    calls.push("postgres");
                },
            },

            mongoose: {
                async disconnect() {
                    calls.push("mongo");
                },
            },
        });

        await assert.rejects(
            shutdown(),
            AggregateError
        );

        assert.deepEqual(calls, [
            "postgres",
            "mongo",
        ]);
    }
);

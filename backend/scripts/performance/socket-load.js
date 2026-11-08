
require("dotenv").config();

const { performance } = require("node:perf_hooks");
const { io } = require("socket.io-client");

const baseUrl =
    process.env.PERF_BASE_URL ||
    "http://127.0.0.1:3000";

const token = process.env.PERF_TOKEN;
const conversationId =
    process.env.PERF_CONVERSATION_ID;

const clients = Number(
    process.env.PERF_CLIENTS || 5
);

const timeoutMs = 12000;
const sockets = [];

function validateConfiguration() {
    const url = new URL(baseUrl);

    if (process.env.NODE_ENV !== "development") {
        throw new Error(
            "Benchmark permitido apenas em development."
        );
    }

    if (
        url.protocol !== "http:" ||
        !["127.0.0.1", "localhost"].includes(
            url.hostname
        ) ||
        url.pathname !== "/"
    ) {
        throw new Error(
            "Utilize apenas um servidor HTTP local."
        );
    }

    if (
        !Number.isInteger(clients) ||
        clients < 1 ||
        clients > 20
    ) {
        throw new Error(
            "PERF_CLIENTS deve estar entre 1 e 20."
        );
    }

    if (!token) {
        throw new Error(
            "PERF_TOKEN não configurado."
        );
    }

    if (
        !/^[a-f0-9]{24}$/i.test(
            conversationId || ""
        )
    ) {
        throw new Error(
            "PERF_CONVERSATION_ID inválido."
        );
    }
}

function percentile(values, percent) {
    if (values.length === 0) {
        return null;
    }

    const ordered = [...values].sort(
        (a, b) => a - b
    );

    const position = Math.max(
        0,
        Math.ceil(
            percent / 100 * ordered.length
        ) - 1
    );

    return Number(
        ordered[position].toFixed(2)
    );
}

function metrics(values) {
    return {
        p50Ms: percentile(values, 50),
        p95Ms: percentile(values, 95),
        p99Ms: percentile(values, 99),
    };
}

function connectClient() {
    const socket = io(baseUrl, {
        autoConnect: false,
        forceNew: true,
        reconnection: false,
        transports: ["websocket"],
        timeout: timeoutMs,
        auth: { token },
    });

    sockets.push(socket);

    return new Promise((resolve, reject) => {
        const started = performance.now();
        let finished = false;

        const timer = setTimeout(
            () => finish(
                new Error("READY_TIMEOUT")
            ),
            timeoutMs
        );

        function finish(error, payload) {
            if (finished) {
                return;
            }

            finished = true;
            clearTimeout(timer);

            socket.off("realtime:ready", onReady);
            socket.off("connect_error", onError);
            socket.off("disconnect", onDisconnect);

            if (error) {
                reject(error);
                return;
            }

            resolve({
                socket,
                readyMs:
                    performance.now() - started,
                payload,
            });
        }

        function onReady(payload) {
            if (!socket.connected) {
                finish(
                    new Error("SOCKET_NOT_CONNECTED")
                );
                return;
            }

            finish(null, payload);
        }

        function onError(error) {
            finish(
                new Error(
                    error?.data?.code ||
                    error?.message ||
                    "CONNECT_ERROR"
                )
            );
        }

        function onDisconnect() {
            finish(
                new Error("DISCONNECTED_BEFORE_READY")
            );
        }

        socket.once("realtime:ready", onReady);
        socket.once("connect_error", onError);
        socket.once("disconnect", onDisconnect);

        socket.connect();
    });
}

async function synchronize(socket) {
    const started = performance.now();

    const ack = await socket
        .timeout(timeoutMs)
        .emitWithAck(
            "realtime:sync",
            {
                conversationId,
                limit: 50,
            }
        );

    if (!ack?.ok) {
        throw new Error(
            ack?.error?.code || "SYNC_FAILED"
        );
    }

    if (
        ack.data?.mode !== "snapshot" ||
        !Array.isArray(ack.data.items)
    ) {
        throw new Error("INVALID_SYNC_RESPONSE");
    }

    return {
        latencyMs:
            performance.now() - started,
        messages: ack.data.items.length,
    };
}

function reportErrors(results) {
    const errors = results
        .filter(item => item.status === "rejected")
        .map(item =>
            item.reason?.message ||
            "UNKNOWN_ERROR"
        );

    if (errors.length > 0) {
        console.log("Erros:", errors);
    }

    return errors.length;
}

async function main() {
    validateConfiguration();

    console.log("");
    console.log("Corporate Chat - Socket.IO Benchmark");
    console.log("-----------------------------------");
    console.log(`Clientes: ${clients}`);
    console.log("Transporte: websocket");
    console.log("Operação: conexão + sync (somente leitura)");
    console.log("");

    try {
        const connectStarted = performance.now();

        const connections = await Promise.allSettled(
            Array.from(
                { length: clients },
                () => connectClient()
            )
        );

        const connectSeconds =
            (performance.now() - connectStarted) / 1000;

        const connected = connections
            .filter(item => item.status === "fulfilled")
            .map(item => item.value);

        const connectFailures =
            reportErrors(connections);

        console.log("\nConexões autenticadas:");

        console.table({
            requested: clients,
            connected: connected.length,
            failures: connectFailures,
            durationSeconds: Number(
                connectSeconds.toFixed(2)
            ),
            ...metrics(
                connected.map(item => item.readyMs)
            ),
        });

        if (connected.length === 0) {
            process.exitCode = 1;
            return;
        }

        const syncStarted = performance.now();

        const syncResults = await Promise.allSettled(
            connected.map(item =>
                synchronize(item.socket)
            )
        );

        const syncSeconds =
            (performance.now() - syncStarted) / 1000;

        const synchronized = syncResults
            .filter(item => item.status === "fulfilled")
            .map(item => item.value);

        const syncFailures =
            reportErrors(syncResults);

        console.log("\nSincronizações:");

        console.table({
            requested: connected.length,
            completed: synchronized.length,
            failures: syncFailures,
            durationSeconds: Number(
                syncSeconds.toFixed(2)
            ),
            ...metrics(
                synchronized.map(
                    item => item.latencyMs
                )
            ),
        });

        if (
            connectFailures > 0 ||
            syncFailures > 0
        ) {
            process.exitCode = 1;
        }
    } finally {
        for (const socket of sockets) {
            socket.removeAllListeners();
            socket.disconnect();
        }
    }
}

main().catch(error => {
    console.error(
        "[PERFORMANCE] Falha:",
        error.message
    );

    process.exitCode = 1;
});

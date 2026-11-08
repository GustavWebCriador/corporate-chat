
require("dotenv").config();

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { io } = require("socket.io-client");

const {
    sequelize,
    User,
    AuthSession,
} = require("../../src/models/postgres");

const {
    connectMongoDB,
} = require("../../src/config/db/mongodb");

const Conversation =
    require("../../src/models/mongodb/Conversation");

const ConversationMember =
    require("../../src/models/mongodb/ConversationMember");

const Message =
    require("../../src/models/mongodb/Message");

const {
    authService,
} = require("../../src/services/auth/authService");

const url = new URL(
    process.env.PERF_BASE_URL ||
        "http://127.0.0.1:3000"
);

const clientsCount = Number(
    process.env.PERF_CLIENTS || 5
);

const conversationId =
    new mongoose.Types.ObjectId();

const userIds = [];
const sockets = [];

const TIMEOUT_MS = 12000;

function validate() {
    if (process.env.NODE_ENV !== "development") {
        throw new Error(
            "Permitido somente em NODE_ENV=development."
        );
    }

    if (
        url.protocol !== "http:" ||
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
    ) {
        throw new Error(
            "PERF_BASE_URL deve apontar para um servidor HTTP local."
        );
    }

    if (
        !Number.isInteger(clientsCount) ||
        clientsCount < 2 ||
        clientsCount > 20
    ) {
        throw new Error(
            "PERF_CLIENTS deve estar entre 2 e 20."
        );
    }
}

function percentile(numbers, percent) {
    if (!numbers.length) {
        return null;
    }

    const sorted = [...numbers].sort(
        (a, b) => a - b
    );

    const index =
        Math.ceil(
            (percent / 100) * sorted.length
        ) - 1;

    return Number(sorted[index].toFixed(2));
}

async function createTemporaryUser(index) {
    const userId = randomUUID();

    userIds.push(userId);

    const password = randomUUID();
    const email = `be17-${userId}@test.local`;

    await User.create({
        user_id: userId,
        name: `BE17 Test User ${index}`,
        email,
        password_hash: await bcrypt.hash(password, 4),
        status: "ACTIVE",
        is_admin: false,
    });

    const { token } = await authService.login({
        email,
        password,
    });

    return {
        userId,
        token,
    };
}

function connectClient(token) {
    const socket = io(url.origin, {
        autoConnect: false,
        forceNew: true,
        reconnection: false,
        transports: ["websocket"],
        timeout: TIMEOUT_MS,
        auth: { token },
    });

    const observed = new Set();

    socket.on("message:new", ({ message } = {}) => {
        if (message?._id) {
            observed.add(String(message._id));
        }
    });

    sockets.push(socket);

    return new Promise((resolve, reject) => {
        const start = performance.now();

        const timer = setTimeout(
            () => done(new Error("READY_TIMEOUT")),
            TIMEOUT_MS
        );

        function done(error) {
            clearTimeout(timer);

            socket.off("realtime:ready", onReady);
            socket.off("connect_error", onError);

            if (error) {
                reject(error);
                return;
            }

            resolve({
                socket,
                observed,
                readyMs: performance.now() - start,
            });
        }

        function onReady() {
            done(null);
        }

        function onError(error) {
            done(
                new Error(
                    error?.data?.code ||
                    error?.message ||
                    "CONNECT_ERROR"
                )
            );
        }

        socket.once("realtime:ready", onReady);
        socket.once("connect_error", onError);

        socket.connect();
    });
}

async function emitMessage(socket, payload) {
    const start = performance.now();

    const ack = await socket
        .timeout(TIMEOUT_MS)
        .emitWithAck("message:send", payload);

    if (!ack?.ok) {
        throw new Error(
            ack?.error?.code || "INVALID_SEND_ACK"
        );
    }

    assert.ok(
        ack.data?.message?._id,
        "ACK sem ID persistido"
    );

    return {
        ack,
        latencyMs: performance.now() - start,
    };
}

async function waitForBroadcast(
    clients,
    expected,
    timeoutMs = 6000
) {
    const deadline =
        performance.now() + timeoutMs;

    while (performance.now() < deadline) {
        if (
            clients.every(
                client =>
                    client.observed.size === expected
            )
        ) {
            return;
        }

        await new Promise(
            resolve => setTimeout(resolve, 50)
        );
    }

    throw new Error(
        "Nem todos os clientes receberam todos os message:new."
    );
}

async function cleanup() {
    for (const socket of sockets) {
        socket.removeAllListeners();
        socket.disconnect();
    }

    const steps = [
        [
            "messages",
            () => Message.deleteMany({
                conversation_id: conversationId,
            }),
        ],
        [
            "members",
            () => ConversationMember.deleteMany({
                conversation_id: conversationId,
            }),
        ],
        [
            "conversation",
            () => Conversation.deleteOne({
                _id: conversationId,
            }),
        ],
        [
            "sessions",
            () => userIds.length
                ? AuthSession.destroy({
                    where: { user_id: userIds },
                })
                : null,
        ],
        [
            "users",
            () => userIds.length
                ? User.destroy({
                    where: { user_id: userIds },
                })
                : null,
        ],
    ];

    for (const [name, fn] of steps) {
        try {
            await fn();
        } catch (error) {
            console.error(
                `[CLEANUP] ${name}: ${error.message}`
            );

            process.exitCode = 1;
        }
    }

    try {
        await mongoose.disconnect();
    } catch (error) {
        console.error(
            `[CLEANUP] Mongo: ${error.message}`
        );
        process.exitCode = 1;
    }

    try {
        await sequelize.close();
    } catch (error) {
        console.error(
            `[CLEANUP] PostgreSQL: ${error.message}`
        );
        process.exitCode = 1;
    }
}

async function main() {
    validate();

    console.log(
        `BE-17 - Envio concorrente | usuários distintos: ${clientsCount}`
    );

    try {
        await sequelize.authenticate();
        await connectMongoDB();

        const users = [];

        for (let i = 0; i < clientsCount; i += 1) {
            users.push(
                await createTemporaryUser(i + 1)
            );
        }

        await Conversation.create({
            _id: conversationId,
            type: "GROUP",
            name: "BE17 Carga Temporaria",
            created_by: users[0].userId,
        });

        await ConversationMember.insertMany(
            users.map((user, index) => ({
                conversation_id: conversationId,
                user_id: user.userId,
                role: index === 0
                    ? "CREATOR"
                    : "MEMBER",
                status: "ACTIVE",
            }))
        );

        const clients = await Promise.all(
            users.map(user =>
                connectClient(user.token)
            )
        );

        const payloads = clients.map((_, index) => ({
            conversationId: conversationId.toString(),
            clientMessageId: randomUUID(),
            content: `BE17 envio concorrente ${index + 1}`,
        }));

        const start = performance.now();

        const results = await Promise.allSettled(
            clients.map((client, index) =>
                emitMessage(
                    client.socket,
                    payloads[index]
                )
            )
        );

        const elapsed = performance.now() - start;

        const failures = results.filter(
            result => result.status === "rejected"
        );

        for (const failure of failures) {
            console.error(
                "[SEND]",
                failure.reason?.message
            );
        }

        assert.equal(
            failures.length,
            0,
            "Falhas nos ACKs de envio"
        );

        const successful = results.map(
            item => item.value
        );

        assert.ok(
            successful.every(
                item => item.ack.data.reused === false
            ),
            "Envio inicial reutilizado"
        );

        await waitForBroadcast(
            clients,
            clientsCount
        );

        const persisted = await Message.find({
            conversation_id: conversationId,
        }).lean();

        assert.equal(
            persisted.length,
            clientsCount,
            "Quantidade persistida divergente"
        );

        assert.equal(
            new Set(
                persisted.map(
                    message => message.client_message_id
                )
            ).size,
            clientsCount,
            "IDs de idempotência duplicados"
        );

        assert.ok(
            persisted.every(
                message =>
                    userIds.includes(message.sender_id)
            ),
            "Remetente inesperado"
        );

        const repeated = await emitMessage(
            clients[0].socket,
            payloads[0]
        );

        assert.equal(
            repeated.ack.data.reused,
            true,
            "Reenvio não foi idempotente"
        );

        assert.equal(
            String(repeated.ack.data.message._id),
            String(successful[0].ack.data.message._id),
            "Reenvio criou novo ID"
        );

        assert.equal(
            await Message.countDocuments({
                conversation_id: conversationId,
            }),
            clientsCount,
            "Reenvio duplicou mensagem"
        );

        const latest = await Message.findOne({
            conversation_id: conversationId,
        })
            .sort({
                created_at: -1,
                _id: -1,
            })
            .lean();

        const conversation =
            await Conversation.findById(conversationId)
                .lean();

        const latestConsistent =
            String(conversation.last_message_id) ===
            String(latest._id);

        console.table({
            users: userIds.length,
            connections: clients.length,
            messagesSent: clientsCount,
            successfulAcks: successful.length,
            persisted: persisted.length,
            broadcastRecipients:
                clients.filter(
                    client =>
                        client.observed.size >= clientsCount
                ).length,
            idempotentRetry:
                repeated.ack.data.reused,
            lastMessageConsistent:
                latestConsistent,
            durationMs:
                Number(elapsed.toFixed(2)),
            p50Ms: percentile(
                successful.map(
                    value => value.latencyMs
                ),
                50
            ),
            p95Ms: percentile(
                successful.map(
                    value => value.latencyMs
                ),
                95
            ),
            p99Ms: percentile(
                successful.map(
                    value => value.latencyMs
                ),
                99
            ),
        });

        assert.ok(
            latestConsistent,
            "Metadados da última mensagem inconsistentes sob concorrência"
        );

        console.log(
            "BE-17: cenário de envio concorrente aprovado."
        );
    } finally {
        await cleanup();
    }
}

main().catch(error => {
    console.error(
        "[BE-17] Falha:",
        error.message
    );

    process.exitCode = 1;
});

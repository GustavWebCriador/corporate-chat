
require("dotenv").config();

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const mongoose = require("mongoose");

const { sequelize, User } =
    require("../../src/models/postgres");

const { connectMongoDB } =
    require("../../src/config/db/mongodb");

const Conversation =
    require("../../src/models/mongodb/Conversation");

const ConversationMember =
    require("../../src/models/mongodb/ConversationMember");

const Message =
    require("../../src/models/mongodb/Message");

const { users: devUsers } =
    require("../shared/dev-fixtures");

const baseUrl = new URL(
    process.env.PERF_BASE_URL ||
    "http://127.0.0.1:3000"
);

const token = process.env.PERF_TOKEN;

const requests = Number(
    process.env.PERF_REQUESTS || 100
);

const concurrency = Number(
    process.env.PERF_CONCURRENCY || 10
);

const messageCount = 550;
const pageSize = 50;

const conversationId =
    new mongoose.Types.ObjectId();

function validate() {
    const local = new Set([
        "127.0.0.1",
        "localhost",
        "[::1]",
        "::1",
    ]);

    if (process.env.NODE_ENV !== "development") {
        throw new Error(
            "Somente NODE_ENV=development."
        );
    }

    if (
        baseUrl.protocol !== "http:" ||
        !local.has(baseUrl.hostname) ||
        baseUrl.pathname !== "/" ||
        baseUrl.search ||
        baseUrl.hash ||
        !local.has(process.env.POSTGRES_HOST) ||
        !local.has(process.env.MONGO_HOST)
    ) {
        throw new Error(
            "API e bancos devem estar em localhost."
        );
    }

    if (!token) {
        throw new Error(
            "PERF_TOKEN ausente. Faça login DEV."
        );
    }

    if (
        !Number.isInteger(requests) ||
        requests < 1 ||
        requests > 500
    ) {
        throw new Error(
            "PERF_REQUESTS deve estar entre 1 e 500."
        );
    }

    if (
        !Number.isInteger(concurrency) ||
        concurrency < 1 ||
        concurrency > 20
    ) {
        throw new Error(
            "PERF_CONCURRENCY deve estar entre 1 e 20."
        );
    }
}

async function read(path) {
    const response = await fetch(
        new URL(path, baseUrl),
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },

            signal: AbortSignal.timeout(15000),
            cache: "no-store",
        }
    );

    if (!response.ok) {
        throw new Error(
            `GET ${path.split("?")[0]}: HTTP ${response.status}`
        );
    }

    const payload = await response.json();

    return payload.data;
}

function percentile(samples, percent) {
    const sorted = [...samples].sort(
        (a, b) => a - b
    );

    if (!sorted.length) {
        return null;
    }

    const index =
        Math.ceil(
            percent / 100 * sorted.length
        ) - 1;

    return Number(
        sorted[index].toFixed(2)
    );
}

async function benchmark(name, path) {
    const latencies = [];
    const failures = [];

    let next = 0;

    const started = performance.now();

    async function worker() {
        while (next < requests) {
            next += 1;

            const requestStarted =
                performance.now();

            try {
                const data = await read(path);

                assert.equal(
                    data.items.length,
                    pageSize
                );

                latencies.push(
                    performance.now() - requestStarted
                );
            } catch (error) {
                failures.push(error.message);
            }
        }
    }

    await Promise.all(
        Array.from(
            {
                length: Math.min(
                    requests,
                    concurrency
                ),
            },
            () => worker()
        )
    );

    const seconds =
        (performance.now() - started) / 1000;

    console.log(`\n${name}`);

    console.table({
        requests,
        concurrency,

        succeeded: latencies.length,
        failures: failures.length,

        seconds:
            Number(seconds.toFixed(2)),

        requestsPerSecond:
            Number(
                (requests / seconds).toFixed(2)
            ),

        p50Ms: percentile(latencies, 50),
        p95Ms: percentile(latencies, 95),
        p99Ms: percentile(latencies, 99),
    });

    if (failures.length > 0) {
        throw new Error(
            `Falhas em ${name}: ${failures[0]}`
        );
    }
}

async function cleanup() {
    if (mongoose.connection.readyState !== 1) {
        return;
    }

    await Message.deleteMany({
        conversation_id: conversationId,
    });

    await ConversationMember.deleteMany({
        conversation_id: conversationId,
    });

    await Conversation.deleteOne({
        _id: conversationId,
    });
}

async function main() {
    validate();

    console.log(
        "BE-17 - Histórico extenso | 550 mensagens temporárias"
    );

    let dbReady = false;

    try {
        const me = await read(
            "/api/v1/auth/me"
        );

        const currentUserId =
            me?.user?.user_id;

        assert.match(
            currentUserId || "",
            /^[0-9a-f-]{36}$/i
        );

        await sequelize.authenticate();
        await connectMongoDB();

        dbReady = true;

        let secondUserId;

        for (const candidate of Object.values(devUsers)) {
            if (
                candidate.user_id === currentUserId
            ) {
                continue;
            }

            const user = await User.findByPk(
                candidate.user_id
            );

            if (user?.status === "ACTIVE") {
                secondUserId = user.user_id;
                break;
            }
        }

        if (!secondUserId) {
            throw new Error(
                "Segundo usuário DEV ACTIVE não encontrado."
            );
        }

        await Conversation.create({
            _id: conversationId,

            type: "GROUP",
            name: "BE17 Historico Temporario",

            created_by: currentUserId,
        });

        await ConversationMember.insertMany([
            {
                conversation_id: conversationId,
                user_id: currentUserId,
                role: "CREATOR",
                status: "ACTIVE",
            },
            {
                conversation_id: conversationId,
                user_id: secondUserId,
                role: "MEMBER",
                status: "ACTIVE",
            },
        ]);

        const initialTimestamp =
            Date.now() -
            (messageCount + 60) * 1000;

        const messages = await Message.insertMany(
            Array.from(
                { length: messageCount },
                (_, i) => ({
                    conversation_id: conversationId,

                    sender_id: currentUserId,

                    client_message_id: randomUUID(),

                    content:
                        `BE17 histórico mensagem ${i + 1}`,

                    created_at: new Date(
                        initialTimestamp + i * 1000
                    ),
                })
            )
        );

        const last = messages[
            messages.length - 1
        ];

        await Conversation.updateOne(
            { _id: conversationId },

            {
                $set: {
                    last_message_id: last._id,
                    last_message_at: last.created_at,
                },
            }
        );

        const prefix =
            `/api/v1/conversations/${conversationId}/messages?limit=${pageSize}`;

        const first = await read(prefix);

        assert.equal(
            first.items.length,
            pageSize
        );

        assert.equal(
            first.hasMore,
            true
        );

        assert.ok(first.nextCursor);

        const olderPath =
            `${prefix}&before=` +
            encodeURIComponent(
                first.nextCursor
            );

        const second = await read(olderPath);

        assert.equal(
            second.items.length,
            pageSize
        );

        assert.equal(
            second.hasMore,
            true
        );

        // Verifica as 11 páginas por completo.
        const ids = new Set();

        let cursor = null;
        let pages = 0;

        do {
            const path = cursor
                ? `${prefix}&before=${encodeURIComponent(cursor)}`
                : prefix;

            const page = await read(path);

            pages += 1;

            for (const message of page.items) {
                const id = String(
                    message._id
                );

                assert.equal(
                    ids.has(id),
                    false,
                    "Mensagem duplicada entre páginas"
                );

                ids.add(id);
            }

            assert.ok(
                page.items.length <= pageSize
            );

            cursor = page.hasMore
                ? page.nextCursor
                : null;

            if (page.hasMore) {
                assert.ok(cursor);
            }
        } while (cursor);

        assert.equal(
            ids.size,
            messageCount
        );

        console.log(
            `Paginação válida: ${pages} páginas, ${ids.size} mensagens únicas.`
        );

        await benchmark(
            "Primeira página",
            prefix
        );

        await benchmark(
            "Página anterior (cursor)",
            olderPath
        );

        console.log(
            "BE-17: histórico extenso aprovado."
        );
    } finally {
        try {
            await cleanup();

            if (dbReady) {
                console.log(
                    "[CLEANUP] Conversa e mensagens temporárias removidas."
                );
            }
        } finally {
            await mongoose.disconnect();
            await sequelize.close();
        }
    }
}

main().catch(error => {
    console.error(
        "[BE-17] Falha:",
        error.message
    );

    process.exitCode = 1;
});

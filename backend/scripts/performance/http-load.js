
require("dotenv").config();

const {
    performance,
} = require("node:perf_hooks");

const baseUrl = new URL(
    process.env.PERF_BASE_URL ||
        "http://127.0.0.1:3000"
);

const targetPath =
    process.env.PERF_PATH ||
    "/api/v1/health";

const targetUrl = new URL(
    targetPath,
    baseUrl
);

const token = process.env.PERF_TOKEN;

function readInteger(name, fallback, maximum) {
    const value = Number(
        process.env[name] || fallback
    );

    if (
        !Number.isInteger(value) ||
        value < 1 ||
        value > maximum
    ) {
        throw new Error(
            `${name} deve estar entre 1 e ${maximum}.`
        );
    }

    return value;
}

const totalRequests = readInteger(
    "PERF_REQUESTS",
    100,
    500
);

const concurrency = readInteger(
    "PERF_CONCURRENCY",
    5,
    25
);

const allowedHosts = new Set([
    "localhost",
    "127.0.0.1",
    "[::1]",
]);

const allowedEndpoint =
    targetUrl.pathname === "/api/v1/health" ||
    targetUrl.pathname === "/api/v1/dashboard" ||
    /^\/api\/v1\/conversations\/[a-f0-9]{24}\/messages$/i
        .test(targetUrl.pathname);

if (process.env.NODE_ENV !== "development") {
    throw new Error(
        "Benchmark permitido somente em development."
    );
}

if (
    baseUrl.protocol !== "http:" ||
    !allowedHosts.has(baseUrl.hostname) ||
    targetUrl.origin !== baseUrl.origin
) {
    throw new Error(
        "Benchmark permitido somente em servidor HTTP local."
    );
}

if (!allowedEndpoint) {
    throw new Error(
        "Endpoint não autorizado para este benchmark."
    );
}

if (
    targetUrl.pathname !== "/api/v1/health" &&
    !token
) {
    throw new Error(
        "PERF_TOKEN é obrigatório para rotas autenticadas."
    );
}

const latencies = [];
const statuses = new Map();

let completed = 0;
let failures = 0;
let nextRequest = 0;

function percentile(values, percent) {
    if (values.length === 0) {
        return null;
    }

    const sorted = [...values].sort(
        (a, b) => a - b
    );

    const index = Math.max(
        0,
        Math.ceil(
            (percent / 100) * sorted.length
        ) - 1
    );

    return Number(
        sorted[index].toFixed(2)
    );
}

async function executeRequest() {
    const startedAt = performance.now();

    try {
        const response = await fetch(
            targetUrl,
            {
                method: "GET",

                headers: token
                    ? {
                        Authorization:
                            `Bearer ${token}`,
                    }
                    : {},

                signal: AbortSignal.timeout(10000),
                cache: "no-store",
            }
        );

        await response.arrayBuffer();

        const elapsed =
            performance.now() - startedAt;

        latencies.push(elapsed);

        statuses.set(
            response.status,
            (statuses.get(response.status) || 0) + 1
        );

        if (response.ok) {
            completed += 1;
        } else {
            failures += 1;
        }
    } catch (error) {
        failures += 1;

        statuses.set(
            "NETWORK_ERROR",
            (statuses.get("NETWORK_ERROR") || 0) + 1
        );
    }
}

async function worker() {
    while (nextRequest < totalRequests) {
        nextRequest += 1;
        await executeRequest();
    }
}

async function main() {
    console.log("");
    console.log("Corporate Chat - HTTP Benchmark");
    console.log("--------------------------------");
    console.log(`Endpoint: ${targetUrl.href}`);
    console.log(`Requests: ${totalRequests}`);
    console.log(`Concurrency: ${concurrency}`);
    console.log("");

    // Verificação preliminar fora da medição.
    const preflight = await fetch(
        targetUrl,
        {
            headers: token
                ? {
                    Authorization: `Bearer ${token}`,
                }
                : {},
            signal: AbortSignal.timeout(10000),
        }
    );

    await preflight.arrayBuffer();

    if (!preflight.ok) {
        throw new Error(
            `Preflight falhou: HTTP ${preflight.status}`
        );
    }

    const startedAt = performance.now();

    await Promise.all(
        Array.from(
            {
                length: Math.min(
                    concurrency,
                    totalRequests
                ),
            },
            () => worker()
        )
    );

    const durationSeconds =
        (performance.now() - startedAt) / 1000;

    console.table({
        totalRequests,
        completed,
        failures,
        concurrency,
        durationSeconds:
            Number(durationSeconds.toFixed(2)),
        requestsPerSecond:
            Number(
                (totalRequests / durationSeconds)
                    .toFixed(2)
            ),
        p50Ms: percentile(latencies, 50),
        p95Ms: percentile(latencies, 95),
        p99Ms: percentile(latencies, 99),
    });

    console.log(
        "HTTP status:",
        Object.fromEntries(statuses)
    );

    if (failures > 0) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error(
        "[PERFORMANCE] Falha:",
        error.message
    );

    process.exitCode = 1;
});

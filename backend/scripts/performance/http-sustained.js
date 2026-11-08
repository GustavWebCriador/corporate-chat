
require("dotenv").config();

const { performance } = require("node:perf_hooks");

function readInteger(name, defaultValue, maximum) {
    const value = Number(
        process.env[name] || defaultValue
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

const durationSeconds = readInteger(
    "PERF_DURATION_SECONDS", 30, 60
);

const concurrency = readInteger(
    "PERF_CONCURRENCY", 10, 20
);

const baseUrl = new URL(
    process.env.PERF_BASE_URL ||
    "http://127.0.0.1:3000"
);

const token = process.env.PERF_TOKEN;

function validateEnvironment() {
    if (process.env.NODE_ENV !== "development") {
        throw new Error(
            "Benchmark permitido somente em development."
        );
    }

    if (
        baseUrl.protocol !== "http:" ||
        !["localhost", "127.0.0.1", "[::1]"]
            .includes(baseUrl.hostname) ||
        baseUrl.pathname !== "/" ||
        baseUrl.search ||
        baseUrl.hash
    ) {
        throw new Error(
            "Use somente um servidor HTTP local."
        );
    }

    if (!token) {
        throw new Error(
            "PERF_TOKEN ausente. Faça login DEV."
        );
    }
}

function percentile(values, percent) {
    if (!values.length) {
        return null;
    }

    const sorted = [...values].sort(
        (a, b) => a - b
    );

    const index = Math.max(
        0,
        Math.ceil(
            percent / 100 * sorted.length
        ) - 1
    );

    return Number(sorted[index].toFixed(2));
}

async function main() {
    validateEnvironment();

    const target = new URL(
        "/api/v1/dashboard",
        baseUrl
    );

    const headers = {
        Authorization: `Bearer ${token}`,
    };

    console.log("");
    console.log("Corporate Chat - HTTP Sustained Load");
    console.log("------------------------------------");
    console.log(`Endpoint: ${target.href}`);
    console.log(`Duração: ${durationSeconds}s`);
    console.log(`Concorrência: ${concurrency}`);
    console.log("");

    // Verifica a autenticação antes da carga.
    const preflight = await fetch(
        target,
        {
            headers,
            signal: AbortSignal.timeout(10000),
        }
    );

    await preflight.arrayBuffer();

    if (!preflight.ok) {
        throw new Error(
            `Preflight falhou: HTTP ${preflight.status}`
        );
    }

    const latencies = [];
    const statuses = new Map();

    const windows = Array.from(
        { length: Math.ceil(durationSeconds / 5) },
        (_, i) => ({
            interval: `${i * 5}-${Math.min(
                (i + 1) * 5,
                durationSeconds
            )}s`,
            successful: 0,
            failures: 0,
            latencies: [],
        })
    );

    let successful = 0;
    let failures = 0;
    let stop = false;

    const startedAt = performance.now();
    const deadline =
        startedAt + durationSeconds * 1000;

    async function worker() {
        while (
            !stop &&
            performance.now() < deadline
        ) {
            const requestStarted = performance.now();

            let status;
            let ok = false;

            try {
                const response = await fetch(
                    target,
                    {
                        headers,
                        cache: "no-store",
                        signal:
                            AbortSignal.timeout(10000),
                    }
                );

                await response.arrayBuffer();

                status = String(response.status);
                ok = response.ok;

                // Não insistir com token inválido.
                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    stop = true;
                }
            } catch (error) {
                status =
                    error.name === "TimeoutError"
                        ? "TIMEOUT"
                        : "NETWORK_ERROR";
            }

            const latency =
                performance.now() - requestStarted;

            const index = Math.min(
                Math.floor(
                    (requestStarted - startedAt) / 5000
                ),
                windows.length - 1
            );

            const window = windows[index];

            statuses.set(
                status,
                (statuses.get(status) || 0) + 1
            );

            if (ok) {
                successful += 1;
                latencies.push(latency);

                window.successful += 1;
                window.latencies.push(latency);
            } else {
                failures += 1;
                window.failures += 1;
            }
        }
    }

    await Promise.all(
        Array.from(
            { length: concurrency },
            () => worker()
        )
    );

    const elapsedSeconds =
        (performance.now() - startedAt) / 1000;

    console.log("\nResultado geral:");

    console.table({
        durationSeconds:
            Number(elapsedSeconds.toFixed(2)),
        concurrency,
        successful,
        failures,
        requestsPerSecond:
            Number(
                (successful / elapsedSeconds).toFixed(2)
            ),
        p50Ms: percentile(latencies, 50),
        p95Ms: percentile(latencies, 95),
        p99Ms: percentile(latencies, 99),
    });

    console.log("\nIntervalos de 5 segundos:");

    console.table(
        windows.map(item => ({
            interval: item.interval,
            successful: item.successful,
            failures: item.failures,
            p95Ms: percentile(
                item.latencies, 95
            ),
        }))
    );

    console.log(
        "\nHTTP status:",
        Object.fromEntries(statuses)
    );

    if (failures > 0) {
        process.exitCode = 1;
    } else {
        console.log(
            "\nBE-17: carga sustentada concluída sem falhas."
        );
    }
}

main().catch(error => {
    console.error(
        "[BE-17] Falha:",
        error.message
    );

    process.exitCode = 1;
});

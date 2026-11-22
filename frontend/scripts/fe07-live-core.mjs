import assert from "node:assert/strict";

/** FE-07: testes reais são destrutivos e só podem atingir loopback local. */
export function assertLocalBackendUrl(raw) {
    let url;
    try {
        url = new URL(raw);
    } catch {
        throw new Error("FE07_BACKEND_URL deve ser uma URL HTTP local válida.");
    }
    if (
        url.protocol !== "http:" ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.username || url.password || url.search || url.hash ||
        (url.pathname !== "/" && url.pathname !== "")
    ) {
        throw new Error("FE-07 bloqueada: informe apenas http://localhost:PORTA ou http://127.0.0.1:PORTA.");
    }
    return url.origin;
}

export function createApi(baseUrl, fetchImpl = fetch) {
    const root = assertLocalBackendUrl(baseUrl);
    return async function request(method, path, { token, body, expected = [200] } = {}) {
        if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
            throw new Error("Caminho de API inválido.");
        }
        // jsdom não oferece AbortSignal.timeout em todas as versões.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        let response;
        try {
            response = await fetchImpl(`${root}/api/v1${path}`, {
                method,
                headers: {
                    Accept: "application/json",
                    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                signal: controller.signal,
                cache: "no-store",
            });
        } finally {
            clearTimeout(timer);
        }
        const raw = await response.text();
        let parsed = null;
        if (raw) {
            try { parsed = JSON.parse(raw); }
            catch { throw new Error(`${method} ${path}: resposta não é JSON (HTTP ${response.status}).`); }
        }
        if (!expected.includes(response.status)) {
            const code = parsed?.error?.code ?? "SEM_CODIGO";
            throw new Error(`${method} ${path}: HTTP ${response.status} (${code}), esperado: ${expected.join("/")}.`);
        }
        return { status: response.status, data: parsed?.data ?? null, error: parsed?.error ?? null };
    };
}

/** Listener sempre registrado ANTES da operação que pode emitir o evento. */
export function waitSocketEvent(socket, event, predicate = () => true, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`Timeout aguardando ${event}.`));
        }, timeoutMs);
        function onEvent(payload) {
            try {
                if (predicate(payload)) {
                    cleanup();
                    resolve(payload);
                }
            } catch (error) {
                cleanup();
                reject(error);
            }
        }
        function onConnectionError(error) {
            cleanup();
            reject(new Error(`Socket.IO: ${error?.data?.code ?? "CONNECT_ERROR"}`));
        }
        function cleanup() {
            clearTimeout(timer);
            socket.off(event, onEvent);
            if (event !== "connect_error") socket.off("connect_error", onConnectionError);
        }
        socket.on(event, onEvent);
        if (event !== "connect_error") socket.on("connect_error", onConnectionError);
    });
}

export async function socketAck(socket, event, payload) {
    assert.equal(socket.connected, true, `Socket desconectado para ${event}.`);
    let response;
    try {
        response = await socket.timeout(12000).emitWithAck(event, payload);
    } catch {
        throw new Error(`${event}: ACK indisponível/timeout.`);
    }
    if (response?.ok !== true) {
        throw new Error(`${event}: ${response?.error?.code ?? "ACK_INVALIDO"}`);
    }
    return response.data;
}

export function assertMessage(message, conversationId, senderId, content) {
    assert.equal(typeof message?._id, "string", "Mensagem sem _id.");
    assert.equal(message.conversation_id, conversationId);
    assert.equal(message.sender_id, senderId);
    assert.equal(message.content, content);
    return message;
}
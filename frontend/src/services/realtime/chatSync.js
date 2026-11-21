
const ACK_TIMEOUT = 10000;
const DEFAULT_LIMIT = 50;

function createSyncError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

export async function syncRealtimeMessages(
    socket,
    conversationId,
    {
        afterMessageId = null,
        limit = DEFAULT_LIMIT,
    } = {}
) {
    // 1. Verificar conexão
    if (!socket?.connected) {
        throw createSyncError(
            "Conexão em tempo real indisponível.",
            "REALTIME_DISCONNECTED"
        );
    }

    // 2. Validar parâmetros
    if (
        typeof conversationId !== "string" ||
        !conversationId.trim()
    ) {
        throw createSyncError(
            "Identificador da conversa inválido.",
            "INVALID_CONVERSATION_ID"
        );
    }

    if (
        afterMessageId !== null &&
        (
            typeof afterMessageId !== "string" ||
            !afterMessageId.trim()
        )
    ) {
        throw createSyncError(
            "Cursor de sincronização inválido.",
            "INVALID_SYNC_CURSOR"
        );
    }

    if (!Number.isInteger(limit) || limit < 1) {
        throw createSyncError(
            "Limite de sincronização inválido.",
            "INVALID_SYNC_LIMIT"
        );
    }

    // 3. Montar payload
    const payload = {
        conversationId,
        limit,
    };

    if (afterMessageId) {
        payload.afterMessageId = afterMessageId;
    }

    // 4. Solicitar sincronização
    let ack;

    try {
        ack = await socket
            .timeout(ACK_TIMEOUT)
            .emitWithAck(
                "realtime:sync",
                payload
            );
    } catch {
        throw createSyncError(
            "Não foi possível sincronizar as mensagens.",
            "REALTIME_SYNC_ACK_FAILED"
        );
    }

    // 5. Tratar erro do backend
    if (ack?.ok === false) {
        throw createSyncError(
            ack.error?.message ??
                "Não foi possível sincronizar as mensagens.",
            ack.error?.code ?? "REALTIME_SYNC_ERROR"
        );
    }

    // 6. Validar resposta
    const data = ack?.data;

    const expectedMode = afterMessageId
        ? "incremental"
        : "snapshot";

    const validResponse =
        ack?.ok === true &&
        data?.mode === expectedMode &&
        Array.isArray(data?.items) &&
        typeof data?.hasMore === "boolean" &&
        (
            data.nextAfterMessageId === null ||
            typeof data.nextAfterMessageId === "string"
        );

    if (!validResponse) {
        throw createSyncError(
            "Resposta de sincronização inválida.",
            "INVALID_SYNC_ACK"
        );
    }

    // 7. Validar mensagens recebidas
    const validMessages = data.items.every(
        (message) =>
            typeof message?._id === "string" &&
            message._id.length > 0 &&
            message.conversation_id === conversationId &&
            typeof message.content === "string"
    );

    if (!validMessages) {
        throw createSyncError(
            "A sincronização retornou mensagens inválidas.",
            "INVALID_SYNC_ACK"
        );
    }

    // 8. Impedir paginação sem avanço
    if (
        data.hasMore &&
        (
            !data.nextAfterMessageId ||
            data.nextAfterMessageId === afterMessageId
        )
    ) {
        throw createSyncError(
            "A sincronização não avançou o cursor.",
            "INVALID_SYNC_CURSOR"
        );
    }

    return data;
}

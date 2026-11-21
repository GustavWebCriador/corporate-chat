
const ACK_TIMEOUT = 10000;

function createCheckpointError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

async function sendCheckpoint(
    socket,
    event,
    conversationId,
    messageId
) {
    if (!socket?.connected) {
        throw createCheckpointError(
            "Conexão em tempo real indisponível.",
            "REALTIME_DISCONNECTED"
        );
    }

    let ack;

    try {
        ack = await socket
            .timeout(ACK_TIMEOUT)
            .emitWithAck(event, {
                conversationId,
                messageId,
            });
    } catch {
        throw createCheckpointError(
            "Não foi possível confirmar a operação.",
            "REALTIME_ACK_FAILED"
        );
    }

    if (ack?.ok === false) {
        throw createCheckpointError(
            ack.error?.message ??
                "Não foi possível atualizar a mensagem.",
            ack.error?.code ?? "REALTIME_CHECKPOINT_ERROR"
        );
    }

    if (
        ack?.ok !== true ||
        ack.data?.checkpoint?.conversation_id !== conversationId
    ) {
        throw createCheckpointError(
            "Resposta de confirmação inválida.",
            "INVALID_CHECKPOINT_ACK"
        );
    }

    return ack.data;
}

export function markRealtimeDelivered(
    socket,
    conversationId,
    messageId
) {
    return sendCheckpoint(
        socket,
        "message:delivered",
        conversationId,
        messageId
    );
}

export function markRealtimeRead(
    socket,
    conversationId,
    messageId
) {
    return sendCheckpoint(
        socket,
        "message:read",
        conversationId,
        messageId
    );
}

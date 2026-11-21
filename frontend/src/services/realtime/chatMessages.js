
const ACK_TIMEOUT = 10000;

export async function sendRealtimeMessage(
    socket,
    conversationId,
    { clientMessageId, content }
) {
    if (!socket?.connected) {
        const error = new Error(
            "Conexão em tempo real indisponível."
        );

        error.code = "REALTIME_DISCONNECTED";
        throw error;
    }

    let ack;

    try {
        ack = await socket
            .timeout(ACK_TIMEOUT)
            .emitWithAck("message:send", {
                conversationId,
                clientMessageId,
                content,
            });
    } catch {
        const error = new Error(
            "Não foi possível confirmar o envio da mensagem."
        );

        error.code = "REALTIME_ACK_FAILED";
        throw error;
    }

    if (!ack?.ok) {
        const error = new Error(
            ack?.error?.message ??
                "Não foi possível enviar a mensagem."
        );

        error.code =
            ack?.error?.code ?? "REALTIME_SEND_ERROR";

        throw error;
    }

    if (
        typeof ack.data?.message?._id !== "string"
    ) {
        const error = new Error(
            "Resposta de envio inválida."
        );

        error.code = "INVALID_MESSAGE_ACK";
        throw error;
    }

    return ack.data;
}

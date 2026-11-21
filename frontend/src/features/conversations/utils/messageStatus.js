
/**
 * Determina o estado de uma mensagem enviada
 * com base no checkpoint do destinatário.
 *
 * Este utilitário é destinado às conversas privadas.
 *
 * Estados:
 * sent      = enviada ao backend
 * delivered = entregue ao destinatário
 * read      = lida pelo destinatário
 *
 * null = mensagem recebida, sem indicador
 */
export function getMessageStatus({
    message,
    messages = [],
    currentUserId,
    recipientUserId,
    checkpoints = {},
}) {
    // Somente mensagens próprias possuem
    // indicador de envio nesta interface.
    if (
        !message?._id ||
        message.sender_id !== currentUserId
    ) {
        return null;
    }

    // A persistência já foi confirmada
    // antes de a mensagem entrar no histórico.
    const defaultStatus = "sent";

    if (
        typeof recipientUserId !== "string" ||
        !recipientUserId ||
        !Array.isArray(messages)
    ) {
        return defaultStatus;
    }

    const checkpoint = checkpoints[recipientUserId];

    if (!checkpoint) {
        return defaultStatus;
    }

    // Mensagens estão em ordem cronológica.
    // Não comparamos ObjectIds diretamente.
    const messageIndex = messages.findIndex(
        (item) => item._id === message._id
    );

    if (messageIndex === -1) {
        return defaultStatus;
    }

    const readIndex = messages.findIndex(
        (item) =>
            item._id === checkpoint.last_read_message_id
    );

    if (readIndex >= messageIndex) {
        return "read";
    }

    const deliveredIndex = messages.findIndex(
        (item) =>
            item._id === checkpoint.last_delivered_message_id
    );

    if (deliveredIndex >= messageIndex) {
        return "delivered";
    }

    // Se o checkpoint não estiver no histórico
    // carregado, não presumimos entrega ou leitura.
    return defaultStatus;
}

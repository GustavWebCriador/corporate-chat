export const MESSAGE_MAX_LENGTH = 1000;
export const HISTORY_PAGE_SIZE = 50;

/**
 * Estados funcionais da mensagem (RF07 / MESSAGES.md §5).
 * "sending" e "failed" existem apenas no cliente.
 */
export const MESSAGE_STATUS = Object.freeze({
    SENDING: "sending",
    SENT: "sent",
    DELIVERED: "delivered",
    READ: "read",
    FAILED: "failed",
});

/**
 * Gera o identificador idempotente do envio.
 * Reenvios da mesma mensagem reutilizam este valor.
 */
export function createClientMessageId() {
    if (globalThis.crypto?.randomUUID) {
        return `web-${globalThis.crypto.randomUUID()}`;
    }

    return `web-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
}

/**
 * Converte a mensagem persistida (contrato da API)
 * para o modelo usado pela interface.
 */
export function fromServerMessage(message, currentUserId) {
    const isOwn = message.sender_id === currentUserId;

    return {
        key: message._id,
        id: message._id,
        clientMessageId: message.client_message_id ?? null,
        senderId: message.sender_id,
        content: message.content,
        createdAt: message.created_at,
        isOwn,
        status: isOwn ? MESSAGE_STATUS.SENT : null,
    };
}

function compareMessages(a, b) {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();

    if (timeA !== timeB) {
        return timeA - timeB;
    }

    return String(a.id ?? a.key).localeCompare(String(b.id ?? b.key));
}

/**
 * Incorpora mensagens à lista sem duplicação.
 *
 * Mensagens são identificadas pelo _id persistido; mensagens locais
 * pendentes são conciliadas pelo clientMessageId.
 */
export function mergeMessages(current, incoming) {
    const result = [...current];

    for (const message of incoming) {
        const index = result.findIndex((item) =>
            (message.id && item.id === message.id) ||
            (message.clientMessageId &&
                item.clientMessageId === message.clientMessageId &&
                item.senderId === message.senderId)
        );

        if (index === -1) {
            result.push(message);
        } else {
            result[index] = {
                ...result[index],
                ...message,
                key: result[index].key,
            };
        }
    }

    // Pendentes/falhas ficam ao final, na ordem em que foram criadas.
    const persisted = result.filter((item) => item.id).sort(compareMessages);
    const pending = result.filter((item) => !item.id);

    return [...persisted, ...pending];
}

/**
 * Data e hora de envio (CA11.4).
 * Mensagens de hoje exibem só o horário; as demais, data e horário.
 */
export function formatMessageTimestamp(value, now = new Date()) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const time = date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });

    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (sameDay) {
        return time;
    }

    const day = date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });

    return `${day} ${time}`;
}

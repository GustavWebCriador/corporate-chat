// O DTO do dashboard usa last_message.message_id, não _id.
// Preserva essa convenção ao projetar eventos message:new no dashboard.
export function isValidRealtimeMessage(message) {
    return (
        typeof message?._id === "string" &&
        message._id.length > 0 &&
        typeof message.conversation_id === "string" &&
        message.conversation_id.length > 0 &&
        typeof message.sender_id === "string" &&
        typeof message.content === "string" &&
        typeof message.created_at === "string" &&
        Number.isFinite(Date.parse(message.created_at))
    );
}

function compareMessages(a, b) {
    const timeA = Date.parse(a.created_at);
    const timeB = Date.parse(b.created_at);

    if (timeA !== timeB) {
        return timeA - timeB;
    }

    return a._id.localeCompare(b._id);
}

export function rememberNewestMessage(messagesByConversation, message) {
    if (!isValidRealtimeMessage(message)) return;

    const previous = messagesByConversation.get(message.conversation_id);
    if (!previous || compareMessages(previous, message) < 0) {
        messagesByConversation.delete(message.conversation_id);
        messagesByConversation.set(message.conversation_id, message);
    }

    // Limita o armazenamento de eventos recentes no navegador.
    if (messagesByConversation.size > 100) {
        const oldestKey = messagesByConversation.keys().next().value;
        messagesByConversation.delete(oldestKey);
    }
}

function conversationActivity(conversation) {
    return Date.parse(
        conversation.last_message_at ??
        conversation.last_message?.created_at ??
        conversation.created_at ?? ""
    ) || 0;
}

export function mergeRealtimeMessage(dashboard, message) {
    if (
        !isValidRealtimeMessage(message) ||
        !Array.isArray(dashboard?.conversations)
    ) {
        return dashboard;
    }

    let updated = false;

    const conversations = dashboard.conversations.map((conversation) => {
        if (conversation.conversation_id !== message.conversation_id) {
            return conversation;
        }

        const previousMessage = conversation.last_message;
        const previousTime = Date.parse(
            previousMessage?.created_at ??
            conversation.last_message_at ?? ""
        );
        const incomingTime = Date.parse(message.created_at);

        // Não deixa eventos atrasados sobrescreverem a prévia mais recente.
        if (
            previousMessage?.message_id === message._id ||
            (Number.isFinite(previousTime) && previousTime > incomingTime) ||
            (
                Number.isFinite(previousTime) &&
                previousTime === incomingTime &&
                typeof previousMessage?.message_id === "string" &&
                previousMessage.message_id.localeCompare(message._id) >= 0
            )
        ) {
            return conversation;
        }

        updated = true;
        return {
            ...conversation,
            last_message: {
                message_id: message._id,
                sender_id: message.sender_id,
                content: message.content,
                created_at: message.created_at,
            },
            last_message_at: message.created_at,
        };
    });

    if (!updated) return dashboard;

    return {
        ...dashboard,
        conversations: conversations.sort((a, b) =>
            conversationActivity(b) - conversationActivity(a)
        ),
    };
}

// Um request HTTP iniciado antes de um evento realtime pode retornar depois.
// Reaplica os eventos vistos localmente para não regredir a interface.
export function replayRealtimeMessages(dashboard, messagesByConversation) {
    let result = dashboard;
    for (const message of messagesByConversation.values()) {
        result = mergeRealtimeMessage(result, message);
    }
    return result;
}
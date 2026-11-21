import { httpClient } from "./httpClient";

/**
 * Serviço de conversas e mensagens (FE-04).
 *
 * Contratos: docs/api-docs/CONVERSATION.md e MESSAGES.md.
 * A identidade do usuário é sempre obtida pelo backend a partir do JWT.
 */
export const conversationService = {
    // Cria ou reutiliza a conversa privada com outro usuário (RF06).
    openPrivate(otherUserId) {
        return httpClient.post("/conversations/private", {
            otherUserId,
        });
    },

    // Histórico paginado por cursor opaco (RF11).
    getHistory(conversationId, { before, limit = 50 } = {}) {
        const params = { limit };

        if (before) {
            params.before = before;
        }

        return httpClient.get(
            `/conversations/${conversationId}/messages`,
            { params }
        );
    },

    // Envio idempotente: reenvios reutilizam o mesmo clientMessageId (RF07/RF08).
    sendMessage(conversationId, { clientMessageId, content }) {
        return httpClient.post(
            `/conversations/${conversationId}/messages`,
            { clientMessageId, content }
        );
    },

    // Registra o checkpoint de leitura do usuário autenticado.
    markRead(conversationId, messageId) {
        return httpClient.patch(
            `/conversations/${conversationId}/read`,
            { messageId }
        );
    },
};

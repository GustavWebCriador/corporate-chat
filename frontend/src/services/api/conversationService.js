
import { httpClient } from "./httpClient";

export const conversationService = {
    createPrivate(otherUserId) {
        return httpClient.post("/conversations/private", {
            otherUserId,
        });
    },

    list() {
        return httpClient.get("/conversations");
    },

    getHistory(conversationId, { limit = 50, before = null } = {}) {
        return httpClient.get(
            `/conversations/${encodeURIComponent(conversationId)}/messages`,
            {
                params: {
                    limit,
                    ...(before ? { before } : {}),
                },
            }
        );
    },

    sendMessage(conversationId, { clientMessageId, content }) {
        return httpClient.post(
            `/conversations/${encodeURIComponent(conversationId)}/messages`,
            {
                clientMessageId,
                content,
            }
        );
    },


    markDelivered(conversationId, messageId) {
        return httpClient.patch(
            `/conversations/${encodeURIComponent(conversationId)}/delivery`,
            { messageId }
        );
    },

    markRead(conversationId, messageId) {
        return httpClient.patch(
            `/conversations/${encodeURIComponent(conversationId)}/read`,
            { messageId }
        );
    },

    getCheckpoints(conversationId) {
        return httpClient.get(
            `/conversations/${encodeURIComponent(conversationId)}/checkpoints`
        );
    },


};

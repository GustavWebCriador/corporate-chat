
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import { conversationService } from "./conversationService";
import { httpClient } from "./httpClient";

vi.mock("./httpClient", () => ({
    httpClient: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
    },
}));

describe("conversationService", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("deve criar ou reutilizar uma conversa privada", async () => {
        const response = {
            conversation: {
                _id: "507f1f77bcf86cd799439011",
                type: "PRIVATE",
            },
        };

        httpClient.post.mockResolvedValue(response);

        const result = await conversationService.createPrivate(
            "22222222-2222-4222-8222-222222222222"
        );

        expect(httpClient.post).toHaveBeenCalledWith(
            "/conversations/private",
            {
                otherUserId: "22222222-2222-4222-8222-222222222222",
            }
        );

        expect(result).toEqual(response);
    });

    it("deve listar as conversas do usuário autenticado", async () => {
        const response = {
            conversations: [],
        };

        httpClient.get.mockResolvedValue(response);

        const result = await conversationService.list();

        expect(httpClient.get).toHaveBeenCalledWith(
            "/conversations"
        );

        expect(result).toEqual(response);
    });

    it("deve consultar o histórico com limite padrão", async () => {
        const response = {
            items: [],
            hasMore: false,
            nextCursor: null,
        };

        httpClient.get.mockResolvedValue(response);

        const result = await conversationService.getHistory(
            "507f1f77bcf86cd799439011"
        );

        expect(httpClient.get).toHaveBeenCalledWith(
            "/conversations/507f1f77bcf86cd799439011/messages",
            {
                params: {
                    limit: 50,
                },
            }
        );

        expect(result).toEqual(response);
    });

    it("deve enviar o cursor recebido para a próxima página", async () => {
        httpClient.get.mockResolvedValue({
            items: [],
            hasMore: false,
            nextCursor: null,
        });

        await conversationService.getHistory(
            "507f1f77bcf86cd799439011",
            {
                limit: 20,
                before: "cursor-opaco",
            }
        );

        expect(httpClient.get).toHaveBeenCalledWith(
            "/conversations/507f1f77bcf86cd799439011/messages",
            {
                params: {
                    limit: 20,
                    before: "cursor-opaco",
                },
            }
        );
    });

    it("deve propagar erros da API", async () => {
        const apiError = new Error(
            "Usuário não é membro ativo da conversa."
        );

        apiError.status = 403;
        apiError.code = "USER_NOT_ACTIVE_MEMBER";

        httpClient.get.mockRejectedValue(apiError);

        await expect(
            conversationService.getHistory(
                "507f1f77bcf86cd799439011"
            )
        ).rejects.toMatchObject({
            status: 403,
            code: "USER_NOT_ACTIVE_MEMBER",
        });
    });

    it("deve enviar uma mensagem para a conversa", async () => {
        const conversationId = "507f1f77bcf86cd799439011";

        const payload = {
            clientMessageId: "web-msg-001",
            content: "Olá, tudo bem?",
        };

        const response = {
            message: {
                _id: "507f1f77bcf86cd799439012",
                conversation_id: conversationId,
                content: payload.content,
            },
            reused: false,
        };

        httpClient.post.mockResolvedValue(response);

        const result = await conversationService.sendMessage(
            conversationId,
            payload
        );

        expect(httpClient.post).toHaveBeenCalledWith(
            `/conversations/${conversationId}/messages`,
            payload
        );

        expect(result).toEqual(response);
    });

    it("deve preservar o clientMessageId em um reenvio", async () => {
        const conversationId = "507f1f77bcf86cd799439011";

        const payload = {
            clientMessageId: "web-msg-retry-001",
            content: "Mensagem com reenvio",
        };

        httpClient.post.mockResolvedValue({
            message: {
                _id: "507f1f77bcf86cd799439012",
            },
            reused: true,
        });

        await conversationService.sendMessage(
            conversationId,
            payload
        );

        await conversationService.sendMessage(
            conversationId,
            payload
        );

        expect(httpClient.post).toHaveBeenCalledTimes(2);

        expect(httpClient.post).toHaveBeenNthCalledWith(
            1,
            `/conversations/${conversationId}/messages`,
            payload
        );

        expect(httpClient.post).toHaveBeenNthCalledWith(
            2,
            `/conversations/${conversationId}/messages`,
            payload
        );
    });

    it("deve propagar erros ao enviar mensagens", async () => {
        const error = new Error(
            "A mensagem não pode estar vazia."
        );

        error.status = 400;
        error.code = "MESSAGE_CONTENT_REQUIRED";

        httpClient.post.mockRejectedValue(error);

        await expect(
            conversationService.sendMessage(
                "507f1f77bcf86cd799439011",
                {
                    clientMessageId: "web-msg-002",
                    content: "",
                }
            )
        ).rejects.toMatchObject({
            status: 400,
            code: "MESSAGE_CONTENT_REQUIRED",
        });
    });

    it("deve registrar a entrega de uma mensagem", async () => {
        const conversationId = "507f1f77bcf86cd799439011";
        const messageId = "507f1f77bcf86cd799439012";

        const response = {
            checkpoint: {
                conversation_id: conversationId,
                last_delivered_message_id: messageId,
            },
            advanced: true,
        };

        httpClient.patch.mockResolvedValue(response);

        const result = await conversationService.markDelivered(
            conversationId,
            messageId
        );

        expect(httpClient.patch).toHaveBeenCalledWith(
            `/conversations/${conversationId}/delivery`,
            { messageId }
        );

        expect(result).toEqual(response);
    });

    it("deve registrar a leitura de uma mensagem", async () => {
        const conversationId = "507f1f77bcf86cd799439011";
        const messageId = "507f1f77bcf86cd799439012";

        const response = {
            checkpoint: {
                conversation_id: conversationId,
                last_delivered_message_id: messageId,
                last_read_message_id: messageId,
            },
            advanced: true,
            deliveryAdvanced: true,
        };

        httpClient.patch.mockResolvedValue(response);

        const result = await conversationService.markRead(
            conversationId,
            messageId
        );

        expect(httpClient.patch).toHaveBeenCalledWith(
            `/conversations/${conversationId}/read`,
            { messageId }
        );

        expect(result).toEqual(response);
    });
});

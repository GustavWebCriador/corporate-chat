
import {
    beforeEach,
    expect,
    test,
    vi,
} from "vitest";

import { httpClient } from "./httpClient";
import { conversationService } from "./conversationService";

vi.mock("./httpClient", () => ({
    httpClient: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
    },
}));

const conversationId = "507f1f77bcf86cd799439011";

beforeEach(() => {
    vi.resetAllMocks();
});

test("deve consultar checkpoints pela API autenticada", async () => {
    const response = {
        checkpoints: [
            {
                conversation_id: conversationId,
                user_id: "user-02",
                last_read_message_id: "message-01",
            },
        ],
    };

    httpClient.get.mockResolvedValue(response);

    const result = await conversationService.getCheckpoints(
        conversationId
    );

    expect(httpClient.get).toHaveBeenCalledWith(
        `/conversations/${conversationId}/checkpoints`
    );

    expect(result).toEqual(response);
});

test("deve propagar erro da consulta de checkpoints", async () => {
    const error = new Error("Acesso negado.");
    error.status = 403;
    error.code = "USER_NOT_ACTIVE_MEMBER";

    httpClient.get.mockRejectedValue(error);

    await expect(
        conversationService.getCheckpoints(conversationId)
    ).rejects.toMatchObject({
        status: 403,
        code: "USER_NOT_ACTIVE_MEMBER",
    });
});

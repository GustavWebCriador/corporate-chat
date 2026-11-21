
import {
    expect,
    test,
    vi,
} from "vitest";

import { sendRealtimeMessage } from "./chatMessages";

const conversationId = "507f1f77bcf86cd799439011";

const payload = {
    clientMessageId: "client-msg-001",
    content: "Olá, Eduardo!",
};

function createSocket(ack) {
    const emitWithAck = vi.fn().mockResolvedValue(ack);

    const socket = {
        connected: true,
        timeout: vi.fn().mockReturnValue({
            emitWithAck,
        }),
    };

    return { socket, emitWithAck };
}

test("deve enviar mensagem pelo Socket.IO", async () => {
    const response = {
        message: {
            _id: "507f1f77bcf86cd799439012",
            conversation_id: conversationId,
            content: payload.content,
        },
        reused: false,
    };

    const { socket, emitWithAck } = createSocket({
        ok: true,
        data: response,
    });

    const result = await sendRealtimeMessage(
        socket,
        conversationId,
        payload
    );

    expect(socket.timeout).toHaveBeenCalledWith(10000);

    expect(emitWithAck).toHaveBeenCalledWith(
        "message:send",
        {
            conversationId,
            ...payload,
        }
    );

    expect(result).toEqual(response);
});

test("deve aceitar confirmação de reenvio idempotente", async () => {
    const { socket } = createSocket({
        ok: true,
        data: {
            message: {
                _id: "507f1f77bcf86cd799439012",
            },
            reused: true,
        },
    });

    const result = await sendRealtimeMessage(
        socket,
        conversationId,
        payload
    );

    expect(result.reused).toBe(true);
});

test("deve propagar erro retornado no ACK", async () => {
    const { socket } = createSocket({
        ok: false,
        error: {
            code: "SENDER_NOT_ACTIVE_MEMBER",
            message: "Acesso não autorizado.",
        },
    });

    await expect(
        sendRealtimeMessage(
            socket,
            conversationId,
            payload
        )
    ).rejects.toMatchObject({
        code: "SENDER_NOT_ACTIVE_MEMBER",
    });
});

test("deve tratar falha de confirmação", async () => {
    const { socket, emitWithAck } = createSocket(null);

    emitWithAck.mockRejectedValue(
        new Error("Timeout")
    );

    await expect(
        sendRealtimeMessage(
            socket,
            conversationId,
            payload
        )
    ).rejects.toMatchObject({
        code: "REALTIME_ACK_FAILED",
    });

    expect(emitWithAck).toHaveBeenCalledTimes(1);
});

test("não deve enviar sem conexão ativa", async () => {
    const { socket, emitWithAck } = createSocket(null);

    socket.connected = false;

    await expect(
        sendRealtimeMessage(
            socket,
            conversationId,
            payload
        )
    ).rejects.toMatchObject({
        code: "REALTIME_DISCONNECTED",
    });

    expect(emitWithAck).not.toHaveBeenCalled();
});

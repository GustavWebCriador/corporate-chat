
import {
    expect,
    test,
    vi,
} from "vitest";

import {
    markRealtimeDelivered,
    markRealtimeRead,
} from "./chatCheckpoints";

const conversationId = "507f1f77bcf86cd799439011";
const messageId = "507f1f77bcf86cd799439012";

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

test("deve confirmar entrega pelo Socket.IO", async () => {
    const { socket, emitWithAck } = createSocket({
        ok: true,
        data: {
            checkpoint: {
                conversation_id: conversationId,
                last_delivered_message_id: messageId,
            },
            advanced: true,
        },
    });

    const result = await markRealtimeDelivered(
        socket,
        conversationId,
        messageId
    );

    expect(socket.timeout).toHaveBeenCalledWith(10000);

    expect(emitWithAck).toHaveBeenCalledWith(
        "message:delivered",
        { conversationId, messageId }
    );

    expect(result.advanced).toBe(true);
});

test("deve confirmar leitura pelo Socket.IO", async () => {
    const { socket, emitWithAck } = createSocket({
        ok: true,
        data: {
            checkpoint: {
                conversation_id: conversationId,
                last_read_message_id: messageId,
            },
            advanced: true,
            deliveryAdvanced: true,
        },
    });

    const result = await markRealtimeRead(
        socket,
        conversationId,
        messageId
    );

    expect(emitWithAck).toHaveBeenCalledWith(
        "message:read",
        { conversationId, messageId }
    );

    expect(result.deliveryAdvanced).toBe(true);
});

test("deve propagar erro retornado pelo backend", async () => {
    const { socket } = createSocket({
        ok: false,
        error: {
            code: "USER_NOT_ACTIVE_MEMBER",
            message: "Acesso não autorizado.",
        },
    });

    await expect(
        markRealtimeRead(socket, conversationId, messageId)
    ).rejects.toMatchObject({
        code: "USER_NOT_ACTIVE_MEMBER",
    });
});

test("deve tratar timeout do ACK", async () => {
    const { socket, emitWithAck } = createSocket(null);

    emitWithAck.mockRejectedValue(
        new Error("Timeout")
    );

    await expect(
        markRealtimeDelivered(
            socket,
            conversationId,
            messageId
        )
    ).rejects.toMatchObject({
        code: "REALTIME_ACK_FAILED",
    });
});

test("não deve confirmar sem conexão ativa", async () => {
    const { socket, emitWithAck } = createSocket(null);

    socket.connected = false;

    await expect(
        markRealtimeRead(socket, conversationId, messageId)
    ).rejects.toMatchObject({
        code: "REALTIME_DISCONNECTED",
    });

    expect(emitWithAck).not.toHaveBeenCalled();
});

test("deve rejeitar resposta inválida", async () => {
    const { socket } = createSocket({
        ok: true,
        data: {},
    });

    await expect(
        markRealtimeRead(socket, conversationId, messageId)
    ).rejects.toMatchObject({
        code: "INVALID_CHECKPOINT_ACK",
    });
});
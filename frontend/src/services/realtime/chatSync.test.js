
import {
    expect,
    test,
    vi,
} from "vitest";

import { syncRealtimeMessages } from "./chatSync";

const conversationId = "507f1f77bcf86cd799439011";
const messageId = "607f1f77bcf86cd799439011";

const message = {
    _id: messageId,
    conversation_id: conversationId,
    sender_id: "user-01",
    content: "Mensagem sincronizada",
    created_at: "2026-11-21T10:00:00.000Z",
};

function createSocket(ack) {
    const emitWithAck = vi.fn().mockResolvedValue(ack);

    const socket = {
        connected: true,
        timeout: vi.fn().mockReturnValue({
            emitWithAck,
        }),
    };

    return {
        socket,
        emitWithAck,
    };
}

function createAck({
    mode = "snapshot",
    items = [message],
    hasMore = false,
    nextAfterMessageId = messageId,
} = {}) {
    return {
        ok: true,
        data: {
            mode,
            items,
            hasMore,
            nextAfterMessageId,
        },
    };
}

// ========================================
// 1. SNAPSHOT
// ========================================

test("deve sincronizar por snapshot sem cursor", async () => {
    const { socket, emitWithAck } = createSocket(
        createAck()
    );

    const result = await syncRealtimeMessages(
        socket,
        conversationId
    );

    expect(socket.timeout).toHaveBeenCalledWith(10000);

    expect(emitWithAck).toHaveBeenCalledWith(
        "realtime:sync",
        {
            conversationId,
            limit: 50,
        }
    );

    expect(result.mode).toBe("snapshot");
    expect(result.items).toHaveLength(1);
});

// ========================================
// 2. SINCRONIZAÇÃO INCREMENTAL
// ========================================

test("deve sincronizar após a última mensagem", async () => {
    const { socket, emitWithAck } = createSocket(
        createAck({
            mode: "incremental",
        })
    );

    const result = await syncRealtimeMessages(
        socket,
        conversationId,
        {
            afterMessageId: "507f1f77bcf86cd799439099",
        }
    );

    expect(emitWithAck).toHaveBeenCalledWith(
        "realtime:sync",
        {
            conversationId,
            afterMessageId: "507f1f77bcf86cd799439099",
            limit: 50,
        }
    );

    expect(result.mode).toBe("incremental");
});

// ========================================
// 3. PAGINAÇÃO
// ========================================

test("deve preservar cursor para próxima página", async () => {
    const { socket } = createSocket(
        createAck({
            mode: "incremental",
            hasMore: true,
        })
    );

    const result = await syncRealtimeMessages(
        socket,
        conversationId,
        {
            afterMessageId: "507f1f77bcf86cd799439099",
            limit: 20,
        }
    );

    expect(result.hasMore).toBe(true);
    expect(result.nextAfterMessageId).toBe(messageId);
});

// ========================================
// 4. ERRO DO BACKEND
// ========================================

test("deve propagar erro de autorização", async () => {
    const { socket } = createSocket({
        ok: false,
        error: {
            code: "USER_NOT_ACTIVE_MEMBER",
            message: "Acesso não autorizado.",
        },
    });

    await expect(
        syncRealtimeMessages(socket, conversationId)
    ).rejects.toMatchObject({
        code: "USER_NOT_ACTIVE_MEMBER",
    });
});

// ========================================
// 5. TIMEOUT
// ========================================

test("deve tratar timeout do ACK", async () => {
    const { socket, emitWithAck } = createSocket(null);

    emitWithAck.mockRejectedValue(
        new Error("Timeout")
    );

    await expect(
        syncRealtimeMessages(socket, conversationId)
    ).rejects.toMatchObject({
        code: "REALTIME_SYNC_ACK_FAILED",
    });
});

// ========================================
// 6. SOCKET DESCONECTADO
// ========================================

test("não deve sincronizar sem conexão", async () => {
    const { socket, emitWithAck } = createSocket(null);

    socket.connected = false;

    await expect(
        syncRealtimeMessages(socket, conversationId)
    ).rejects.toMatchObject({
        code: "REALTIME_DISCONNECTED",
    });

    expect(emitWithAck).not.toHaveBeenCalled();
});

// ========================================
// 7. ACK INVÁLIDO
// ========================================

test("deve rejeitar resposta inválida", async () => {
    const { socket } = createSocket({
        ok: true,
        data: {
            mode: "snapshot",
            items: null,
        },
    });

    await expect(
        syncRealtimeMessages(socket, conversationId)
    ).rejects.toMatchObject({
        code: "INVALID_SYNC_ACK",
    });
});

// ========================================
// 8. CURSOR SEM AVANÇO
// ========================================

test("deve rejeitar paginação sem avanço", async () => {
    const { socket } = createSocket(
        createAck({
            mode: "incremental",
            hasMore: true,
            nextAfterMessageId: messageId,
        })
    );

    await expect(
        syncRealtimeMessages(
            socket,
            conversationId,
            {
                afterMessageId: messageId,
            }
        )
    ).rejects.toMatchObject({
        code: "INVALID_SYNC_CURSOR",
    });
});

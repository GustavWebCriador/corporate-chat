
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";

import {
    afterEach,
    beforeEach,
    expect,
    test,
    vi,
} from "vitest";

import "@testing-library/jest-dom/vitest";

import { MessageCheckpoints } from "./MessageCheckpoints";

import { conversationService } from "../../../services/api/conversationService";
import { useRealtime } from "../../realtime/hooks/useRealtime";

import {
    markRealtimeDelivered,
    markRealtimeRead,
} from "../../../services/realtime/chatCheckpoints";

// ========================================
// MOCKS
// ========================================

vi.mock("../../../services/api/conversationService", () => ({
    conversationService: {
        markDelivered: vi.fn(),
        markRead: vi.fn(),
    },
}));

vi.mock("../../realtime/hooks/useRealtime", () => ({
    useRealtime: vi.fn(),
}));

vi.mock("../../../services/realtime/chatCheckpoints", () => ({
    markRealtimeDelivered: vi.fn(),
    markRealtimeRead: vi.fn(),
}));

// ========================================
// DADOS DE TESTE
// ========================================

const conversationId = "507f1f77bcf86cd799439011";
const currentUserId = "user-01";

const receivedMessage = {
    _id: "507f1f77bcf86cd799439012",
    conversation_id: conversationId,
    sender_id: "user-02",
    content: "Olá!",
};

function renderCheckpoints(messages = [receivedMessage]) {
    return render(
        <MessageCheckpoints
            conversationId={conversationId}
            currentUserId={currentUserId}
            messages={messages}
        />
    );
}

// ========================================
// PREPARAÇÃO
// ========================================

beforeEach(() => {
    vi.resetAllMocks();

    vi.spyOn(document, "hasFocus").mockReturnValue(false);

    useRealtime.mockReturnValue({
        socket: null,
        status: "disconnected",
    });

    conversationService.markDelivered.mockResolvedValue({
        advanced: true,
    });

    conversationService.markRead.mockResolvedValue({
        advanced: true,
    });

    markRealtimeDelivered.mockResolvedValue({
        advanced: true,
    });

    markRealtimeRead.mockResolvedValue({
        advanced: true,
        deliveryAdvanced: true,
    });
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// ========================================
// TESTE 1 - MENSAGENS PRÓPRIAS
// ========================================

test("não deve confirmar mensagens próprias", () => {
    renderCheckpoints([
        {
            ...receivedMessage,
            sender_id: currentUserId,
        },
    ]);

    expect(
        conversationService.markDelivered
    ).not.toHaveBeenCalled();

    expect(
        conversationService.markRead
    ).not.toHaveBeenCalled();

    expect(
        markRealtimeRead
    ).not.toHaveBeenCalled();
});

// ========================================
// TESTE 2 - ENTREGA HTTP
// ========================================

test("deve confirmar entrega por HTTP sem foco", async () => {
    renderCheckpoints();

    await waitFor(() => {
        expect(
            conversationService.markDelivered
        ).toHaveBeenCalledWith(
            conversationId,
            receivedMessage._id
        );
    });

    expect(markRealtimeDelivered).not.toHaveBeenCalled();
    expect(conversationService.markRead).not.toHaveBeenCalled();
});

// ========================================
// TESTE 3 - LEITURA HTTP
// ========================================

test("deve confirmar leitura por HTTP com foco", async () => {
    document.hasFocus.mockReturnValue(true);

    renderCheckpoints();

    await waitFor(() => {
        expect(
            conversationService.markRead
        ).toHaveBeenCalledWith(
            conversationId,
            receivedMessage._id
        );
    });

    expect(markRealtimeRead).not.toHaveBeenCalled();
    expect(conversationService.markDelivered).not.toHaveBeenCalled();
});

// ========================================
// TESTE 4 - ENTREGA SOCKET.IO
// ========================================

test("deve confirmar entrega pelo Socket.IO", async () => {
    const socket = { connected: true };

    useRealtime.mockReturnValue({
        socket,
        status: "connected",
    });

    renderCheckpoints();

    await waitFor(() => {
        expect(markRealtimeDelivered).toHaveBeenCalledWith(
            socket,
            conversationId,
            receivedMessage._id
        );
    });

    expect(
        conversationService.markDelivered
    ).not.toHaveBeenCalled();
});

// ========================================
// TESTE 5 - LEITURA SOCKET.IO
// ========================================

test("deve confirmar leitura pelo Socket.IO", async () => {
    document.hasFocus.mockReturnValue(true);

    const socket = { connected: true };

    useRealtime.mockReturnValue({
        socket,
        status: "connected",
    });

    renderCheckpoints();

    await waitFor(() => {
        expect(markRealtimeRead).toHaveBeenCalledWith(
            socket,
            conversationId,
            receivedMessage._id
        );
    });

    expect(
        conversationService.markRead
    ).not.toHaveBeenCalled();

    expect(
        markRealtimeDelivered
    ).not.toHaveBeenCalled();
});

// ========================================
// TESTE 6 - FALLBACK HTTP
// ========================================

test("deve usar HTTP se o socket estiver desconectado", async () => {
    useRealtime.mockReturnValue({
        socket: { connected: false },
        status: "connected",
    });

    renderCheckpoints();

    await waitFor(() => {
        expect(
            conversationService.markDelivered
        ).toHaveBeenCalledWith(
            conversationId,
            receivedMessage._id
        );
    });

    expect(
        markRealtimeDelivered
    ).not.toHaveBeenCalled();
});

// ========================================
// TESTE 7 - RETENTATIVA
// ========================================

test("deve permitir repetir confirmação após falha", async () => {
    document.hasFocus.mockReturnValue(true);

    const socket = { connected: true };

    useRealtime.mockReturnValue({
        socket,
        status: "connected",
    });

    markRealtimeRead
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValueOnce({
            advanced: true,
        });

    renderCheckpoints();

    expect(
        await screen.findByRole("alert")
    ).toHaveTextContent(
        "Não foi possível atualizar a confirmação"
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Tentar novamente",
        })
    );

    await waitFor(() => {
        expect(markRealtimeRead).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
        expect(
            screen.queryByRole("alert")
        ).not.toBeInTheDocument();
    });
});

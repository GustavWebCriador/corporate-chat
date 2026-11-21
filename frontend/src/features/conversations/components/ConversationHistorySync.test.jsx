
import {
    act,
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

import { ConversationHistory } from "./ConversationHistory";
import { useRealtime } from "../../realtime/hooks/useRealtime";
import { conversationService } from "../../../services/api/conversationService";
import { syncRealtimeMessages } from "../../../services/realtime/chatSync";

vi.mock("../../realtime/hooks/useRealtime", () => ({
    useRealtime: vi.fn(),
}));

vi.mock("../../realtime/hooks/useConversationCheckpoints", () => ({
    useConversationCheckpoints: vi.fn(() => ({})),
}));

vi.mock("../../../services/api/conversationService", () => ({
    conversationService: {
        getHistory: vi.fn(),
        sendMessage: vi.fn(),
    },
}));

vi.mock("../../../services/realtime/chatSync", () => ({
    syncRealtimeMessages: vi.fn(),
}));

vi.mock("../../../services/realtime/chatMessages", () => ({
    sendRealtimeMessage: vi.fn(),
}));

vi.mock("./MessageCheckpoints", () => ({
    MessageCheckpoints: () => null,
}));

const conversationId = "507f1f77bcf86cd799439011";

const oldMessage = {
    _id: "607f1f77bcf86cd799439011",
    conversation_id: conversationId,
    sender_id: "user-02",
    content: "Mensagem anterior",
    created_at: "2026-11-21T10:00:00.000Z",
};

const newMessage = {
    ...oldMessage,
    _id: "607f1f77bcf86cd799439012",
    content: "Mensagem sincronizada",
    created_at: "2026-11-21T10:01:00.000Z",
};

const thirdMessage = {
    ...oldMessage,
    _id: "607f1f77bcf86cd799439013",
    content: "Próxima página",
    created_at: "2026-11-21T10:02:00.000Z",
};

let socket;
let handlers;

function renderConversation() {
    return render(
        <ConversationHistory
            conversationId={conversationId}
            currentUserId="user-01"
            recipientUserId="user-02"
        />
    );
}

beforeEach(() => {
    vi.resetAllMocks();

    handlers = new Map();

    socket = {
        connected: true,

        on: vi.fn((event, callback) => {
            handlers.set(event, callback);
        }),

        off: vi.fn((event, callback) => {
            if (handlers.get(event) === callback) {
                handlers.delete(event);
            }
        }),
    };

    useRealtime.mockReturnValue({
        socket,
        status: "connected",
    });

    conversationService.getHistory.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
    });

    syncRealtimeMessages.mockResolvedValue({
        mode: "snapshot",
        items: [],
        hasMore: false,
        nextAfterMessageId: null,
    });
});

afterEach(() => {
    cleanup();
});

// ========================================
// 1. SNAPSHOT INICIAL
// ========================================

test("deve sincronizar por snapshot sem histórico local", async () => {
    renderConversation();

    await waitFor(() => {
        expect(syncRealtimeMessages).toHaveBeenCalledWith(
            socket,
            conversationId,
            { limit: 50 }
        );
    });
});

// ========================================
// 2. SINCRONIZAÇÃO INCREMENTAL
// ========================================

test("deve recuperar mensagens posteriores ao histórico", async () => {
    conversationService.getHistory.mockResolvedValue({
        items: [oldMessage],
        hasMore: false,
        nextCursor: null,
    });

    syncRealtimeMessages.mockResolvedValue({
        mode: "incremental",
        items: [newMessage],
        hasMore: false,
        nextAfterMessageId: newMessage._id,
    });

    renderConversation();

    await waitFor(() => {
        expect(syncRealtimeMessages).toHaveBeenCalledWith(
            socket,
            conversationId,
            {
                afterMessageId: oldMessage._id,
                limit: 50,
            }
        );
    });

    expect(
        await screen.findByText("Mensagem sincronizada")
    ).toBeInTheDocument();
});

// ========================================
// 3. PAGINAÇÃO DE SINCRONIZAÇÃO
// ========================================

test("deve recuperar todas as páginas disponíveis", async () => {
    conversationService.getHistory.mockResolvedValue({
        items: [oldMessage],
        hasMore: false,
        nextCursor: null,
    });

    syncRealtimeMessages
        .mockResolvedValueOnce({
            mode: "incremental",
            items: [newMessage],
            hasMore: true,
            nextAfterMessageId: newMessage._id,
        })
        .mockResolvedValueOnce({
            mode: "incremental",
            items: [thirdMessage],
            hasMore: false,
            nextAfterMessageId: thirdMessage._id,
        });

    renderConversation();

    await waitFor(() => {
        expect(syncRealtimeMessages).toHaveBeenCalledTimes(2);
    });

    expect(
        await screen.findByText("Mensagem sincronizada")
    ).toBeInTheDocument();

    expect(
        await screen.findByText("Próxima página")
    ).toBeInTheDocument();

    expect(syncRealtimeMessages).toHaveBeenLastCalledWith(
        socket,
        conversationId,
        {
            afterMessageId: newMessage._id,
            limit: 50,
        }
    );
});

// ========================================
// 4. EVITAR DUPLICAÇÕES
// ========================================

test("não deve duplicar mensagens sincronizadas", async () => {
    conversationService.getHistory.mockResolvedValue({
        items: [oldMessage],
        hasMore: false,
        nextCursor: null,
    });

    syncRealtimeMessages.mockResolvedValue({
        mode: "incremental",
        items: [oldMessage, newMessage, newMessage],
        hasMore: false,
        nextAfterMessageId: newMessage._id,
    });

    renderConversation();

    await screen.findByText("Mensagem sincronizada");

    expect(
        screen.getAllByText("Mensagem sincronizada")
    ).toHaveLength(1);

    expect(
        screen.getAllByText("Mensagem anterior")
    ).toHaveLength(1);
});

// ========================================
// 5. EVENTO DURANTE O CARREGAMENTO
// ========================================

test("deve preservar mensagem recebida antes do histórico", async () => {
    let resolveHistory;

    conversationService.getHistory.mockImplementation(
        () => new Promise((resolve) => {
            resolveHistory = resolve;
        })
    );

    renderConversation();

    act(() => {
        handlers.get("message:new")?.({
            message: newMessage,
        });
    });

    await act(async () => {
        resolveHistory({
            items: [],
            hasMore: false,
            nextCursor: null,
        });
    });

    expect(
        screen.getByText("Mensagem sincronizada")
    ).toBeInTheDocument();
});

// ========================================
// 6. RETENTATIVA DA SINCRONIZAÇÃO
// ========================================

test("deve permitir repetir sincronização após falha", async () => {
    syncRealtimeMessages
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValueOnce({
            mode: "snapshot",
            items: [newMessage],
            hasMore: false,
            nextAfterMessageId: newMessage._id,
        });

    renderConversation();

    expect(
        await screen.findByText(
            "Não foi possível sincronizar todas as mensagens."
        )
    ).toBeInTheDocument();

    fireEvent.click(
        screen.getByRole("button", {
            name: "Tentar sincronização",
        })
    );

    await waitFor(() => {
        expect(syncRealtimeMessages).toHaveBeenCalledTimes(2);
    });

    expect(
        await screen.findByText("Mensagem sincronizada")
    ).toBeInTheDocument();

    await waitFor(() => {
        expect(
            screen.queryByText(
                "Não foi possível sincronizar todas as mensagens."
            )
        ).not.toBeInTheDocument();
    });
});

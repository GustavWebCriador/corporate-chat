
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
import { sendRealtimeMessage } from "../../../services/realtime/chatMessages";

// ========================================
// MOCKS
// ========================================

vi.mock("../../realtime/hooks/useRealtime", () => ({
    useRealtime: vi.fn(),
}));

vi.mock("../../../services/api/conversationService", () => ({
    conversationService: {
        getHistory: vi.fn(),
        sendMessage: vi.fn(),
        markDelivered: vi.fn(),
        markRead: vi.fn(),
    },
}));

vi.mock("../../../services/realtime/chatMessages", () => ({
    sendRealtimeMessage: vi.fn(),
}));

// Isola os checkpoints nestes testes.
vi.mock("./MessageCheckpoints", () => ({
    MessageCheckpoints: () => null,
}));

// ========================================
// DADOS DE TESTE
// ========================================

const conversationId = "507f1f77bcf86cd799439011";
const currentUserId = "usuario-01";

const receivedMessage = {
    _id: "507f1f77bcf86cd799439012",
    conversation_id: conversationId,
    sender_id: "usuario-02",
    client_message_id: "client-001",
    content: "Olá pelo Socket.IO!",
    created_at: "2026-11-21T10:00:00.000Z",
};

let handlers;
let socket;

// ========================================
// PREPARAÇÃO
// ========================================

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
});

afterEach(() => {
    cleanup();
});

function renderConversation() {
    return render(
        <ConversationHistory
            conversationId={conversationId}
            currentUserId={currentUserId}
            createClientMessageId={() => "client-envio-001"}
        />
    );
}

async function waitForHistory() {
    await screen.findByText(
        "Nenhuma mensagem nesta conversa."
    );
}

// ========================================
// TESTE 1 - RECEBER MENSAGEM
// ========================================

test("deve receber mensagem em tempo real", async () => {
    renderConversation();

    await waitForHistory();

    act(() => {
        handlers.get("message:new")?.({
            message: receivedMessage,
        });
    });

    expect(
        await screen.findByText("Olá pelo Socket.IO!")
    ).toBeInTheDocument();

    expect(
        conversationService.getHistory
    ).toHaveBeenCalledTimes(1);
});

// ========================================
// TESTE 2 - EVITAR DUPLICAÇÃO
// ========================================

test("não deve duplicar mensagens recebidas", async () => {
    renderConversation();

    await waitForHistory();

    act(() => {
        handlers.get("message:new")?.({
            message: receivedMessage,
        });

        handlers.get("message:new")?.({
            message: receivedMessage,
        });
    });

    expect(
        screen.getAllByText("Olá pelo Socket.IO!")
    ).toHaveLength(1);
});

// ========================================
// TESTE 3 - IGNORAR OUTRA CONVERSA
// ========================================

test("deve ignorar mensagens de outra conversa", async () => {
    renderConversation();

    await waitForHistory();

    act(() => {
        handlers.get("message:new")?.({
            message: {
                ...receivedMessage,
                conversation_id:
                    "607f1f77bcf86cd799439011",
                content: "Mensagem de outra conversa",
            },
        });
    });

    expect(
        screen.queryByText(
            "Mensagem de outra conversa"
        )
    ).not.toBeInTheDocument();
});

// ========================================
// TESTE 4 - ENVIO POR SOCKET.IO
// ========================================

test("deve utilizar Socket.IO ao enviar mensagem", async () => {
    sendRealtimeMessage.mockResolvedValue({
        message: {
            ...receivedMessage,
            _id: "507f1f77bcf86cd799439013",
            sender_id: currentUserId,
            client_message_id: "client-envio-001",
            content: "Mensagem via Socket.IO",
        },
        reused: false,
    });

    renderConversation();

    await waitForHistory();

    fireEvent.change(
        screen.getByRole("textbox"),
        {
            target: {
                value: "Mensagem via Socket.IO",
            },
        }
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: /enviar/i,
        })
    );

    await waitFor(() => {
        expect(
            sendRealtimeMessage
        ).toHaveBeenCalledWith(
            socket,
            conversationId,
            {
                clientMessageId: "client-envio-001",
                content: "Mensagem via Socket.IO",
            }
        );
    });

    expect(
        conversationService.sendMessage
    ).not.toHaveBeenCalled();

    expect(
        await screen.findByText("Mensagem via Socket.IO")
    ).toBeInTheDocument();
});

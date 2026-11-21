
import {
    cleanup,
    render,
    screen,
    waitFor,
    within,
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
import { conversationService } from "../../../services/api/conversationService";
import { useRealtime } from "../../realtime/hooks/useRealtime";

vi.mock("../../realtime/hooks/useRealtime", () => ({
    useRealtime: vi.fn(),
}));

vi.mock("../../../services/api/conversationService", () => ({
    conversationService: {
        getHistory: vi.fn(),
        getCheckpoints: vi.fn(),
        sendMessage: vi.fn(),
    },
}));

// Os checkpoints enviados pelo usuário são
// isolados para testar apenas a recuperação.
vi.mock("./MessageCheckpoints", () => ({
    MessageCheckpoints: () => null,
}));

const conversationId = "507f1f77bcf86cd799439011";

const currentUserId = "user-01";
const recipientUserId = "user-02";

const firstMessage = {
    _id: "607f1f77bcf86cd799439011",
    conversation_id: conversationId,
    sender_id: currentUserId,
    content: "Mensagem persistida",
    created_at: "2026-11-21T10:00:00.000Z",
};

const secondMessage = {
    ...firstMessage,
    _id: "607f1f77bcf86cd799439012",
    content: "Mensagem mais recente",
    created_at: "2026-11-21T10:05:00.000Z",
};

const readCheckpoint = {
    conversation_id: conversationId,
    user_id: recipientUserId,
    last_delivered_message_id: firstMessage._id,
    last_delivered_at: "2026-11-21T10:01:00.000Z",
    last_read_message_id: firstMessage._id,
    last_read_at: "2026-11-21T10:02:00.000Z",
};

function renderConversation() {
    return render(
        <ConversationHistory
            conversationId={conversationId}
            currentUserId={currentUserId}
            recipientUserId={recipientUserId}
        />
    );
}

beforeEach(() => {
    vi.resetAllMocks();

    useRealtime.mockReturnValue({
        socket: null,
        status: "disconnected",
    });

    conversationService.getHistory.mockResolvedValue({
        items: [firstMessage],
        hasMore: false,
        nextCursor: null,
    });

    conversationService.getCheckpoints.mockResolvedValue({
        checkpoints: [readCheckpoint],
    });
});

afterEach(() => {
    cleanup();
});

// ========================================
// 1. CARREGAR LEITURA PERSISTIDA
// ========================================

test("deve apresentar Lida ao recuperar checkpoint HTTP", async () => {
    renderConversation();

    expect(
        await screen.findByText("Mensagem persistida")
    ).toBeInTheDocument();

    expect(
        await screen.findByLabelText(
            "Status da mensagem: Lida"
        )
    ).toBeInTheDocument();

    expect(
        conversationService.getCheckpoints
    ).toHaveBeenCalledWith(conversationId);
});

// ========================================
// 2. SIMULAR RECARREGAMENTO DA INTERFACE
// ========================================

test("deve recuperar Lida após remontar a conversa", async () => {
    const firstRender = renderConversation();

    await screen.findByLabelText(
        "Status da mensagem: Lida"
    );

    // Simula o descarte do estado React.
    firstRender.unmount();

    // Simula a abertura após F5 e novo login.
    renderConversation();

    expect(
        await screen.findByLabelText(
            "Status da mensagem: Lida"
        )
    ).toBeInTheDocument();

    await waitFor(() => {
        expect(
            conversationService.getCheckpoints
        ).toHaveBeenCalledTimes(2);
    });
});

// ========================================
// 3. NÃO MARCAR MENSAGENS NOVAS COMO LIDAS
// ========================================

test("não deve marcar mensagem posterior ao checkpoint como Lida", async () => {
    conversationService.getHistory.mockResolvedValue({
        items: [firstMessage, secondMessage],
        hasMore: false,
        nextCursor: null,
    });

    renderConversation();

    await screen.findByLabelText(
        "Status da mensagem: Lida"
    );

    const articles = screen.getAllByRole("article");

    expect(
        within(articles[0]).getByLabelText(
            "Status da mensagem: Lida"
        )
    ).toBeInTheDocument();

    expect(
        within(articles[1]).getByLabelText(
            "Status da mensagem: Enviada"
        )
    ).toBeInTheDocument();
});

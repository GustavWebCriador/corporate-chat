
import {
    afterEach,
    beforeEach,
    expect,
    test,
    vi,
} from "vitest";

import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";

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
        sendMessage: vi.fn(),
        markDelivered: vi.fn(),
        markRead: vi.fn(),
    },
}));

const conversationId = "507f1f77bcf86cd799439011";

beforeEach(() => {
    vi.resetAllMocks();

useRealtime.mockReturnValue({
    socket: null,
    status: "disconnected",
});
});

afterEach(() => {
    cleanup();
});

test("deve consultar e apresentar o histórico", async () => {
    conversationService.getHistory.mockResolvedValue({
        items: [
            {
                _id: "msg-01",
                sender_id: "user-02",
                content: "Olá, tudo bem?",
            },
        ],
        hasMore: false,
        nextCursor: null,
    });

    render(
        <ConversationHistory
            conversationId={conversationId}
            currentUserId="user-01"
        />
    );

    expect(
        await screen.findByText("Olá, tudo bem?")
    ).toBeInTheDocument();

    expect(
        conversationService.getHistory
    ).toHaveBeenCalledWith(conversationId);
});

test("deve apresentar estado vazio", async () => {
    conversationService.getHistory.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
    });

    render(
        <ConversationHistory
            conversationId={conversationId}
            currentUserId="user-01"
        />
    );

    expect(
        await screen.findByText(
            "Nenhuma mensagem nesta conversa."
        )
    ).toBeInTheDocument();
});

test("deve permitir tentar novamente após erro", async () => {
    conversationService.getHistory
        .mockRejectedValueOnce(new Error("Falha de conexão"))
        .mockResolvedValueOnce({
            items: [],
            hasMore: false,
            nextCursor: null,
        });

    render(
        <ConversationHistory
            conversationId={conversationId}
            currentUserId="user-01"
        />
    );

    expect(
        await screen.findByRole("alert")
    ).toHaveTextContent(
        "Não foi possível carregar o histórico."
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Tentar novamente",
        })
    );

    await waitFor(() => {
        expect(
            conversationService.getHistory
        ).toHaveBeenCalledTimes(2);
    });

    expect(
        await screen.findByText(
            "Nenhuma mensagem nesta conversa."
        )
    ).toBeInTheDocument();
});

test("deve carregar mensagens anteriores usando o cursor", async () => {
    conversationService.getHistory
        .mockResolvedValueOnce({
            items: [
                {
                    _id: "msg-02",
                    sender_id: "user-01",
                    content: "Mensagem recente",
                },
            ],
            hasMore: true,
            nextCursor: "cursor-02",
        })
        .mockResolvedValueOnce({
            items: [
                {
                    _id: "msg-01",
                    sender_id: "user-02",
                    content: "Mensagem antiga",
                },
            ],
            hasMore: false,
            nextCursor: null,
        });

    render(
        <ConversationHistory
            conversationId={conversationId}
            currentUserId="user-01"
        />
    );

    expect(
        await screen.findByText("Mensagem recente")
    ).toBeInTheDocument();

    fireEvent.click(
        screen.getByRole("button", {
            name: "Carregar mensagens anteriores",
        })
    );

    await waitFor(() => {
        expect(
            conversationService.getHistory
        ).toHaveBeenNthCalledWith(
            2,
            conversationId,
            {
                before: "cursor-02",
            }
        );
    });

    expect(
        await screen.findByText("Mensagem antiga")
    ).toBeInTheDocument();

    const messages = screen.getAllByRole("article");

    expect(messages).toHaveLength(2);
    expect(messages[0]).toHaveTextContent("Mensagem antiga");
    expect(messages[1]).toHaveTextContent("Mensagem recente");

    expect(
        screen.queryByRole("button", {
            name: "Carregar mensagens anteriores",
        })
    ).not.toBeInTheDocument();
});

test("deve preservar as mensagens se a paginação falhar", async () => {
    conversationService.getHistory
        .mockResolvedValueOnce({
            items: [
                {
                    _id: "msg-02",
                    sender_id: "user-01",
                    content: "Mensagem recente",
                },
            ],
            hasMore: true,
            nextCursor: "cursor-02",
        })
        .mockRejectedValueOnce(
            new Error("Falha de conexão")
        );

    render(
        <ConversationHistory
            conversationId={conversationId}
            currentUserId="user-01"
        />
    );

    fireEvent.click(
        await screen.findByRole("button", {
            name: "Carregar mensagens anteriores",
        })
    );

    expect(
        await screen.findByRole("alert")
    ).toHaveTextContent(
        "Não foi possível carregar mensagens anteriores."
    );

    expect(
        screen.getByText("Mensagem recente")
    ).toBeInTheDocument();

    expect(
        screen.getByRole("button", {
            name: "Carregar mensagens anteriores",
        })
    ).toBeEnabled();
});

test("deve apresentar a mensagem após confirmação do backend", async () => {
    conversationService.getHistory.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
    });

    conversationService.sendMessage.mockResolvedValue({
        message: {
            _id: "msg-01",
            conversation_id: conversationId,
            sender_id: "user-01",
            content: "Mensagem confirmada",
        },
        reused: false,
    });

    render(
        <ConversationHistory
            conversationId={conversationId}
            currentUserId="user-01"
            createClientMessageId={() => "client-msg-01"}
        />
    );

    const field = await screen.findByRole("textbox", {
        name: "Mensagem",
    });

    fireEvent.change(field, {
        target: { value: "Mensagem confirmada" },
    });

    fireEvent.click(
        screen.getByRole("button", { name: "Enviar" })
    );

    await waitFor(() => {
        expect(conversationService.sendMessage)
            .toHaveBeenCalledWith(conversationId, {
                clientMessageId: "client-msg-01",
                content: "Mensagem confirmada",
            });
    });

    expect(
        await screen.findByText("Mensagem confirmada")
    ).toBeInTheDocument();

    await waitFor(() => {
        expect(field).toHaveValue("");
    });
});

test("deve permitir reenviar após falha sem duplicar a mensagem", async () => {
    conversationService.getHistory.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
    });

    conversationService.sendMessage
        .mockRejectedValueOnce(new Error("Falha de rede"))
        .mockResolvedValueOnce({
            message: {
                _id: "msg-02",
                conversation_id: conversationId,
                sender_id: "user-01",
                content: "Mensagem recuperada",
            },
            reused: true,
        });

    render(
        <ConversationHistory
            conversationId={conversationId}
            currentUserId="user-01"
            createClientMessageId={() => "client-msg-retry"}
        />
    );

    fireEvent.change(
        await screen.findByRole("textbox", {
            name: "Mensagem",
        }),
        {
            target: { value: "Mensagem recuperada" },
        }
    );

    fireEvent.click(
        screen.getByRole("button", { name: "Enviar" })
    );

    expect(
        await screen.findByRole("alert")
    ).toHaveTextContent(
        "Não foi possível enviar a mensagem."
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Tentar novamente",
        })
    );

    expect(
        await screen.findByText("Mensagem recuperada")
    ).toBeInTheDocument();

    expect(conversationService.sendMessage)
        .toHaveBeenCalledTimes(2);

    expect(conversationService.sendMessage)
        .toHaveBeenNthCalledWith(1, conversationId, {
            clientMessageId: "client-msg-retry",
            content: "Mensagem recuperada",
        });

    expect(conversationService.sendMessage)
        .toHaveBeenNthCalledWith(2, conversationId, {
            clientMessageId: "client-msg-retry",
            content: "Mensagem recuperada",
        });

    expect(
        screen.getAllByText("Mensagem recuperada")
    ).toHaveLength(1);
});

test("não deve duplicar uma mensagem já presente no histórico", async () => {
    conversationService.getHistory.mockResolvedValue({
        items: [
            {
                _id: "msg-existing",
                conversation_id: conversationId,
                sender_id: "user-01",
                content: "Mensagem existente",
            },
        ],
        hasMore: false,
        nextCursor: null,
    });

    conversationService.sendMessage.mockResolvedValue({
        message: {
            _id: "msg-existing",
            conversation_id: conversationId,
            sender_id: "user-01",
            content: "Mensagem existente",
        },
        reused: true,
    });

    render(
        <ConversationHistory
            conversationId={conversationId}
            currentUserId="user-01"
            createClientMessageId={() => "client-existing"}
        />
    );

    fireEvent.change(
        await screen.findByRole("textbox", {
            name: "Mensagem",
        }),
        {
            target: { value: "Mensagem existente" },
        }
    );

    fireEvent.click(
        screen.getByRole("button", { name: "Enviar" })
    );

    await waitFor(() => {
        expect(conversationService.sendMessage)
            .toHaveBeenCalledTimes(1);
    });

    expect(
        screen.getAllByText("Mensagem existente")
    ).toHaveLength(1);
});

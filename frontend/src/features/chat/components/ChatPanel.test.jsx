import {
    afterEach,
    beforeEach,
    expect,
    test,
    vi,
} from "vitest";

import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import { ChatPanel } from "./ChatPanel";
import { conversationService } from "../../../services/api/conversationService";

vi.mock("../../../services/api/conversationService", () => ({
    conversationService: {
        getHistory: vi.fn(),
        sendMessage: vi.fn(),
        markRead: vi.fn(),
        openPrivate: vi.fn(),
    },
}));

const ME = {
    user_id: "11111111-1111-4111-8111-111111111111",
    name: "Alexandre Teste",
};

const MARIA = {
    user_id: "22222222-2222-4222-8222-222222222222",
    name: "Maria Oliveira",
};

const conversation = {
    conversation_id: "507f1f77bcf86cd799439011",
    type: "PRIVATE",
    name: null,
    contact: MARIA,
};

const usersById = new Map([[MARIA.user_id, MARIA]]);

function message(id, senderId, content, createdAt, clientMessageId) {
    return {
        _id: id,
        conversation_id: conversation.conversation_id,
        sender_id: senderId,
        client_message_id: clientMessageId ?? `client-${id}`,
        content,
        created_at: createdAt,
    };
}

function renderPanel(props = {}) {
    return render(
        <ChatPanel
            conversation={conversation}
            currentUser={ME}
            usersById={usersById}
            {...props}
        />
    );
}

beforeEach(() => {
    vi.resetAllMocks();

    conversationService.getHistory.mockResolvedValue({
        items: [
            message("m1", MARIA.user_id, "Bom dia!", "2026-11-19T09:00:00Z"),
            message("m2", ME.user_id, "Bom dia, Maria.", "2026-11-19T09:01:00Z"),
        ],
        hasMore: false,
        nextCursor: null,
    });

    conversationService.markRead.mockResolvedValue({ advanced: true });
});

afterEach(() => {
    cleanup();
});

test("carrega as últimas 50 mensagens com autor e data/hora (RF11)", async () => {
    renderPanel();

    expect(await screen.findByText("Bom dia!")).toBeInTheDocument();
    expect(screen.getByText("Bom dia, Maria.")).toBeInTheDocument();

    expect(conversationService.getHistory).toHaveBeenCalledWith(
        conversation.conversation_id,
        { limit: 50 }
    );

    const list = screen.getByRole("list", { name: "Mensagens" });
    expect(within(list).getByText("Maria Oliveira")).toBeInTheDocument();
    expect(within(list).getByText("Você")).toBeInTheDocument();
    expect(list.querySelectorAll("time")).toHaveLength(2);
    expect(within(list).getByText("Enviada")).toBeInTheDocument();
});

test("registra leitura da última mensagem recebida", async () => {
    renderPanel();

    await waitFor(() => {
        expect(conversationService.markRead).toHaveBeenCalledWith(
            conversation.conversation_id,
            "m1"
        );
    });
});

test("carrega mensagens anteriores usando o cursor do backend (CA11.3)", async () => {
    conversationService.getHistory
        .mockResolvedValueOnce({
            items: [
                message("m2", MARIA.user_id, "Recente", "2026-11-19T09:01:00Z"),
            ],
            hasMore: true,
            nextCursor: "cursor-opaco",
        })
        .mockResolvedValueOnce({
            items: [
                message("m1", MARIA.user_id, "Antiga", "2026-11-19T08:00:00Z"),
            ],
            hasMore: false,
            nextCursor: null,
        });

    renderPanel();

    fireEvent.click(
        await screen.findByRole("button", {
            name: "Carregar mensagens anteriores",
        })
    );

    expect(await screen.findByText("Antiga")).toBeInTheDocument();

    expect(conversationService.getHistory).toHaveBeenLastCalledWith(
        conversation.conversation_id,
        { limit: 50, before: "cursor-opaco" }
    );

    const items = screen
        .getByRole("list", { name: "Mensagens" })
        .querySelectorAll("li");

    expect(items[0]).toHaveTextContent("Antiga");
    expect(
        screen.queryByRole("button", {
            name: "Carregar mensagens anteriores",
        })
    ).not.toBeInTheDocument();
});

test("envia mensagem mostrando Enviando e depois Enviada (RF07)", async () => {
    let resolveSend;

    conversationService.sendMessage.mockImplementation(
        (_conversationId, payload) =>
            new Promise((resolve) => {
                resolveSend = () =>
                    resolve({
                        message: message(
                            "m3",
                            ME.user_id,
                            payload.content,
                            "2026-11-19T09:05:00Z",
                            payload.clientMessageId
                        ),
                        reused: false,
                    });
            })
    );

    const onMessageSent = vi.fn();
    renderPanel({ onMessageSent });

    const input = await screen.findByLabelText("Mensagem");

    fireEvent.change(input, { target: { value: "  Nova mensagem  " } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Enviando")).toBeInTheDocument();
    expect(input).toHaveValue("");

    const payload = conversationService.sendMessage.mock.calls[0][1];
    expect(payload.content).toBe("Nova mensagem");
    expect(payload.clientMessageId).toMatch(/^web-/);

    await act(async () => {
        resolveSend();
    });

    expect(screen.queryByText("Enviando")).not.toBeInTheDocument();
    expect(onMessageSent).toHaveBeenCalledWith(conversation.conversation_id);
});

test("indica falha e reenvia com o mesmo clientMessageId (CA08.3/CA08.4)", async () => {
    conversationService.sendMessage
        .mockRejectedValueOnce(new Error("Network Error"))
        .mockImplementationOnce((_id, payload) =>
            Promise.resolve({
                message: message(
                    "m3",
                    ME.user_id,
                    payload.content,
                    "2026-11-19T09:05:00Z",
                    payload.clientMessageId
                ),
                reused: true,
            })
        );

    renderPanel();

    fireEvent.change(await screen.findByLabelText("Mensagem"), {
        target: { value: "Mensagem offline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Falha no envio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
        expect(screen.queryByText("Falha no envio")).not.toBeInTheDocument();
    });

    const [first, second] = conversationService.sendMessage.mock.calls;
    expect(second[1].clientMessageId).toBe(first[1].clientMessageId);
    expect(screen.getAllByText("Mensagem offline")).toHaveLength(1);
});

test("reenvia falhas de conexão automaticamente ao voltar online", async () => {
    conversationService.sendMessage
        .mockRejectedValueOnce(new Error("Network Error"))
        .mockImplementationOnce((_id, payload) =>
            Promise.resolve({
                message: message(
                    "m3",
                    ME.user_id,
                    payload.content,
                    "2026-11-19T09:05:00Z",
                    payload.clientMessageId
                ),
                reused: false,
            })
        );

    renderPanel();

    fireEvent.change(await screen.findByLabelText("Mensagem"), {
        target: { value: "Volta a rede" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Falha no envio")).toBeInTheDocument();

    await act(async () => {
        window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
        expect(conversationService.sendMessage).toHaveBeenCalledTimes(2);
    });
});

test("não envia mensagem vazia e limita o campo a 1000 caracteres (CA07.2/CA07.3)", async () => {
    renderPanel();

    const input = await screen.findByLabelText("Mensagem");
    const button = screen.getByRole("button", { name: "Enviar" });

    expect(input).toHaveAttribute("maxLength", "1000");

    fireEvent.change(input, { target: { value: "    " } });
    expect(button).toBeDisabled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(conversationService.sendMessage).not.toHaveBeenCalled();
});

test("apresenta erro e permite tentar novamente ao falhar o histórico", async () => {
    conversationService.getHistory
        .mockRejectedValueOnce(Object.assign(new Error("x"), { status: 500 }))
        .mockResolvedValueOnce({ items: [], hasMore: false, nextCursor: null });

    renderPanel();

    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar as mensagens."
    );

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
        await screen.findByText("Nenhuma mensagem ainda. Envie a primeira!")
    ).toBeInTheDocument();
});

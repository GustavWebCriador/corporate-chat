import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { DashboardPage } from "./DashboardPage";
import { useAuth } from "../features/auth/hooks/useAuth";
import { useRealtime } from "../features/realtime/hooks/useRealtime";
import { dashboardService } from "../services/api/dashboardService";
import { markRealtimeDelivered } from "../services/realtime/chatCheckpoints";

vi.mock("../features/auth/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../features/realtime/hooks/useRealtime", () => ({ useRealtime: vi.fn() }));
vi.mock("../services/api/dashboardService", () => ({ dashboardService: { getDashboard: vi.fn() } }));
vi.mock("../services/realtime/chatCheckpoints", () => ({ markRealtimeDelivered: vi.fn() }));
vi.mock("../features/conversations/components/ConversationHistory", () => ({
    ConversationHistory: ({ conversationId }) => <p>Histórico {conversationId}</p>,
}));

const message = {
    _id: "507f1f77bcf86cd799439010",
    conversation_id: "group-01",
    sender_id: "user-02",
    content: "Nova mensagem em tempo real",
    created_at: "2026-11-21T13:00:00.000Z",
};
const contact = { user_id: "user-02", name: "Maria", email: "maria@empresa.com", status: "ACTIVE" };
const dashboard = {
    contacts: [contact],
    conversations: [
        {
            conversation_id: "private-01", type: "PRIVATE", contact,
            last_message_at: "2026-11-21T12:00:00.000Z",
            last_message: null,
        },
        {
            conversation_id: "group-01", type: "GROUP", name: "Equipe",
            last_message_at: null, last_message: null,
        },
    ],
};

let listeners;
let socket;

beforeEach(() => {
    vi.resetAllMocks();
    listeners = new Map();
    socket = {
        connected: true,
        on: vi.fn((event, callback) => listeners.set(event, callback)),
        off: vi.fn((event, callback) => {
            if (listeners.get(event) === callback) listeners.delete(event);
        }),
    };
    useAuth.mockReturnValue({
        user: { user_id: "current-user", name: "Usuário Teste" },
        logout: vi.fn().mockResolvedValue(),
        loading: false,
    });
    useRealtime.mockReturnValue({ socket, status: "connected", readyVersion: 1 });
    dashboardService.getDashboard.mockResolvedValue(dashboard);
    markRealtimeDelivered.mockResolvedValue({});
});

afterEach(cleanup);

async function openDashboard() {
    const view = render(<DashboardPage />);
    await screen.findByRole("button", { name: "Abrir grupo Equipe" });
    await waitFor(() => expect(listeners.has("message:new")).toBe(true));
    return view;
}

test("atualiza prévia e ordem sem atualizar a página", async () => {
    await openDashboard();
    act(() => listeners.get("message:new")({ message }));

    const section = screen.getByRole("heading", { name: "Conversas recentes" }).closest("section");
    await waitFor(() => {
        const items = within(section).getAllByRole("listitem");
        expect(items[0]).toHaveTextContent("Equipe");
        expect(items[0]).toHaveTextContent("Nova mensagem em tempo real");
    });
    expect(dashboardService.getDashboard).toHaveBeenCalledTimes(1);
});

test("confirma entrega de conversa não aberta, sem marcar leitura", async () => {
    await openDashboard();
    act(() => listeners.get("message:new")({ message }));

    await waitFor(() => {
        expect(markRealtimeDelivered).toHaveBeenCalledWith(socket, "group-01", message._id);
    });
    expect(markRealtimeDelivered).toHaveBeenCalledTimes(1);

    act(() => listeners.get("message:new")({ message }));
    expect(markRealtimeDelivered).toHaveBeenCalledTimes(1);
});

test("não confirma entrega da própria mensagem", async () => {
    await openDashboard();
    act(() => listeners.get("message:new")({ message: { ...message, sender_id: "current-user" } }));
    expect(await screen.findByText("Nova mensagem em tempo real")).toBeInTheDocument();
    expect(markRealtimeDelivered).not.toHaveBeenCalled();
});

test("não confirma entrega global da conversa selecionada", async () => {
    await openDashboard();
    const button = screen.getByRole("button", { name: "Abrir grupo Equipe" });
    act(() => button.click());
    expect(await screen.findByText("Histórico group-01")).toBeInTheDocument();
    act(() => listeners.get("message:new")({ message }));
    expect(markRealtimeDelivered).not.toHaveBeenCalled();
});

test("atualiza lista por HTTP quando chega mensagem de conversa ainda não listada", async () => {
    const unknownMessage = { ...message, conversation_id: "group-02" };
    const newConversation = {
        conversation_id: "group-02", type: "GROUP", name: "Novo grupo",
        last_message: null, last_message_at: null,
    };
    dashboardService.getDashboard
        .mockResolvedValueOnce(dashboard)
        .mockResolvedValueOnce({
            ...dashboard,
            conversations: [...dashboard.conversations, newConversation],
        });

    await openDashboard();
    act(() => listeners.get("message:new")({ message: unknownMessage }));
    expect(await screen.findByRole("button", { name: "Abrir grupo Novo grupo" })).toHaveTextContent(
        "Nova mensagem em tempo real"
    );
    expect(dashboardService.getDashboard).toHaveBeenCalledTimes(2);
});

test("reconexão atualiza prévias a partir do backend", async () => {
    const view = await openDashboard();
    useRealtime.mockReturnValue({ socket, status: "connected", readyVersion: 2 });
    view.rerender(<DashboardPage />);
    await waitFor(() => expect(dashboardService.getDashboard).toHaveBeenCalledTimes(2));
});

test("resposta HTTP atrasada não reverte prévia recebida via socket", async () => {
    let finishRequest;
    dashboardService.getDashboard
        .mockResolvedValueOnce(dashboard)
        .mockImplementationOnce(() => new Promise((resolve) => { finishRequest = resolve; }));
    const view = await openDashboard();
    useRealtime.mockReturnValue({ socket, status: "connected", readyVersion: 2 });
    view.rerender(<DashboardPage />);

    await waitFor(() => expect(finishRequest).toBeTypeOf("function"));
    act(() => listeners.get("message:new")({ message }));
    expect(await screen.findByText("Nova mensagem em tempo real")).toBeInTheDocument();
    await act(async () => finishRequest(dashboard));
    expect(screen.getByText("Nova mensagem em tempo real")).toBeInTheDocument();
});

test("remove listener ao desmontar o dashboard", async () => {
    const view = await openDashboard();
    view.unmount();
    expect(socket.off).toHaveBeenCalledWith("message:new", expect.any(Function));
});

test("reconcilia entrega de mensagem perdida durante desconexão", async () => {
    const view = await openDashboard();
    const offlineMessage = {
        message_id: "607f1f77bcf86cd799439020",
        sender_id: "user-02",
        content: "Chegou enquanto offline",
        created_at: "2026-11-21T14:00:00.000Z",
    };
    dashboardService.getDashboard.mockResolvedValueOnce({
        ...dashboard,
        conversations: dashboard.conversations.map((conversation) =>
            conversation.conversation_id === "group-01"
                ? {
                    ...conversation,
                    last_message: offlineMessage,
                    last_message_at: offlineMessage.created_at,
                }
                : conversation
        ),
    });

    useRealtime.mockReturnValue({ socket, status: "connected", readyVersion: 2 });
    view.rerender(<DashboardPage />);

    expect(await screen.findByText("Chegou enquanto offline")).toBeInTheDocument();
    await waitFor(() => {
        expect(markRealtimeDelivered).toHaveBeenCalledWith(
            socket,
            "group-01",
            offlineMessage.message_id
        );
    });
});

test("preserva o último dashboard após falha transitória de refresh", async () => {
    const view = await openDashboard();
    dashboardService.getDashboard.mockRejectedValueOnce(new Error("Offline"));
    useRealtime.mockReturnValue({ socket, status: "connected", readyVersion: 2 });
    view.rerender(<DashboardPage />);

    await waitFor(() => expect(dashboardService.getDashboard).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível carregar o dashboard"
    );
    expect(screen.getByRole("button", { name: "Abrir grupo Equipe" })).toBeInTheDocument();
});

test("ACK atrasado após desmontagem não provoca erro nem reaproveita cache", async () => {
    let resolveDelivery;
    markRealtimeDelivered.mockImplementation(() => new Promise((resolve) => {
        resolveDelivery = resolve;
    }));
    const view = await openDashboard();

    act(() => listeners.get("message:new")({ message }));
    await waitFor(() => expect(resolveDelivery).toBeTypeOf("function"));
    view.unmount();
    await act(async () => resolveDelivery({}));
    expect(socket.off).toHaveBeenCalledWith("message:new", expect.any(Function));
});
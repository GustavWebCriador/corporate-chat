import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { DashboardPage } from "./DashboardPage";
import { DashboardNavigationContext } from "../features/dashboard/context/DashboardNavigationContext";
import { dashboardService } from "../services/api/dashboardService";
import { conversationService } from "../services/api/conversationService";
import { groupService } from "../services/api/groupService";
import { useAuth } from "../features/auth/hooks/useAuth";
import { useRealtime } from "../features/realtime/hooks/useRealtime";
import { markRealtimeDelivered, markRealtimeRead } from "../services/realtime/chatCheckpoints";

vi.mock("../services/api/dashboardService", () => ({
    dashboardService: { getDashboard: vi.fn() },
}));
vi.mock("../services/api/conversationService", () => ({
    conversationService: {
        createPrivate: vi.fn(),
        getHistory: vi.fn(),
        getCheckpoints: vi.fn(),
    },
}));
vi.mock("../services/api/groupService", () => ({
    groupService: {
        create: vi.fn(),
        get: vi.fn(),
        rename: vi.fn(),
        addMembers: vi.fn(),
        removeMember: vi.fn(),
        leave: vi.fn(),
    },
}));
vi.mock("../features/auth/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../features/realtime/hooks/useRealtime", () => ({
    useRealtime: vi.fn(() => ({ socket: null, status: "disconnected" })),
}));

vi.mock("../services/realtime/chatCheckpoints", () => ({
    markRealtimeDelivered: vi.fn(),
    markRealtimeRead: vi.fn(),
}));

const groupId = "507f1f77bcf86cd799439011";
const privateId = "507f1f77bcf86cd799439012";
const contact = {
    user_id: "user-01", name: "Maria Oliveira", email: "maria@empresa.com", status: "ACTIVE",
};
const dashboard = { contacts: [contact], conversations: [] };
const group = {
    _id: groupId,
    type: "GROUP",
    name: "Equipe",
    members: [
        { user_id: "current-user", role: "CREATOR", status: "ACTIVE" },
        { user_id: "user-01", role: "MEMBER", status: "ACTIVE" },
    ],
};
const dashboardWithConversations = {
    ...dashboard,
    conversations: [
        { conversation_id: groupId, type: "GROUP", name: "Equipe", membership: { role: "CREATOR" }, last_message: null },
        { conversation_id: privateId, type: "PRIVATE", name: null, contact, last_message: null },
    ],
};

beforeEach(() => {
    vi.resetAllMocks();
    useRealtime.mockReturnValue({
        socket: null,
        status: "disconnected",
        readyVersion: 0,
    });
    markRealtimeDelivered.mockResolvedValue({});
    markRealtimeRead.mockResolvedValue({});
    useAuth.mockReturnValue({
        user: { user_id: "current-user", name: "Usuário Teste" },
        loading: false,
        logout: vi.fn().mockResolvedValue(),
    });
    dashboardService.getDashboard.mockResolvedValue(dashboard);
    conversationService.createPrivate.mockResolvedValue({ conversation: { _id: privateId, type: "PRIVATE" } });
    conversationService.getHistory.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
    conversationService.getCheckpoints.mockResolvedValue({ checkpoints: [] });
    groupService.create.mockResolvedValue({ group });
    groupService.get.mockResolvedValue({ group });
    groupService.rename.mockResolvedValue({ group });
    groupService.addMembers.mockResolvedValue({ group });
    groupService.removeMember.mockResolvedValue(null);
    groupService.leave.mockResolvedValue(null);
});
afterEach(cleanup);

// A FE-09 apresenta o diretório central somente quando selecionado na barra.
function DashboardOnContacts() {
    const [view, setView] = useState("contacts");
    return (
        <DashboardNavigationContext.Provider value={{ view, setView }}>
            <DashboardPage />
        </DashboardNavigationContext.Provider>
    );
}

test("deve carregar contatos reais do serviço", async () => {
    render(<DashboardOnContacts />);
    expect(await screen.findByText("Maria Oliveira")).toBeInTheDocument();
    expect(dashboardService.getDashboard).toHaveBeenCalledTimes(1);
});

test("deve apresentar o estado vazio", async () => {
    dashboardService.getDashboard.mockResolvedValue({
        contacts: [],
        conversations: [],
    });

    // Visualização Contatos
    const { unmount } = render(<DashboardOnContacts />);

    expect(
        await screen.findByText("Nenhum contato disponível.")
    ).toBeInTheDocument();

    unmount();

    // Visualização Conversas
    render(<DashboardPage />);

    expect(
        await screen.findByText("Nenhuma conversa iniciada.")
    ).toBeInTheDocument();

    expect(
        screen.getByRole("button", {
            name: "Novo grupo",
        })
    ).toBeDisabled();
});

test("deve permitir tentar novamente após erro", async () => {
    dashboardService.getDashboard.mockRejectedValueOnce(new Error("Falha")).mockResolvedValueOnce(dashboard);
    render(<DashboardOnContacts />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o dashboard.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Maria Oliveira")).toBeInTheDocument();
    expect(dashboardService.getDashboard).toHaveBeenCalledTimes(2);
});

test("deve preservar o logout", async () => {
    const logout = vi.fn().mockResolvedValue();
    useAuth.mockReturnValue({
        user: { user_id: "current-user", name: "Usuário Teste" }, loading: false, logout,
    });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
});

test("deve abrir conversa privada ao selecionar um contato", async () => {
    render(<DashboardOnContacts />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir conversa com Maria Oliveira" }));
    await waitFor(() => expect(conversationService.createPrivate).toHaveBeenCalledWith("user-01"));
    expect(await screen.findByRole("heading", { name: "Conversa com Maria Oliveira" })).toBeInTheDocument();
});

test("deve apresentar erro ao abrir conversa privada", async () => {
    conversationService.createPrivate.mockRejectedValue(new Error("Falha de conexão"));
    render(<DashboardOnContacts />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir conversa com Maria Oliveira" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível abrir a conversa.");
});

test("deve permitir abrir e cancelar a criação de grupo", async () => {
    render(<DashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    expect(screen.getByRole("dialog", { name: "Criar grupo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("deve criar grupo e atualizar o dashboard", async () => {
    render(<DashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Novo grupo" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome do grupo" }), {
        target: { value: "Equipe" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Maria Oliveira" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo" }));
    await waitFor(() => expect(groupService.create).toHaveBeenCalledWith("Equipe", ["user-01"]));
    expect(await screen.findByRole("heading", { name: "Grupo: Equipe" })).toBeInTheDocument();
    await waitFor(() => expect(dashboardService.getDashboard).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("deve listar e abrir grupo existente", async () => {
    dashboardService.getDashboard.mockResolvedValue(dashboardWithConversations);
    render(<DashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir grupo Equipe" }));
    expect(await screen.findByRole("heading", { name: "Grupo: Equipe" })).toBeInTheDocument();
    await waitFor(() => expect(conversationService.getHistory).toHaveBeenCalledWith(groupId));
});

test("deve abrir conversa privada a partir das recentes", async () => {
    dashboardService.getDashboard.mockResolvedValue(dashboardWithConversations);
    render(<DashboardPage />);
    const buttons = await screen.findAllByRole("button", { name: "Abrir conversa com Maria Oliveira" });
    fireEvent.click(buttons.at(-1));
    expect(await screen.findByRole("heading", { name: "Conversa com Maria Oliveira" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerenciar grupo" })).not.toBeInTheDocument();
});

test("deve permitir fechar a conversa selecionada", async () => {
    dashboardService.getDashboard.mockResolvedValue(dashboardWithConversations);
    render(<DashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir grupo Equipe" }));
    expect(await screen.findByRole("heading", { name: "Grupo: Equipe" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar conversa" }));
    expect(screen.queryByRole("heading", { name: "Grupo: Equipe" })).not.toBeInTheDocument();
});

test("deve abrir painel de gerenciamento de grupo selecionado", async () => {
    dashboardService.getDashboard.mockResolvedValue(dashboardWithConversations);
    render(<DashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir grupo Equipe" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar grupo" }));
    expect(await screen.findByRole("dialog", { name: "Gerenciar grupo" })).toBeInTheDocument();
    expect(groupService.get).toHaveBeenCalledWith(groupId);
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes do grupo" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("deve manter o botão de gerenciamento restrito a grupos", async () => {
    dashboardService.getDashboard.mockResolvedValue(dashboardWithConversations);
    render(<DashboardPage />);
    const buttons = await screen.findAllByRole("button", { name: "Abrir conversa com Maria Oliveira" });
    fireEvent.click(buttons.at(-1));
    expect(await screen.findByRole("heading", { name: "Conversa com Maria Oliveira" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerenciar grupo" })).not.toBeInTheDocument();
});


function makeSocket() {
    const handlers = new Map();
    const socket = {
        connected: true,
        on: vi.fn((event, callback) => handlers.set(event, callback)),
        off: vi.fn(),
    };
    return { socket, handlers };
}

const realtimeMessage = {
    _id: "607f1f77bcf86cd799439099",
    conversation_id: groupId,
    sender_id: "user-01",
    content: "Nova mensagem em tempo real",
    created_at: "2026-11-21T23:00:00.000Z",
};

test("FE-06: atualiza a prévia ao receber message:new", async () => {
    const { socket, handlers } = makeSocket();
    useRealtime.mockReturnValue({ socket, status: "connected", readyVersion: 0 });
    dashboardService.getDashboard.mockResolvedValue(dashboardWithConversations);
    render(<DashboardPage />);
    await screen.findByRole("button", { name: "Abrir grupo Equipe" });

    act(() => handlers.get("message:new")?.({ message: realtimeMessage }));
    expect(await screen.findByText(realtimeMessage.content)).toBeInTheDocument();
});

test("FE-06: atualiza dashboard após reconexão", async () => {
    const { socket } = makeSocket();

    useRealtime.mockReturnValue({
        socket,
        status: "connected",
        readyVersion: 0,
    });

    const { rerender } = render(<DashboardPage />);

    // Aguarda o carregamento inicial do dashboard.
    expect(
        await screen.findByText("Nenhuma conversa iniciada.")
    ).toBeInTheDocument();

    expect(
        dashboardService.getDashboard
    ).toHaveBeenCalledTimes(1);

    // Simula uma reconexão do Socket.IO.
    useRealtime.mockReturnValue({
        socket,
        status: "connected",
        readyVersion: 1,
    });

    rerender(<DashboardPage />);

    await waitFor(() => {
        expect(
            dashboardService.getDashboard
        ).toHaveBeenCalledTimes(2);
    });
});

test("FE-06: confirma entrega sem abrir a conversa", async () => {
    const { socket, handlers } = makeSocket();
    useRealtime.mockReturnValue({ socket, status: "connected", readyVersion: 0 });
    dashboardService.getDashboard.mockResolvedValue(dashboardWithConversations);
    render(<DashboardPage />);
    await screen.findByRole("button", { name: "Abrir grupo Equipe" });

    act(() => handlers.get("message:new")?.({ message: realtimeMessage }));
    await waitFor(() => expect(markRealtimeDelivered).toHaveBeenCalledWith(
        socket, groupId, realtimeMessage._id
    ));
    expect(markRealtimeRead).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Grupo: Equipe" })).not.toBeInTheDocument();
});

test("FE-06: não confirma entrega da própria mensagem", async () => {
    const { socket, handlers } = makeSocket();
    useRealtime.mockReturnValue({ socket, status: "connected", readyVersion: 0 });
    dashboardService.getDashboard.mockResolvedValue(dashboardWithConversations);
    render(<DashboardPage />);
    await screen.findByRole("button", { name: "Abrir grupo Equipe" });

    act(() => handlers.get("message:new")?.({
        message: { ...realtimeMessage, sender_id: "current-user" },
    }));
    expect(markRealtimeDelivered).not.toHaveBeenCalled();
    expect(markRealtimeRead).not.toHaveBeenCalled();
});

test("FE-06: repete entrega após reconexão", async () => {
    const { socket, handlers } = makeSocket();
    markRealtimeDelivered.mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValue({});
    useRealtime.mockReturnValue({ socket, status: "connected", readyVersion: 0 });
    dashboardService.getDashboard.mockResolvedValue(dashboardWithConversations);
    const { rerender } = render(<DashboardPage />);
    await screen.findByRole("button", { name: "Abrir grupo Equipe" });

    await act(async () => {
        handlers.get("message:new")?.({ message: realtimeMessage });
        await Promise.resolve();
    });
    expect(markRealtimeDelivered).toHaveBeenCalledTimes(1);

    useRealtime.mockReturnValue({ socket, status: "connected", readyVersion: 1 });
    rerender(<DashboardPage />);
    await waitFor(() => expect(markRealtimeDelivered).toHaveBeenCalledTimes(2));
});

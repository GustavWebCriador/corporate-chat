
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { DashboardPage } from "./DashboardPage";
import { dashboardService } from "../services/api/dashboardService";
import { conversationService } from "../services/api/conversationService";
import { groupService } from "../services/api/groupService";
import { useAuth } from "../features/auth/hooks/useAuth";

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

test("deve carregar contatos reais do serviço", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("Maria Oliveira")).toBeInTheDocument();
    expect(dashboardService.getDashboard).toHaveBeenCalledTimes(1);
});

test("deve apresentar o estado vazio", async () => {
    dashboardService.getDashboard.mockResolvedValue({ contacts: [], conversations: [] });
    render(<DashboardPage />);
    expect(await screen.findByText("Nenhum contato disponível.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma conversa iniciada.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo grupo" })).toBeDisabled();
});

test("deve permitir tentar novamente após erro", async () => {
    dashboardService.getDashboard.mockRejectedValueOnce(new Error("Falha")).mockResolvedValueOnce(dashboard);
    render(<DashboardPage />);
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
    render(<DashboardPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir conversa com Maria Oliveira" }));
    await waitFor(() => expect(conversationService.createPrivate).toHaveBeenCalledWith("user-01"));
    expect(await screen.findByRole("heading", { name: "Conversa com Maria Oliveira" })).toBeInTheDocument();
});

test("deve apresentar erro ao abrir conversa privada", async () => {
    conversationService.createPrivate.mockRejectedValue(new Error("Falha de conexão"));
    render(<DashboardPage />);
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

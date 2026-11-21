
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

import { DashboardPage } from "./DashboardPage";
import { dashboardService } from "../services/api/dashboardService";
import { conversationService } from "../services/api/conversationService";
import { useAuth } from "../features/auth/hooks/useAuth";

vi.mock("../services/api/dashboardService", () => ({
    dashboardService: {
        getDashboard: vi.fn(),
    },
}));

vi.mock("../services/api/conversationService", () => ({
    conversationService: {
        openPrivate: vi.fn(),
        getHistory: vi.fn(),
        sendMessage: vi.fn(),
        markRead: vi.fn(),
    },
}));

vi.mock("../features/auth/hooks/useAuth", () => ({
    useAuth: vi.fn(),
}));

const dashboard = {
    contacts: [
        {
            user_id: "user-01",
            name: "Maria Oliveira",
            email: "maria@empresa.com",
            status: "ACTIVE",
        },
    ],
    conversations: [],
};

beforeEach(() => {
    vi.resetAllMocks();

    useAuth.mockReturnValue({
        user: { user_id: "user-me", name: "Usuário Teste" },
        loading: false,
        logout: vi.fn().mockResolvedValue(),
    });

    dashboardService.getDashboard.mockResolvedValue(dashboard);

    conversationService.getHistory.mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: null,
    });
});

afterEach(() => {
    cleanup();
});

test("deve carregar contatos reais do serviço", async () => {
    render(<DashboardPage />);

    expect(
        await screen.findByText("Maria Oliveira")
    ).toBeInTheDocument();

    expect(dashboardService.getDashboard)
        .toHaveBeenCalledTimes(1);
});

test("deve apresentar o estado vazio", async () => {
    dashboardService.getDashboard.mockResolvedValue({
        contacts: [],
        conversations: [],
    });

    render(<DashboardPage />);

    expect(
        await screen.findByText("Nenhum contato disponível.")
    ).toBeInTheDocument();

    expect(
        screen.getByText("Nenhuma conversa iniciada.")
    ).toBeInTheDocument();
});

test("deve permitir tentar novamente após erro", async () => {
    dashboardService.getDashboard
        .mockRejectedValueOnce(new Error("Falha"))
        .mockResolvedValueOnce(dashboard);

    render(<DashboardPage />);

    expect(
        await screen.findByRole("alert")
    ).toHaveTextContent(
        "Não foi possível carregar o dashboard."
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Tentar novamente",
        })
    );

    expect(
        await screen.findByText("Maria Oliveira")
    ).toBeInTheDocument();

    expect(dashboardService.getDashboard)
        .toHaveBeenCalledTimes(2);
});

test("deve preservar o logout da FE-02", async () => {
    const logout = vi.fn().mockResolvedValue();

    useAuth.mockReturnValue({
        user: { name: "Usuário Teste" },
        loading: false,
        logout,
    });

    render(<DashboardPage />);

    fireEvent.click(
        screen.getByRole("button", {
            name: "Sair",
        })
    );

    await waitFor(() => {
        expect(logout).toHaveBeenCalledTimes(1);
    });
});

test("deve abrir a conversa privada ao selecionar um contato (CA05.2)", async () => {
    conversationService.openPrivate.mockResolvedValue({
        conversation: { _id: "507f1f77bcf86cd799439011", type: "PRIVATE" },
    });

    render(<DashboardPage />);

    fireEvent.click(
        await screen.findByRole("button", {
            name: "Conversar com Maria Oliveira",
        })
    );

    expect(
        await screen.findByRole("region", {
            name: "Conversa com Maria Oliveira",
        })
    ).toBeInTheDocument();

    expect(conversationService.openPrivate)
        .toHaveBeenCalledWith("user-01");

    expect(conversationService.getHistory).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        { limit: 50 }
    );
});

test("deve abrir conversa existente pela lista de conversas", async () => {
    dashboardService.getDashboard.mockResolvedValue({
        ...dashboard,
        conversations: [
            {
                conversation_id: "conv-group",
                type: "GROUP",
                name: "Equipe Projeto",
                contact: null,
                last_message: null,
                last_message_at: null,
            },
        ],
    });

    render(<DashboardPage />);

    fireEvent.click(
        await screen.findByRole("button", { name: /Equipe Projeto/ })
    );

    expect(
        await screen.findByRole("region", {
            name: "Conversa com Equipe Projeto",
        })
    ).toBeInTheDocument();

    expect(conversationService.openPrivate).not.toHaveBeenCalled();
});

test("deve informar falha ao abrir conversa", async () => {
    conversationService.openPrivate.mockRejectedValue(new Error("Falha"));

    render(<DashboardPage />);

    fireEvent.click(
        await screen.findByRole("button", {
            name: "Conversar com Maria Oliveira",
        })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível abrir a conversa com Maria Oliveira."
    );
});

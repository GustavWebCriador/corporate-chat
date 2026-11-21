
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
        createPrivate: vi.fn(),
        getHistory: vi.fn(),
    },
}));

vi.mock("../features/auth/hooks/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../features/realtime/hooks/useRealtime", () => ({
    useRealtime: vi.fn(() => ({
        socket: null,
        status: "disconnected",
    })),
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
        user: {
            name: "Usuário Teste",
        },
        loading: false,
        logout: vi.fn().mockResolvedValue(),
    });

    dashboardService.getDashboard.mockResolvedValue(
        dashboard
    );

    conversationService.createPrivate.mockResolvedValue({
        conversation: {
            _id: "507f1f77bcf86cd799439011",
            type: "PRIVATE",
        },
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

// FE-03 — Carregamento dos contatos
test("deve carregar contatos reais do serviço", async () => {
    render(<DashboardPage />);

    expect(
        await screen.findByText("Maria Oliveira")
    ).toBeInTheDocument();

    expect(
        dashboardService.getDashboard
    ).toHaveBeenCalledTimes(1);
});

// FE-03 — Estado vazio
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

// FE-03 — Tratamento de erros e nova tentativa
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

    expect(
        dashboardService.getDashboard
    ).toHaveBeenCalledTimes(2);
});

// FE-03 — Preservação do logout da FE-02
test("deve preservar o logout da FE-02", async () => {
    const logout = vi.fn().mockResolvedValue();

    useAuth.mockReturnValue({
        user: {
            name: "Usuário Teste",
        },
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

// FE-04 — Seleção e abertura de conversa privada
test("deve abrir conversa privada ao selecionar um contato", async () => {
    render(<DashboardPage />);

    fireEvent.click(
        await screen.findByRole("button", {
            name: "Abrir conversa com Maria Oliveira",
        })
    );

    await waitFor(() => {
        expect(
            conversationService.createPrivate
        ).toHaveBeenCalledWith("user-01");
    });

    expect(
        await screen.findByRole("heading", {
            name: "Conversa com Maria Oliveira",
        })
    ).toBeInTheDocument();

    expect(
        conversationService.createPrivate
    ).toHaveBeenCalledTimes(1);
});

// FE-04 — Tratamento de falha ao abrir uma conversa
test("deve apresentar erro quando não consegue abrir conversa", async () => {
    conversationService.createPrivate.mockRejectedValue(
        new Error("Falha de conexão")
    );

    render(<DashboardPage />);

    fireEvent.click(
        await screen.findByRole("button", {
            name: "Abrir conversa com Maria Oliveira",
        })
    );

    expect(
        await screen.findByRole("alert")
    ).toHaveTextContent(
        "Não foi possível abrir a conversa."
    );

    expect(
        conversationService.createPrivate
    ).toHaveBeenCalledTimes(1);
});


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
import { useAuth } from "../features/auth/hooks/useAuth";

vi.mock("../services/api/dashboardService", () => ({
    dashboardService: {
        getDashboard: vi.fn(),
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
        user: { name: "Usuário Teste" },
        loading: false,
        logout: vi.fn().mockResolvedValue(),
    });

    dashboardService.getDashboard.mockResolvedValue(dashboard);
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

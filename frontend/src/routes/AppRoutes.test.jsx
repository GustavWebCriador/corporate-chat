
import {
    afterEach,
    beforeEach,
    expect,
    test,
    vi,
} from "vitest";

import {
    cleanup,
    render,
    screen,
    waitFor,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import {
    MemoryRouter,
    useLocation,
} from "react-router-dom";

import { AppRoutes } from "./AppRoutes";
import { useAuth } from "../features/auth/hooks/useAuth";
import { dashboardService } from "../services/api/dashboardService";

vi.mock("../features/auth/hooks/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../services/api/dashboardService", () => ({
    dashboardService: {
        getDashboard: vi.fn(),
    },
}));

function LocationSpy() {
    const location = useLocation();

    return (
        <output data-testid="current-route">
            {location.pathname}
        </output>
    );
}

function renderRoutes(initialPath) {
    return render(
        <MemoryRouter initialEntries={[initialPath]}>
            <AppRoutes />
            <LocationSpy />
        </MemoryRouter>
    );
}

beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
        user: null,
        token: null,
        loading: false,
        isAuthenticated: false,
        login: vi.fn(),
        logout: vi.fn(),
    });

    dashboardService.getDashboard.mockResolvedValue({
        contacts: [],
        conversations: [],
    });
});

afterEach(() => {
    cleanup();
});

test("deve apresentar a página de solicitação de acesso", () => {
    renderRoutes("/solicitar-acesso");

    expect(
        screen.getByRole("heading", {
            name: "Solicitar acesso",
            level: 1,
        })
    ).toBeInTheDocument();

    expect(
        screen.getByTestId("current-route")
    ).toHaveTextContent("/solicitar-acesso");
});

test("deve apresentar página não encontrada", () => {
    renderRoutes("/pagina-inexistente");

    expect(
        screen.getByRole("heading", {
            name: "Página não encontrada",
        })
    ).toBeInTheDocument();
});

test("deve redirecionar usuário não autenticado para login", async () => {
    renderRoutes("/dashboard");

    await waitFor(() => {
        expect(
            screen.getByTestId("current-route")
        ).toHaveTextContent("/login");
    });

    expect(
        screen.queryByRole("heading", {
            name: "Dashboard",
            level: 1,
        })
    ).not.toBeInTheDocument();

    // Rotas protegidas não devem consultar dados
    // do dashboard sem uma sessão autenticada.
    expect(
        dashboardService.getDashboard
    ).not.toHaveBeenCalled();
});

test("deve permitir acesso ao dashboard autenticado", () => {
    useAuth.mockReturnValue({
        user: {
            id: "usuario-teste",
            name: "Usuário Teste",
        },
        token: "jwt-simulado",
        loading: false,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
    });

    renderRoutes("/dashboard");

    expect(
        screen.getByRole("complementary", {
            name: "Identidade da aplicação",
        })
    ).toBeInTheDocument();

    expect(
        screen.getByRole("heading", {
            name: "Dashboard",
            level: 1,
        })
    ).toBeInTheDocument();

    expect(
        screen.getByText(/Bem-vindo, Usuário Teste/i)
    ).toBeInTheDocument();

    expect(
        screen.getByTestId("current-route")
    ).toHaveTextContent("/dashboard");
});

test("deve levar usuário autenticado do login para o dashboard", async () => {
    useAuth.mockReturnValue({
        user: { name: "Usuário Teste" },
        token: "jwt-simulado",
        loading: false,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
    });

    renderRoutes("/login");

    await waitFor(() => {
        expect(
            screen.getByTestId("current-route")
        ).toHaveTextContent("/dashboard");
    });

    expect(
        screen.queryByText("Autenticação realizada!")
    ).not.toBeInTheDocument();
});

test("deve informar no login que a sessão foi encerrada (CA02.3)", () => {
    useAuth.mockReturnValue({
        user: null,
        token: null,
        loading: false,
        isAuthenticated: false,
        sessionMessage:
            "Sua sessão foi encerrada por segurança. Entre novamente.",
        login: vi.fn(),
        logout: vi.fn(),
    });

    renderRoutes("/login");

    expect(
        screen.getByText(
            "Sua sessão foi encerrada por segurança. Entre novamente."
        )
    ).toHaveAttribute("role", "status");
});

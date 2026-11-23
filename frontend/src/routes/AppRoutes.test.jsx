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
import { RealtimeContext } from "../features/realtime/context/realtimeContext";

vi.mock("../features/auth/hooks/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../services/api/dashboardService", () => ({
    dashboardService: {
        getDashboard: vi.fn(),
    },
}));

vi.mock("../pages/AdminPage", () => ({
    AdminPage: () => <h1>Área administrativa de teste</h1>,
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
            <RealtimeContext.Provider
                value={{
                    socket: null,
                    status: "disconnected",
                    error: null,
                    readyVersion: 0,
                }}
            >
                <AppRoutes />
                <LocationSpy />
            </RealtimeContext.Provider>
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


test("FE-08: usuário não autenticado não acessa a área administrativa", async () => {
    renderRoutes("/admin");
    await waitFor(() => {
        expect(screen.getByTestId("current-route")).toHaveTextContent("/login");
    });
    expect(screen.queryByText("Área administrativa de teste")).not.toBeInTheDocument();
});

test("FE-08: usuário comum é redirecionado ao dashboard", async () => {
    useAuth.mockReturnValue({
        user: { user_id: "common-1", name: "Usuário Comum", is_admin: false },
        token: "jwt-simulado", loading: false, isAuthenticated: true,
        login: vi.fn(), logout: vi.fn(),
    });
    renderRoutes("/admin");
    await waitFor(() => {
        expect(screen.getByTestId("current-route")).toHaveTextContent("/dashboard");
    });
    expect(screen.queryByText("Área administrativa de teste")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administração" })).not.toBeInTheDocument();
});

test("FE-08: administrador acessa área e encontra navegação dedicada", async () => {
    useAuth.mockReturnValue({
        user: { user_id: "admin-1", name: "Administrador", is_admin: true },
        token: "jwt-simulado", loading: false, isAuthenticated: true,
        login: vi.fn(), logout: vi.fn(),
    });
    renderRoutes("/admin");
    expect(screen.getByRole("heading", { name: "Área administrativa de teste" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Administração" })).toHaveAttribute("href", "/admin");
    expect(screen.getByTestId("current-route")).toHaveTextContent("/admin");
});

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

/**
 * Simula o contexto de autenticação.
 *
 * Os testes não precisam realizar login
 * real nem acessar o banco de dados.
 */
vi.mock("../features/auth/hooks/useAuth", () => ({
    useAuth: vi.fn(),
}));

/**
 * Componente auxiliar para verificar
 * a rota atual durante os testes.
 */
function LocationSpy() {
    const location = useLocation();

    return (
        <output data-testid="current-route">
            {location.pathname}
        </output>
    );
}

/**
 * Renderiza o roteamento usando
 * uma rota inicial específica.
 */
function renderRoutes(initialPath) {
    return render(
        <MemoryRouter initialEntries={[initialPath]}>
            <AppRoutes />
            <LocationSpy />
        </MemoryRouter>
    );
}

/**
 * Configura uma sessão não autenticada
 * antes de cada teste.
 */
beforeEach(() => {
    useAuth.mockReturnValue({
        user: null,
        token: null,
        loading: false,
        isAuthenticated: false,
        login: vi.fn(),
        logout: vi.fn(),
    });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

/**
 * TESTE 1
 *
 * A página pública de solicitação
 * deve estar disponível.
 */
test("deve apresentar a página de solicitação de acesso", () => {
    renderRoutes("/solicitar-acesso");

    expect(
        screen.getByRole("heading", {
            name: "Solicitar acesso",
        })
    ).toBeInTheDocument();
});

/**
 * TESTE 2
 *
 * Rotas inexistentes devem apresentar
 * a página de erro 404 da aplicação.
 */
test("deve apresentar página não encontrada", () => {
    renderRoutes("/pagina-inexistente");

    expect(
        screen.getByRole("heading", {
            name: "Página não encontrada",
        })
    ).toBeInTheDocument();
});

/**
 * TESTE 3
 *
 * Usuário não autenticado não pode
 * acessar diretamente o dashboard.
 */
test("deve redirecionar usuário não autenticado para login", async () => {
    renderRoutes("/dashboard");

    await waitFor(() => {
        expect(
            screen.getByTestId("current-route")
        ).toHaveTextContent("/login");
    });

    expect(
        screen.queryByRole("heading", {
            name: "Área autenticada",
        })
    ).not.toBeInTheDocument();
});

/**
 * TESTE 4
 *
 * Usuário autenticado pode
 * acessar o dashboard protegido.
 */
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
        screen.getByRole("heading", {
            name: "Área autenticada",
        })
    ).toBeInTheDocument();

    expect(
        screen.getByText(/Bem-vindo, Usuário Teste/i)
    ).toBeInTheDocument();

    expect(
        screen.getByTestId("current-route")
    ).toHaveTextContent("/dashboard");
});

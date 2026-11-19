
import { useState } from "react";

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

import { AuthProvider } from "./AuthProvider";
import { useAuth } from "../hooks/useAuth";

import { authService } from "../../../services/api/authService";
import { setAuthToken } from "../../../services/api/httpClient";

/**
 * Simula o serviço de autenticação.
 * Nenhuma requisição real será realizada.
 */
vi.mock("../../../services/api/authService", () => ({
    authService: {
        login: vi.fn(),
        me: vi.fn(),
        logout: vi.fn(),
    },
}));

/**
 * Simula o gerenciamento do JWT
 * no cliente HTTP.
 */
vi.mock("../../../services/api/httpClient", () => ({
    setAuthToken: vi.fn(),
}));

/**
 * Componente auxiliar para testar
 * o contexto de autenticação.
 */
function TestConsumer() {
    const {
        user,
        login,
        logout,
        isAuthenticated,
    } = useAuth();

    const [error, setError] = useState("");

    async function handleLogin() {
        try {
            setError("");
            await login(
                "teste@empresa.com.br",
                "senha123"
            );
        } catch (err) {
            setError(err.message);
        }
    }

    async function handleLogout() {
        try {
            await logout();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div>
            <p data-testid="auth-status">
                {isAuthenticated
                    ? "Autenticado"
                    : "Não autenticado"}
            </p>

            <p data-testid="user-name">
                {user?.name || "Sem usuário"}
            </p>

            {error && (
                <p role="alert">{error}</p>
            )}

            <button
                type="button"
                onClick={handleLogin}
            >
                Entrar
            </button>

            <button
                type="button"
                onClick={handleLogout}
            >
                Sair
            </button>
        </div>
    );
}

/**
 * Configuração anterior a cada teste.
 */
beforeEach(() => {
    vi.clearAllMocks();

    authService.login.mockResolvedValue({
        token: "jwt-teste",
        user: {
            id: "usuario-01",
            name: "Usuário Teste",
        },
    });

    authService.logout.mockResolvedValue(null);
});

afterEach(() => {
    cleanup();
});

/**
 * TESTE 1 — Estado inicial.
 */
test("deve iniciar sem autenticação", () => {
    render(
        <AuthProvider>
            <TestConsumer />
        </AuthProvider>
    );

    expect(
        screen.getByTestId("auth-status")
    ).toHaveTextContent("Não autenticado");

    expect(
        screen.getByTestId("user-name")
    ).toHaveTextContent("Sem usuário");
});

/**
 * TESTE 2 — Login válido.
 */
test("deve autenticar usuário e configurar JWT", async () => {
    render(
        <AuthProvider>
            <TestConsumer />
        </AuthProvider>
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Entrar",
        })
    );

    await waitFor(() => {
        expect(
            screen.getByTestId("auth-status")
        ).toHaveTextContent("Autenticado");
    });

    expect(
        screen.getByTestId("user-name")
    ).toHaveTextContent("Usuário Teste");

    expect(authService.login).toHaveBeenCalledWith(
        "teste@empresa.com.br",
        "senha123"
    );

    expect(setAuthToken).toHaveBeenCalledWith(
        "jwt-teste"
    );
});

/**
 * TESTE 3 — Falha no login.
 */
test("não deve autenticar com credenciais inválidas", async () => {
    authService.login.mockRejectedValue(
        new Error("Credenciais inválidas.")
    );

    render(
        <AuthProvider>
            <TestConsumer />
        </AuthProvider>
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Entrar",
        })
    );

    expect(
        await screen.findByRole("alert")
    ).toHaveTextContent("Credenciais inválidas.");

    expect(
        screen.getByTestId("auth-status")
    ).toHaveTextContent("Não autenticado");

    expect(setAuthToken).not.toHaveBeenCalled();
});

/**
 * TESTE 4 — Logout.
 */
test("deve limpar a sessão após logout", async () => {
    render(
        <AuthProvider>
            <TestConsumer />
        </AuthProvider>
    );

    fireEvent.click(
        screen.getByRole("button", {
            name: "Entrar",
        })
    );

    await waitFor(() => {
        expect(
            screen.getByTestId("auth-status")
        ).toHaveTextContent("Autenticado");
    });

    fireEvent.click(
        screen.getByRole("button", {
            name: "Sair",
        })
    );

    await waitFor(() => {
        expect(
            screen.getByTestId("auth-status")
        ).toHaveTextContent("Não autenticado");
    });

    expect(
        authService.logout
    ).toHaveBeenCalledTimes(1);

    expect(
        setAuthToken
    ).toHaveBeenLastCalledWith(null);

    expect(
        screen.getByTestId("user-name")
    ).toHaveTextContent("Sem usuário");
});

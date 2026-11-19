
import {
    Navigate,
    Route,
    Routes,
} from "react-router-dom";

import { PublicLayout } from "../layouts/PublicLayout";
import { LoginPage } from "../pages/LoginPage";
import { RegistrationRequestPage } from "../pages/RegistrationRequestPage";
import { NotFoundPage } from "../pages/NotFoundPage";

// Proteção de rotas autenticadas.
import { ProtectedRoute } from "./ProtectedRoute";

import { useAuth } from "../features/auth/hooks/useAuth";


/**
 * Página temporária para validar
 * o acesso autenticado e o logout.
 *
 * Será substituída na FE-03.
 */
function DashboardTemporario() {
    const { user, logout, loading } = useAuth();

    async function handleLogout() {
        try {
            await logout();
        } catch {
            // O AuthProvider já limpa a sessão local.
            // Uma falha aqui não confirma a revogação no servidor.
            window.alert(
                "Sessão local encerrada, mas não foi possível " +
                "confirmar a revogação no servidor."
            );
        }
    }

    return (
        <main className="page-card">
            <h1>Corporate Chat</h1>

            <h2>Área autenticada</h2>

            <p>
                Bem-vindo, {user?.name || "usuário"}.
            </p>

            <p>
                Sua sessão está ativa.
            </p>

            <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
            >
                {loading ? "Saindo..." : "Sair"}
            </button>
        </main>
    );
}


export function AppRoutes() {
    return (
        <Routes>
            {/* Rotas públicas */}
            <Route element={<PublicLayout />}>
                <Route
                    path="/"
                    element={<Navigate to="/login" replace />}
                />

                <Route
                    path="/login"
                    element={<LoginPage />}
                />

                <Route
                    path="/solicitar-acesso"
                    element={<RegistrationRequestPage />}
                />

                <Route
                    path="*"
                    element={<NotFoundPage />}
                />
            </Route>

            {/* Rotas que exigem autenticação */}
            <Route element={<ProtectedRoute />}>
                <Route
                    path="/dashboard"
                    element={<DashboardTemporario />}
                />
            </Route>
        </Routes>
    );
}

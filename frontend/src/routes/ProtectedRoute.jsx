
import {
    Navigate,
    Outlet,
    useLocation,
} from "react-router-dom";

import { useAuth } from "../features/auth/hooks/useAuth";

/**
 * Protege as rotas que exigem autenticação.
 *
 * Usuários não autenticados são
 * redirecionados para a tela de login.
 */
export function ProtectedRoute() {
    const {
        isAuthenticated,
    } = useAuth();

    const location = useLocation();

    /**
     * Bloqueia acesso sem sessão.
     */
    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
                state={{
                    from: location,
                }}
            />
        );
    }

    /**
     * Renderiza a rota protegida
     * quando existe autenticação.
     */
    return <Outlet />;
}

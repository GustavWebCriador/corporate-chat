import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../features/auth/hooks/useAuth";

/**
 * Restringe rotas administrativas a usuários com is_admin (CA03.4).
 * Usuário comum é levado ao dashboard; o backend também recusa (403).
 */
export function AdminRoute() {
    const { user } = useAuth();

    if (!user?.is_admin) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";

/** Restrição visual de navegação. A autorização efetiva permanece no backend. */
export function AdminRoute() {
    const { user } = useAuth();
    return user?.is_admin === true
        ? <Outlet />
        : <Navigate to="/dashboard" replace />;
}
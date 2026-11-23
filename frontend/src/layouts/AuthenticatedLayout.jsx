import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";
import { MvpAvatar } from "../components/ui/MvpAvatar";

export function AuthenticatedLayout() {
    const { user } = useAuth();

    return (
        <div className="mvp-auth-shell">
            <aside className="mvp-workspace-rail" aria-label="Identidade da aplicação">
                <div className="mvp-logo-mark mvp-logo-rail" title="Corporate Chat">Cc</div>
                <nav className="mvp-rail-nav" aria-label="Navegação principal">
                    <NavLink to="/dashboard" end title="Dashboard" aria-label="Dashboard"
                        className={({ isActive }) => `mvp-rail-link ${isActive ? "mvp-rail-active" : ""}`}>
                        #
                    </NavLink>
                    {user?.is_admin === true && (
                        <NavLink to="/admin" title="Administração" aria-label="Administração"
                            className={({ isActive }) => `mvp-rail-link ${isActive ? "mvp-rail-active" : ""}`}>
                            A
                        </NavLink>
                    )}
                </nav>
                <div className="mvp-rail-profile" title={user?.name || "Usuário autenticado"}>
                    <MvpAvatar name={user?.name} size={27} />
                </div>
            </aside>
            <div className="mvp-auth-content"><Outlet /></div>
        </div>
    );
}
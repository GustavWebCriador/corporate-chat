import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";

const active = "border-teal-500/50 bg-teal-500/15 text-teal-300";
const inactive = "border-transparent text-slate-400 hover:bg-navy-800 hover:text-slate-100";

export function AuthenticatedLayout() {
    const { user } = useAuth();
    return (
        <div className="grid min-h-screen grid-cols-[56px_minmax(0,1fr)] bg-navy-950 text-slate-300">
            <aside
                aria-label="Identidade da aplicação"
                className="flex flex-col items-center gap-3 border-r border-slate-400/10 px-1 py-3"
            >
                <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-sm font-bold text-navy-950"
                    title="Corporate Chat"
                >
                    Cc
                </div>
                <nav aria-label="Navegação principal" className="flex w-full flex-col gap-2">
                    <NavLink
                        to="/dashboard"
                        end
                        title="Dashboard"
                        aria-label="Dashboard"
                        className={({ isActive }) =>
                            `flex h-10 items-center justify-center rounded-lg border text-sm font-semibold ${isActive ? active : inactive}`
                        }
                    >
                        C
                    </NavLink>
                    {user?.is_admin === true && (
                        <NavLink
                            to="/admin"
                            title="Administração"
                            aria-label="Administração"
                            className={({ isActive }) =>
                                `flex h-10 items-center justify-center rounded-lg border text-sm font-semibold ${isActive ? active : inactive}`
                            }
                        >
                            A
                        </NavLink>
                    )}
                </nav>
            </aside>
            <div className="min-w-0"><Outlet /></div>
        </div>
    );
}
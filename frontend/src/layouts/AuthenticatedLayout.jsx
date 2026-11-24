
import { useState } from "react";
import {
    NavLink,
    Outlet,
    useLocation,
    useNavigate,
} from "react-router-dom";

import { useAuth } from "../features/auth/hooks/useAuth";
import { MvpAvatar } from "../components/ui/MvpAvatar";

import { DashboardNavigationContext } from
    "../features/dashboard/context/DashboardNavigationContext";

export function AuthenticatedLayout() {
    const { user } = useAuth();

    const [dashboardView, setDashboardView] =
        useState("conversations");

    const navigate = useNavigate();
    const location = useLocation();

    const isDashboard =
        location.pathname === "/dashboard";

    function openContacts() {
        setDashboardView("contacts");

        if (!isDashboard) {
            navigate("/dashboard");
        }
    }

    return (
        <DashboardNavigationContext.Provider
            value={{
                view: dashboardView,
                setView: setDashboardView,
            }}
        >
            <div className="mvp-auth-shell">
                <aside
                    className="mvp-workspace-rail"
                    aria-label="Identidade da aplicação"
                >
                    <div
                        className="mvp-logo-mark mvp-logo-rail"
                        title="Corporate Chat"
                    >
                        Cc
                    </div>

                    <nav
                        className="mvp-rail-nav"
                        aria-label="Navegação principal"
                    >
                        {/* CONVERSAS */}
                        <NavLink
                            to="/dashboard"
                            end
                            title="Conversas"
                            aria-label="Conversas"
                            onClick={() =>
                                setDashboardView("conversations")
                            }
                            className={({ isActive }) =>
                                `mvp-rail-link ${
                                    isActive &&
                                    dashboardView === "conversations"
                                        ? "mvp-rail-active"
                                        : ""
                                }`
                            }
                        >
                            <svg
                                aria-hidden="true"
                                width="19"
                                height="19"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5Z" />
                            </svg>
                        </NavLink>

                        {/* CONTATOS */}
                        <button
                            type="button"
                            title="Contatos"
                            aria-label="Contatos"
                            aria-pressed={
                                isDashboard &&
                                dashboardView === "contacts"
                            }
                            className={`mvp-rail-link mvp-rail-button ${
                                isDashboard &&
                                dashboardView === "contacts"
                                    ? "mvp-rail-active"
                                    : ""
                            }`}
                            onClick={openContacts}
                        >
                            <svg
                                aria-hidden="true"
                                width="19"
                                height="19"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle
                                    cx="9"
                                    cy="7"
                                    r="4"
                                />
                                <path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </button>

                        {/* ADMINISTRAÇÃO */}
                        {user?.is_admin === true && (
                            <NavLink
                                to="/admin"
                                title="Administração"
                                aria-label="Administração"
                                className={({ isActive }) =>
                                    `mvp-rail-link ${
                                        isActive
                                            ? "mvp-rail-active"
                                            : ""
                                    }`
                                }
                            >
                                A
                            </NavLink>
                        )}
                    </nav>

                    <div
                        className="mvp-rail-profile"
                        title={
                            user?.name ||
                            "Usuário autenticado"
                        }
                    >
                        <MvpAvatar
                            name={user?.name}
                            size={27}
                        />
                    </div>
                </aside>

                <div className="mvp-auth-content">
                    <Outlet />
                </div>
            </div>
        </DashboardNavigationContext.Provider>
    );
}

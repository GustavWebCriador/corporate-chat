import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../features/auth/hooks/useAuth";
import { RegistrationRequestsPanel } from "../features/admin/components/RegistrationRequestsPanel";
import { UsersPanel } from "../features/admin/components/UsersPanel";

const TABS = [
    { id: "requests", label: "Solicitações de acesso" },
    { id: "users", label: "Usuários" },
];

/**
 * Área administrativa (FE-08 — RF03 e RF04).
 * Acesso restrito por AdminRoute; o backend também valida is_admin.
 */
export function AdminPage() {
    const { user } = useAuth();
    const [tab, setTab] = useState("requests");
    const [usersVersion, setUsersVersion] = useState(0);

    return (
        <div className="min-h-screen bg-navy-950 px-4 py-5 text-slate-300 md:px-6">
            <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-400/10 pb-4">
                <div>
                    <h1 className="text-2xl font-bold">Administração</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Acessos da organização · {user?.name}
                    </p>
                </div>

                <Link
                    to="/dashboard"
                    className="rounded-lg border border-slate-400/20 px-4 py-2 text-sm text-slate-300 hover:bg-navy-800"
                >
                    ← Voltar às conversas
                </Link>
            </header>

            <div role="tablist" aria-label="Seções da administração" className="mb-5 flex gap-1 border-b border-slate-400/10">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        id={`tab-${item.id}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        aria-controls={`panel-${item.id}`}
                        onClick={() => setTab(item.id)}
                        className={`-mb-px border-b-2 px-4 py-2 text-sm ${
                            tab === item.id
                                ? "border-teal-500 font-semibold text-teal-300"
                                : "border-transparent text-slate-400 hover:text-slate-300"
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div
                id={`panel-${tab}`}
                role="tabpanel"
                aria-labelledby={`tab-${tab}`}
                className="max-w-3xl"
            >
                {tab === "requests" ? (
                    <RegistrationRequestsPanel
                        onUserCreated={() => setUsersVersion((current) => current + 1)}
                    />
                ) : (
                    <UsersPanel
                        currentUserId={user?.user_id}
                        reloadSignal={usersVersion}
                    />
                )}
            </div>
        </div>
    );
}

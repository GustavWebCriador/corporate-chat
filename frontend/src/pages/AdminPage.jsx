import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";
import { RegistrationRequestsPanel } from "../features/admin/components/RegistrationRequestsPanel";
import { AdminUsersPanel } from "../features/admin/components/AdminUsersPanel";

export function AdminPage() {
    const { user } = useAuth();
    const [tab, setTab] = useState("requests");
    const tabStyle = (selected) =>
        `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${selected
            ? "bg-teal-500 text-navy-950"
            : "border border-slate-400/20 bg-navy-900 text-slate-300 hover:bg-navy-800"}`;

    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
            <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="mb-1 text-sm text-teal-300">Corporate Chat</p>
                    <h1 className="text-2xl font-bold text-slate-100">Administração</h1>
                    <p className="mt-2 text-sm text-slate-400">Acesso administrativo: {user?.name}</p>
                </div>
                <Link to="/dashboard" className="rounded-lg border border-slate-400/20 px-4 py-2 text-sm hover:bg-navy-800">
                    Voltar ao dashboard
                </Link>
            </header>

            <div role="tablist" aria-label="Áreas administrativas" className="mb-6 flex flex-wrap gap-3">
                <button type="button" role="tab" id="tab-requests" aria-controls="panel-requests"
                    aria-selected={tab === "requests"} className={tabStyle(tab === "requests")}
                    onClick={() => setTab("requests")}>Solicitações de cadastro</button>
                <button type="button" role="tab" id="tab-users" aria-controls="panel-users"
                    aria-selected={tab === "users"} className={tabStyle(tab === "users")}
                    onClick={() => setTab("users")}>Gerenciamento de usuários</button>
            </div>
            {tab === "requests" ? (
                <section id="panel-requests" role="tabpanel" aria-labelledby="tab-requests">
                    <RegistrationRequestsPanel />
                </section>
            ) : (
                <section id="panel-users" role="tabpanel" aria-labelledby="tab-users">
                    <AdminUsersPanel currentUserId={user?.user_id} />
                </section>
            )}
        </main>
    );
}
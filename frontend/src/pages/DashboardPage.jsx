
import { useEffect, useState } from "react";

import { useAuth } from "../features/auth/hooks/useAuth";
import { ContactList } from "../features/dashboard/components/ContactList";
import { dashboardService } from "../services/api/dashboardService";

export function DashboardPage() {
    const { user, logout, loading: authLoading } = useAuth();

    const [dashboard, setDashboard] = useState(null);
    const [status, setStatus] = useState("loading");
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let active = true;

        dashboardService.getDashboard()
            .then((response) => {
                if (!active) return;

                if (
                    !Array.isArray(response?.contacts) ||
                    !Array.isArray(response?.conversations)
                ) {
                    throw new Error("INVALID_DASHBOARD_RESPONSE");
                }

                setDashboard(response);
                setStatus("success");
            })
            .catch((err) => {
                if (!active) return;

                setStatus("error");
                setError(
                    err.status === 401
                        ? "Sua sessão não é mais válida. Entre novamente."
                        : "Não foi possível carregar o dashboard."
                );
            });

        // Ignora respostas antigas após desmontagem ou nova tentativa.
        return () => {
            active = false;
        };
    }, [reloadKey]);

    function handleRetry() {
        setStatus("loading");
        setError("");
        setReloadKey((current) => current + 1);
    }

    async function handleLogout() {
        try {
            await logout();
        } catch {
            // A sessão local é limpa pelo AuthProvider mesmo
            // quando a revogação no backend não é confirmada.
            window.alert(
                "Sessão local encerrada, mas não foi possível " +
                "confirmar a revogação no servidor."
            );
        }
    }

    const contacts = dashboard?.contacts ?? [];
    const conversations = dashboard?.conversations ?? [];

    return (
        <div className="grid min-h-screen grid-cols-1 bg-navy-950 text-slate-300 md:grid-cols-[260px_minmax(0,1fr)]">
            <aside
                aria-label="Contatos disponíveis"
                className="min-w-0 border-b border-slate-400/10 md:border-b-0 md:border-r"
            >
                {status === "success" && (
                    <ContactList contacts={contacts} />
                )}
            </aside>

            <main className="min-w-0 px-5 py-6 md:px-8">
                <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-slate-400/10 pb-5">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-300">
                            Dashboard
                        </h1>

                        <p className="mt-2 text-sm text-slate-400">
                            Bem-vindo, {user?.name || "usuário"}.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={authLoading}
                        className="rounded-lg border border-slate-400/20 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-navy-800 disabled:opacity-50"
                    >
                        {authLoading ? "Saindo..." : "Sair"}
                    </button>
                </header>

                {status === "loading" && (
                    <p role="status" className="text-sm text-slate-400">
                        Carregando dashboard...
                    </p>
                )}

                {status === "error" && (
                    <div role="alert" className="space-y-4">
                        <p className="text-sm text-rose-500">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={handleRetry}
                            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950"
                        >
                            Tentar novamente
                        </button>
                    </div>
                )}

                {status === "success" && (
                    <section aria-labelledby="conversations-title">
                        <div className="mb-4 flex items-center justify-between">
                            <h2
                                id="conversations-title"
                                className="text-lg font-semibold"
                            >
                                Conversas recentes
                            </h2>

                            <span className="text-sm text-slate-400">
                                {conversations.length}
                            </span>
                        </div>

                        {conversations.length === 0 ? (
                            <p className="rounded-lg border border-slate-400/10 bg-navy-900 p-5 text-sm text-slate-400">
                                Nenhuma conversa iniciada.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {conversations.map((conversation) => (
                                    <li
                                        key={conversation.conversation_id}
                                        className="rounded-lg border border-slate-400/10 bg-navy-900 p-4"
                                    >
                                        <p className="font-semibold">
                                            {conversation.type === "GROUP"
                                                ? conversation.name
                                                : conversation.contact?.name ?? "Contato indisponível"}
                                        </p>

                                        <p className="mt-1 truncate text-sm text-slate-400">
                                            {conversation.last_message?.content ??
                                                "Sem mensagens."}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}

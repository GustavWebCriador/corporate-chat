
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../features/auth/hooks/useAuth";
import { ChatPanel } from "../features/chat/components/ChatPanel";
import { ConversationList } from "../features/chat/components/ConversationList";
import { ContactList } from "../features/dashboard/components/ContactList";
import { useRealtime } from "../features/realtime/hooks/useRealtime";
import { conversationService } from "../services/api/conversationService";
import { dashboardService } from "../services/api/dashboardService";

export function DashboardPage() {
    const { user, logout, loading: authLoading } = useAuth();

    const [dashboard, setDashboard] = useState(null);
    const [status, setStatus] = useState("loading");
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    const [activeConversation, setActiveConversation] = useState(null);
    const [openingContactId, setOpeningContactId] = useState(null);
    const [openError, setOpenError] = useState("");

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

    // Atualiza prévias e ordenação sem esconder a interface.
    const refreshDashboard = useCallback(() => {
        setReloadKey((current) => current + 1);
    }, []);

    // Tempo real (FE-06): mensagens novas atualizam a lista de conversas
    // e confirmam a entrega mesmo com a conversa fechada.
    const { subscribe, isConnected, readyCount, emitWithAck } = useRealtime();
    const activeIdRef = useRef(null);
    const deliveredRef = useRef(new Set());
    const currentUserId = user?.user_id;

    useEffect(() => {
        activeIdRef.current = activeConversation?.conversation_id ?? null;
    }, [activeConversation]);

    const confirmDelivery = useCallback((conversationId, messageId) => {
        if (!messageId || deliveredRef.current.has(messageId)) {
            return;
        }

        deliveredRef.current.add(messageId);

        emitWithAck("message:delivered", { conversationId, messageId })
            .catch(() => {
                deliveredRef.current.delete(messageId);
            });
    }, [emitWithAck]);

    useEffect(() => {
        let timer;

        const unsubscribe = subscribe("message:new", (payload) => {
            const message = payload?.message;

            if (!message) return;

            if (
                message.sender_id !== currentUserId &&
                message.conversation_id !== activeIdRef.current
            ) {
                confirmDelivery(message.conversation_id, message._id);
            }

            clearTimeout(timer);
            timer = setTimeout(refreshDashboard, 300);
        });

        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, [subscribe, confirmDelivery, refreshDashboard, currentUserId]);

    // Ao conectar, confirma a entrega das últimas mensagens recebidas
    // enquanto o usuário estava offline (RF08).
    useEffect(() => {
        if (!isConnected) return;

        (dashboard?.conversations ?? []).forEach((conversation) => {
            const last = conversation.last_message;

            if (
                last?.message_id &&
                last.sender_id !== currentUserId &&
                conversation.conversation_id !== activeIdRef.current
            ) {
                confirmDelivery(conversation.conversation_id, last.message_id);
            }
        });
    }, [dashboard, isConnected, confirmDelivery, currentUserId]);

    // Após reconectar, recarrega a lista para incluir o que chegou offline.
    const readyAtMountRef = useRef(readyCount);

    useEffect(() => {
        if (readyCount > Math.max(readyAtMountRef.current, 1)) {
            readyAtMountRef.current = readyCount;
            const timer = setTimeout(refreshDashboard, 0);
            return () => clearTimeout(timer);
        }

        return undefined;
    }, [readyCount, refreshDashboard]);

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

    const contacts = useMemo(
        () => dashboard?.contacts ?? [],
        [dashboard]
    );

    const conversations = useMemo(
        () => dashboard?.conversations ?? [],
        [dashboard]
    );

    // Usuários conhecidos, para identificar o autor das mensagens.
    const usersById = useMemo(
        () => new Map(contacts.map((contact) => [contact.user_id, contact])),
        [contacts]
    );

    // Selecionar contato cria ou reutiliza a conversa privada (CA05.2 / CA06.1).
    async function handleSelectContact(contact) {
        setOpenError("");
        setOpeningContactId(contact.user_id);

        try {
            const response = await conversationService.openPrivate(
                contact.user_id
            );

            const conversationId = response?.conversation?._id;

            if (!conversationId) {
                throw new Error("INVALID_CONVERSATION_RESPONSE");
            }

            const existing = conversations.find(
                (item) => item.conversation_id === conversationId
            );

            setActiveConversation(
                existing ?? {
                    conversation_id: conversationId,
                    type: "PRIVATE",
                    name: null,
                    contact,
                    last_message: null,
                    last_message_at: null,
                }
            );

            if (!existing) {
                refreshDashboard();
            }
        } catch {
            setOpenError(
                `Não foi possível abrir a conversa com ${contact.name}.`
            );
        } finally {
            setOpeningContactId(null);
        }
    }

    return (
        <div className="grid min-h-screen grid-cols-1 bg-navy-950 text-slate-300 md:grid-cols-[260px_minmax(0,1fr)]">
            <aside
                aria-label="Contatos disponíveis"
                className={`min-w-0 border-b border-slate-400/10 md:border-b-0 md:border-r ${
                    activeConversation ? "hidden md:block" : ""
                }`}
            >
                {status === "success" && (
                    <ContactList
                        contacts={contacts}
                        onSelect={handleSelectContact}
                        disabled={Boolean(openingContactId)}
                    />
                )}
            </aside>

            <main className="flex min-w-0 flex-col px-4 py-5 md:px-6">
                <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-400/10 pb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-300">
                            Dashboard
                        </h1>

                        <p className="mt-1 text-sm text-slate-400">
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
                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                        <section
                            aria-labelledby="conversations-title"
                            className={activeConversation ? "hidden lg:block" : ""}
                        >
                            <div className="mb-3 flex items-center justify-between">
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

                            {openError && (
                                <p role="alert" className="mb-3 text-sm text-rose-500">
                                    {openError}
                                </p>
                            )}

                            <ConversationList
                                conversations={conversations}
                                activeId={activeConversation?.conversation_id}
                                onSelect={setActiveConversation}
                            />
                        </section>

                        {activeConversation ? (
                            <ChatPanel
                                key={activeConversation.conversation_id}
                                conversation={activeConversation}
                                currentUser={user}
                                usersById={usersById}
                                onBack={() => setActiveConversation(null)}
                                onMessageSent={refreshDashboard}
                            />
                        ) : (
                            <p className="hidden rounded-lg border border-dashed border-slate-400/15 p-8 text-center text-sm text-slate-400 lg:block">
                                Selecione uma conversa ou um contato para começar.
                            </p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

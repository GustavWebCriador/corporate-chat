import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../features/auth/hooks/useAuth";
import { useRealtime } from "../features/realtime/hooks/useRealtime";
import { ContactList } from "../features/dashboard/components/ContactList";
import { ConversationHistory } from "../features/conversations/components/ConversationHistory";
import { CreateGroupDialog } from "../features/groups/components/CreateGroupDialog";
import { GroupDetailsDialog } from "../features/groups/components/GroupDetailsDialog";

import { dashboardService } from "../services/api/dashboardService";
import { conversationService } from "../services/api/conversationService";
import { markRealtimeDelivered } from "../services/realtime/chatCheckpoints";
import {
    isValidRealtimeMessage,
    mergeRealtimeMessage,
    rememberNewestMessage,
    replayRealtimeMessages,
} from "../features/dashboard/utils/realtimeConversations";

export function DashboardPage() {
    const { user, logout, loading: authLoading } = useAuth();
    const {
        socket,
        status: realtimeStatus,
        readyVersion = 0,
    } = useRealtime();

    const userId = user?.user_id;
    const requestVersionRef = useRef(0);
    const sessionGenerationRef = useRef(0);
    const realtimeMessagesRef = useRef(new Map());
    const knownConversationIdsRef = useRef(new Set());
    const unknownConversationIdsRef = useRef(new Set());
    const pendingDeliveriesRef = useRef(new Map());
    const confirmedDeliveriesRef = useRef(new Set());
    const deliveryAttemptsRef = useRef(new Map());
    const selectedConversationIdRef = useRef(null);

    const [dashboard, setDashboard] = useState(null);
    const [status, setStatus] = useState("loading");
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    const [openingContactId, setOpeningContactId] = useState(null);
    const [conversationError, setConversationError] = useState("");
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [managingGroupId, setManagingGroupId] = useState(null);

    // Não mantém caches de outra sessão e invalida ACKs antigos.
    useEffect(() => {
        const messages = realtimeMessagesRef.current;
        const known = knownConversationIdsRef.current;
        const unknown = unknownConversationIdsRef.current;
        const pending = pendingDeliveriesRef.current;
        const confirmed = confirmedDeliveriesRef.current;
        const attempts = deliveryAttemptsRef.current;

        return () => {
            sessionGenerationRef.current += 1;
            messages.clear();
            known.clear();
            unknown.clear();
            pending.clear();
            confirmed.clear();
            attempts.clear();
        };
    }, [userId]);

    // A API é a fonte da lista de conversas. Em reconexões o
    // readyVersion força nova consulta, cobrindo eventos perdidos.
    useEffect(() => {
        let active = true;
        const version = ++requestVersionRef.current;

        dashboardService.getDashboard()
            .then((response) => {
                if (!active || version !== requestVersionRef.current) return;

                if (
                    !Array.isArray(response?.contacts) ||
                    !Array.isArray(response?.conversations)
                ) {
                    throw new Error("INVALID_DASHBOARD_RESPONSE");
                }

                // Não permite que um HTTP antigo desfaça um message:new.
                const merged = replayRealtimeMessages(
                    response,
                    realtimeMessagesRef.current
                );

                const known = new Set(
                    merged.conversations.map((item) => item.conversation_id)
                );
                knownConversationIdsRef.current = known;
                for (const id of unknownConversationIdsRef.current) {
                    if (known.has(id)) {
                        unknownConversationIdsRef.current.delete(id);
                    }
                }

                setDashboard(merged);
                setError("");
                setStatus("success");
            })
            .catch((requestError) => {
                if (!active || version !== requestVersionRef.current) return;

                if (requestError?.status === 401) {
                    setDashboard(null);
                    setSelectedConversation(null);
                    setStatus("error");
                } else {
                    // Uma falha temporária não descarta conversas carregadas.
                    setStatus((current) =>
                        current === "success" ? current : "error"
                    );
                }

                setError(
                    requestError?.status === 401
                        ? "Sua sessão não é mais válida. Entre novamente."
                        : "Não foi possível carregar o dashboard."
                );
            });

        return () => {
            active = false;
        };
    }, [reloadKey, readyVersion, userId]);

    function refreshDashboard() {
        setReloadKey((current) => current + 1);
    }

    function handleRetry() {
        setStatus("loading");
        setError("");
        refreshDashboard();
    }

    async function handleLogout() {
        // Invalida imediatamente o cache e qualquer ACK em andamento.
        sessionGenerationRef.current += 1;
        realtimeMessagesRef.current.clear();
        knownConversationIdsRef.current.clear();
        unknownConversationIdsRef.current.clear();
        pendingDeliveriesRef.current.clear();
        confirmedDeliveriesRef.current.clear();
        deliveryAttemptsRef.current.clear();

        try {
            await logout();
        } catch {
            window.alert(
                "Sessão local encerrada, mas não foi possível " +
                "confirmar a revogação no servidor."
            );
        }
    }

    const contacts = dashboard?.contacts ?? [];
    const conversations = dashboard?.conversations ?? [];
    const activeContacts = contacts.filter(
        (contact) => contact.status === "ACTIVE"
    );

    // Os handlers de socket precisam consultar a seleção mais recente
    // sem recriar o listener a cada mudança de conversa.
    useEffect(() => {
        selectedConversationIdRef.current = selectedConversation?.id ?? null;
    }, [selectedConversation?.id]);

    // Cada ACK é tentado uma vez por conexão pronta. Em caso de
    // falha, fica pendente até a próxima reconexão/reconciliação.
    // O backend é a fonte autoritativa do checkpoint.
    const queueDelivery = useCallback((conversationId, messageId) => {
        if (
            !userId ||
            realtimeStatus !== "connected" ||
            !socket?.connected ||
            typeof conversationId !== "string" ||
            typeof messageId !== "string"
        ) {
            return;
        }

        const key = `${conversationId}:${messageId}`;
        if (confirmedDeliveriesRef.current.has(key)) return;

        const pending = pendingDeliveriesRef.current;
        if (!pending.has(key)) {
            // Limita o armazenamento sem alterar mensagens persistidas.
            if (pending.size >= 100) {
                const oldest = pending.keys().next().value;
                pending.delete(oldest);
                deliveryAttemptsRef.current.delete(oldest);
            }
            pending.set(key, { conversationId, messageId });
        }

        // Não envia ACKs duplicados na mesma conexão, mesmo após timeout.
        if (deliveryAttemptsRef.current.get(key) === readyVersion) return;
        deliveryAttemptsRef.current.set(key, readyVersion);

        const item = pending.get(key);
        const generation = sessionGenerationRef.current;

        void markRealtimeDelivered(socket, conversationId, messageId)
            .then(() => {
                if (
                    generation !== sessionGenerationRef.current ||
                    pendingDeliveriesRef.current.get(key) !== item
                ) {
                    return;
                }

                pendingDeliveriesRef.current.delete(key);
                deliveryAttemptsRef.current.delete(key);
                const confirmed = confirmedDeliveriesRef.current;
                confirmed.add(key);
                if (confirmed.size > 200) {
                    const oldest = confirmed.values().next().value;
                    confirmed.delete(oldest);
                }
            })
            .catch(() => {
                // Mantém pendência; novo readyVersion permitirá retry.
            });
    }, [realtimeStatus, socket, readyVersion, userId]);

    // Reconcilia entregas perdidas durante desconexão. Não marca
    // leitura: a conversa selecionada é responsabilidade do histórico.
    useEffect(() => {
        if (status !== "success") return;

        for (const conversation of dashboard?.conversations ?? []) {
            const last = conversation.last_message;
            if (
                conversation.conversation_id === selectedConversation?.id ||
                !last?.message_id ||
                last.sender_id === userId
            ) {
                continue;
            }
            queueDelivery(conversation.conversation_id, last.message_id);
        }

        // Pendências com ACK perdido são repetidas após novo readyVersion.
        for (const pending of pendingDeliveriesRef.current.values()) {
            if (pending.conversationId !== selectedConversation?.id) {
                queueDelivery(pending.conversationId, pending.messageId);
            }
        }
    }, [
        dashboard,
        status,
        selectedConversation?.id,
        readyVersion,
        queueDelivery,
        userId,
    ]);

    // Listener global: mantém a prévia atualizada também para
    // conversas não selecionadas. Não interfere no ConversationHistory.
    useEffect(() => {
        if (
            realtimeStatus !== "connected" ||
            !socket?.connected
        ) {
            return;
        }

        function handleNewMessage(payload) {
            const message = payload?.message;
            if (!isValidRealtimeMessage(message)) return;

            const conversationId = message.conversation_id;
            const isKnown = knownConversationIdsRef.current.has(conversationId);

            rememberNewestMessage(realtimeMessagesRef.current, message);
            setDashboard((current) => mergeRealtimeMessage(current, message));

            // Não marca como lida nem duplica a responsabilidade
            // do componente da conversa atualmente selecionada.
            if (
                message.sender_id !== userId &&
                selectedConversationIdRef.current !== conversationId
            ) {
                queueDelivery(conversationId, message._id);
            }

            // Uma conversa criada por terceiros pode não constar
            // na lista local; atualiza uma única vez até reconciliar.
            if (!isKnown && !unknownConversationIdsRef.current.has(conversationId)) {
                const unknown = unknownConversationIdsRef.current;
                if (unknown.size >= 100) {
                    unknown.delete(unknown.values().next().value);
                }
                unknown.add(conversationId);
                setReloadKey((current) => current + 1);
            }
        }

        socket.on("message:new", handleNewMessage);
        return () => {
            socket.off("message:new", handleNewMessage);
        };
    }, [socket, realtimeStatus, userId, queueDelivery]);

    async function handleSelectContact(contact) {
        if (openingContactId !== null) return;

        setOpeningContactId(contact.user_id);
        setConversationError("");
        setSelectedConversation(null);

        try {
            const response = await conversationService.createPrivate(
                contact.user_id
            );
            const conversationId = response?.conversation?._id;

            if (typeof conversationId !== "string" || !conversationId) {
                throw new Error("INVALID_CONVERSATION_RESPONSE");
            }

            setSelectedConversation({
                id: conversationId,
                type: "PRIVATE",
                name: contact.name,
                recipientUserId: contact.user_id,
            });
            refreshDashboard();
        } catch (requestError) {
            if (requestError?.status === 401) {
                setConversationError(
                    "Sua sessão não é mais válida. Entre novamente."
                );
            } else if (requestError?.status === 403) {
                setConversationError(
                    "Você não tem permissão para abrir esta conversa."
                );
            } else {
                setConversationError(
                    "Não foi possível abrir a conversa. Tente novamente."
                );
            }
        } finally {
            setOpeningContactId(null);
        }
    }

    function handleSelectConversation(conversation) {
        if (openingContactId !== null) return;

        if (
            typeof conversation.conversation_id !== "string" ||
            !conversation.conversation_id
        ) {
            setConversationError("Identificador da conversa inválido.");
            return;
        }

        setConversationError("");
        const isGroup = conversation.type === "GROUP";

        setSelectedConversation({
            id: conversation.conversation_id,
            type: conversation.type,
            name: isGroup
                ? conversation.name ?? "Grupo sem nome"
                : conversation.contact?.name ?? "Contato indisponível",
            recipientUserId: isGroup
                ? undefined
                : conversation.contact?.user_id,
        });
    }

    function handleGroupCreated(group) {
        setCreatingGroup(false);
        setConversationError("");
        setSelectedConversation({
            id: group._id,
            type: "GROUP",
            name: group.name,
            recipientUserId: undefined,
        });
        refreshDashboard();
    }

    function handleGroupChanged(changedGroup) {
        if (changedGroup?._id && typeof changedGroup.name === "string") {
            setSelectedConversation((current) =>
                current?.type === "GROUP" && current.id === changedGroup._id
                    ? { ...current, name: changedGroup.name }
                    : current
            );
        }
        refreshDashboard();
    }

    function handleGroupLeft() {
        setManagingGroupId(null);
        setSelectedConversation(null);
        refreshDashboard();
    }

    return (
        <div className="grid min-h-screen grid-cols-1 bg-navy-950 text-slate-300 md:grid-cols-[260px_minmax(0,1fr)]">
            <aside
                aria-label="Contatos disponíveis"
                className="min-w-0 border-b border-slate-400/10 md:border-b-0 md:border-r"
            >
                {status === "success" && (
                    <>
                        <div className="border-b border-slate-400/10 p-4">
                            <button
                                type="button"
                                onClick={() => setCreatingGroup(true)}
                                disabled={activeContacts.length === 0}
                                className="w-full rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950 transition-colors enabled:hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Novo grupo
                            </button>
                        </div>

                        <ContactList
                            contacts={contacts}
                            onSelectContact={handleSelectContact}
                            isOpening={openingContactId !== null}
                        />
                    </>
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
                        className="rounded-lg border border-slate-400/20 px-4 py-2 text-sm text-slate-300 hover:bg-navy-800 disabled:opacity-50"
                    >
                        {authLoading ? "Saindo..." : "Sair"}
                    </button>
                </header>

                {status === "success" && error && (
                    <p role="alert" className="mb-4 rounded-lg border border-rose-500/20 p-3 text-sm text-rose-400">
                        {error} As conversas já carregadas continuam disponíveis.
                    </p>
                )}

                {openingContactId && (
                    <p role="status" className="mb-4 text-sm text-teal-300">
                        Abrindo conversa...
                    </p>
                )}

                {conversationError && (
                    <p
                        role="alert"
                        className="mb-4 rounded-lg border border-rose-500/20 bg-navy-900 p-4 text-sm text-rose-500"
                    >
                        {conversationError}
                    </p>
                )}

                {selectedConversation && (
                    <section
                        aria-labelledby="selected-conversation-title"
                        className="mb-6 rounded-lg border border-teal-500/20 bg-navy-900 p-5"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2
                                id="selected-conversation-title"
                                className="text-lg font-semibold"
                            >
                                {selectedConversation.type === "GROUP"
                                    ? `Grupo: ${selectedConversation.name}`
                                    : `Conversa com ${selectedConversation.name}`}
                            </h2>

                            <div className="flex gap-2">
                                {selectedConversation.type === "GROUP" && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setManagingGroupId(selectedConversation.id)
                                        }
                                        className="rounded-lg border border-teal-500/30 px-3 py-1 text-sm text-teal-300 hover:bg-navy-800"
                                    >
                                        Gerenciar grupo
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setSelectedConversation(null)}
                                    aria-label="Fechar conversa"
                                    className="rounded-lg border border-slate-400/20 px-3 py-1 text-sm hover:bg-navy-800"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>

                        <ConversationHistory
                            key={selectedConversation.id}
                            conversationId={selectedConversation.id}
                            currentUserId={user?.user_id}
                            recipientUserId={selectedConversation.recipientUserId}
                        />
                    </section>
                )}

                {status === "loading" && (
                    <p role="status" className="text-sm text-slate-400">
                        Carregando dashboard...
                    </p>
                )}

                {status === "error" && (
                    <div role="alert" className="space-y-4">
                        <p className="text-sm text-rose-500">{error}</p>
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
                                {conversations.map((conversation) => {
                                    const isGroup = conversation.type === "GROUP";
                                    const name = isGroup
                                        ? conversation.name ?? "Grupo sem nome"
                                        : conversation.contact?.name ??
                                          "Contato indisponível";
                                    const isSelected =
                                        selectedConversation?.id ===
                                        conversation.conversation_id;

                                    return (
                                        <li key={conversation.conversation_id}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleSelectConversation(conversation)
                                                }
                                                aria-label={
                                                    isGroup
                                                        ? `Abrir grupo ${name}`
                                                        : `Abrir conversa com ${name}`
                                                }
                                                aria-pressed={isSelected}
                                                disabled={openingContactId !== null}
                                                className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-navy-800 ${
                                                    isSelected
                                                        ? "border-teal-500/50 bg-navy-800"
                                                        : "border-slate-400/10 bg-navy-900"
                                                }`}
                                            >
                                                <p className="font-semibold">
                                                    {isGroup && (
                                                        <span className="mr-2 text-teal-300">
                                                            Grupo
                                                        </span>
                                                    )}
                                                    {name}
                                                </p>
                                                <p className="mt-1 truncate text-sm text-slate-400">
                                                    {conversation.last_message?.content ??
                                                        "Nenhuma mensagem ainda."}
                                                </p>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                )}
            </main>

            {creatingGroup && (
                <CreateGroupDialog
                    contacts={activeContacts}
                    onClose={() => setCreatingGroup(false)}
                    onCreated={handleGroupCreated}
                />
            )}

            {managingGroupId && (
                <GroupDetailsDialog
                    key={managingGroupId}
                    groupId={managingGroupId}
                    currentUser={user}
                    contacts={activeContacts}
                    onClose={() => setManagingGroupId(null)}
                    onChanged={handleGroupChanged}
                    onLeft={handleGroupLeft}
                />
            )}
        </div>
    );
}
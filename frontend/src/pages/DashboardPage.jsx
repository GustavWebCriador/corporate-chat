import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { useAuth } from "../features/auth/hooks/useAuth";
import { useRealtime } from "../features/realtime/hooks/useRealtime";
import { ContactList } from "../features/dashboard/components/ContactList";
import { MvpAvatar } from "../components/ui/MvpAvatar";
import { DashboardNavigationContext } from "../features/dashboard/context/DashboardNavigationContext";
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
    const [showDetails, setShowDetails] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [conversationSearch, setConversationSearch] = useState("");

    // A barra estreita altera a área central. Fora do layout, o componente
    // também inicia em Conversas e pode ser controlado por um provider.
    const navigation = useContext(DashboardNavigationContext);
    const [standaloneView, setStandaloneView] = useState("conversations");
    const panelView = navigation?.view ?? standaloneView;
    const setPanelView = navigation?.setView ?? setStandaloneView;

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
            setSidebarOpen(false);
            setPanelView("conversations");
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
        setSidebarOpen(false);
        setPanelView("conversations");
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
        setPanelView("conversations");
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

    const filter = conversationSearch.trim().toLocaleLowerCase("pt-BR");
    const filteredConversations = conversations.filter((conversation) => {
        if (!filter) return true;
        const name = conversation.type === "GROUP"
            ? conversation.name || ""
            : conversation.contact?.name || "";
        return name.toLocaleLowerCase("pt-BR").includes(filter);
    });
    const contactNames = Object.fromEntries(
        contacts.filter(c => c?.user_id && c?.name).map(c => [c.user_id, c.name])
    );
    const selectedContact = selectedConversation?.type === "PRIVATE"
        ? contacts.find(c => c.user_id === selectedConversation.recipientUserId)
        : null;

    return (
        <div
            className={`mvp-chat-layout ${showDetails && selectedConversation
                    ? ""
                    : "mvp-details-hidden"
                }`}
        >
            <aside
                aria-label={
                    panelView === "contacts"
                        ? "Contatos disponíveis"
                        : "Conversas disponíveis"
                }
                className={`mvp-chat-sidebar ${sidebarOpen ? "mvp-sidebar-open" : ""}`}
            >
                <div className="mvp-sidebar-brand">
                    <span className="mvp-mini-mark">Cc</span>
                    <strong className="truncate">Corporate Chat</strong>
                    <span className="mvp-sidebar-caret" aria-hidden="true">⌄</span>
                </div>
                <div className="mvp-sidebar-scroll chat-scroll">
                    {panelView === "conversations" && (
                        <>
                            <div className="mvp-sidebar-search">
                                <label className="sr-only" htmlFor="mvp-conversation-search">Buscar conversas</label>
                                <input
                                    id="mvp-conversation-search" type="search"
                                    placeholder="Buscar conversas..."
                                    value={conversationSearch}
                                    onChange={(event) => setConversationSearch(event.target.value)}
                                />
                            </div>
                            {status === "success" && (
                                <>
                                    <section aria-labelledby="conversations-title" className="mvp-conversations-section">
                                        <div className="mvp-side-section-title">
                                            <h2 id="conversations-title">Conversas recentes</h2>
                                            <div className="mvp-conversations-heading-actions">
                                                <span aria-label={`${conversations.length} conversas`}>{conversations.length}</span>
                                                <button
                                                    type="button"
                                                    aria-label="Novo grupo"
                                                    title="Criar novo grupo"
                                                    className="mvp-new-group-icon"
                                                    onClick={() => setCreatingGroup(true)}
                                                    disabled={activeContacts.length === 0}
                                                >
                                                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24"
                                                        fill="none" stroke="currentColor" strokeWidth="2"
                                                        strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 5v14M5 12h14" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        {filteredConversations.length === 0 ? (
                                            <p className="mvp-empty-side">
                                                {conversations.length === 0
                                                    ? "Nenhuma conversa iniciada."
                                                    : "Nenhuma conversa encontrada."}
                                            </p>
                                        ) : (
                                            <ul className="mvp-conversations-list">
                                                {filteredConversations.map((conversation) => {
                                                    const isGroup = conversation.type === "GROUP";
                                                    const name = isGroup
                                                        ? conversation.name ?? "Grupo sem nome"
                                                        : conversation.contact?.name ?? "Contato indisponível";
                                                    const isSelected = selectedConversation?.id === conversation.conversation_id;
                                                    return (
                                                        <li key={conversation.conversation_id}>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectConversation(conversation)}
                                                                aria-label={isGroup ? `Abrir grupo ${name}` : `Abrir conversa com ${name}`}
                                                                aria-pressed={isSelected}
                                                                disabled={openingContactId !== null}
                                                                className="mvp-conversation-item"
                                                            >
                                                                {isGroup ? (
                                                                    <span className="mvp-channel-hash" aria-hidden="true">#</span>
                                                                ) : (
                                                                    <MvpAvatar name={name} size={23} />
                                                                )}
                                                                <span className="mvp-conversation-text">
                                                                    <span className="mvp-conversation-title">{name}</span>
                                                                    <span className="mvp-conversation-preview">
                                                                        {conversation.last_message?.content ?? "Nenhuma mensagem ainda."}
                                                                    </span>
                                                                </span>
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </section>
                                    {/* Contatos agora aparecem exclusivamente na área central,
                                ao clicar no ícone de pessoas da barra estreita. */}
                                </>
                            )}

                        </>
                    )}

                    {panelView === "contacts" && status === "success" && (
                        <ContactList
                            contacts={activeContacts}
                            onSelectContact={handleSelectContact}
                            isOpening={openingContactId !== null}
                        />
                    )}

                </div>
            </aside>

            <main className="mvp-chat-main">
                <header className="mvp-chat-topbar">
                    <div className="mvp-chat-header-main">
                        <button type="button" className="mvp-toggle-sidebar"
                            onClick={() => setSidebarOpen(current => !current)}
                            aria-label={sidebarOpen ? "Ocultar conversas" : "Mostrar conversas"}
                            aria-expanded={sidebarOpen}>☰</button>
                        <div className="mvp-chat-header-text">
                            <h1 className="sr-only">Dashboard</h1>
                            <p className="mvp-chat-breadcrumb">
                                <span aria-hidden="true">{selectedConversation?.type === "GROUP" ? "#" : "◉"}</span>
                                <strong>
                                    {selectedConversation?.name || "Conversas"}
                                </strong>
                            </p>
                            <p className="mvp-chat-welcome">Bem-vindo, {user?.name || "usuário"}.</p>
                        </div>
                    </div>
                    <div className="mvp-header-actions">
                        <span className="mvp-connection-indicator" title="Estado do Socket.IO">
                            <span className={realtimeStatus === "connected" ? "online" : "offline"} />
                            {realtimeStatus === "connected" ? "Conectado" : "Desconectado"}
                        </span>
                        <button type="button" aria-pressed={showDetails}
                            onClick={() => setShowDetails(current => !current)}
                            disabled={!selectedConversation}>
                            {showDetails ? "Ocultar detalhes" : "Detalhes"}
                        </button>
                        <button type="button" onClick={handleLogout} disabled={authLoading}>
                            {authLoading ? "Saindo..." : "Sair"}
                        </button>
                    </div>
                </header>

                {status === "success" && error && (
                    <p role="alert" className="mvp-chat-alert">
                        {error} As conversas já carregadas continuam disponíveis.
                    </p>
                )}
                {openingContactId && (
                    <p role="status" className="mvp-chat-notice">Abrindo conversa...</p>
                )}
                {conversationError && (
                    <p role="alert" className="mvp-chat-alert">
                        {conversationError}
                    </p>
                )}

                {selectedConversation && (
                    <section aria-labelledby="selected-conversation-title" className="mvp-active-conversation">
                        <div className="mvp-selected-conversation-top">
                            <h2 id="selected-conversation-title" className="mvp-active-conversation-heading">
                                {selectedConversation.type === "GROUP"
                                    ? `Grupo: ${selectedConversation.name}`
                                    : `Conversa com ${selectedConversation.name}`}
                            </h2>
                            <div className="mvp-selected-actions">
                                {selectedConversation.type === "GROUP" && (
                                    <button type="button" onClick={() => setManagingGroupId(selectedConversation.id)}>
                                        Gerenciar grupo
                                    </button>
                                )}
                                <button type="button" aria-label="Fechar conversa"
                                    onClick={() => setSelectedConversation(null)}>Fechar</button>
                            </div>
                        </div>
                        <ConversationHistory
                            key={selectedConversation.id}
                            conversationId={selectedConversation.id}
                            currentUserId={user?.user_id}
                            currentUserName={user?.name || "Você"}
                            recipientUserId={selectedConversation.recipientUserId}
                            userNames={contactNames}
                        />
                    </section>
                )}
                {status === "loading" && (
                    <p role="status" className="mvp-chat-notice">Carregando dashboard...</p>
                )}
                {status === "error" && (
                    <div role="alert" className="mvp-chat-alert">
                        <p>{error}</p>
                        <button type="button" onClick={handleRetry}>Tentar novamente</button>
                    </div>
                )}
                {status === "success" && !selectedConversation && (
                    <div className="mvp-chat-placeholder" role="status">
                        <span className="mvp-chat-placeholder-icon" aria-hidden="true">Cc</span>
                        <p>Selecione uma conversa ou contato para começar.</p>
                    </div>
                )}
            </main>

            {selectedConversation && showDetails && (
                <aside className="mvp-chat-details" aria-label="Detalhes da conversa">
                    <div className="mvp-details-heading">
                        <strong>{selectedConversation.name}</strong>
                        <p>{selectedConversation.type === "GROUP" ? "Conversa em grupo" : "Conversa privada"}</p>
                    </div>
                    <div className="mvp-details-tabs">
                        <span className="is-active">Informações</span>
                        <span className="is-disabled" title="Funcionalidade não disponível">Arquivos</span>
                    </div>
                    <div className="mvp-details-body">
                        <MvpAvatar name={selectedConversation.name} size={38} />
                        <h2>{selectedConversation.name}</h2>
                        {selectedContact?.email && <p className="mvp-details-email">{selectedContact.email}</p>}
                        {selectedConversation.type === "GROUP" && (
                            <button type="button" className="mvp-details-action"
                                onClick={() => setManagingGroupId(selectedConversation.id)}>
                                Gerenciar membros
                            </button>
                        )}
                    </div>
                </aside>
            )}
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
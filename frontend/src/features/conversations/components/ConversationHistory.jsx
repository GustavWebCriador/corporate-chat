import { useEffect, useRef, useState } from "react";

import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { MessageCheckpoints } from "./MessageCheckpoints";

import { conversationService } from "../../../services/api/conversationService";
import { useRealtime } from "../../realtime/hooks/useRealtime";
import { useConversationCheckpoints } from "../../realtime/hooks/useConversationCheckpoints";
import { sendRealtimeMessage } from "../../../services/realtime/chatMessages";
import { syncRealtimeMessages } from "../../../services/realtime/chatSync";

const initialHistory = {
    conversationId: null,
    status: "loading",
    items: [],
    hasMore: false,
    nextCursor: null,
    loadingOlder: false,
    olderError: "",
    error: "",
};

function isValidHistoryPage(response) {
    return (
        Array.isArray(response?.items) &&
        typeof response?.hasMore === "boolean" &&
        (
            !response.hasMore ||
            (
                typeof response.nextCursor === "string" &&
                response.nextCursor.length > 0
            )
        )
    );
}

// Junta mensagens sem duplicar identificadores.
// Respeita a ordem cronológica quando há timestamps.
function mergeMessages(existing = [], incoming = []) {
    const byId = new Map();

    for (const message of [...existing, ...incoming]) {
        if (
            typeof message?._id === "string" &&
            !byId.has(message._id)
        ) {
            byId.set(message._id, message);
        }
    }

    return [...byId.values()].sort((a, b) => {
        const dateA = a.created_at;
        const dateB = b.created_at;

        if (
            typeof dateA === "string" &&
            typeof dateB === "string"
        ) {
            const comparison = dateA.localeCompare(dateB);

            return comparison !== 0
                ? comparison
                : a._id.localeCompare(b._id);
        }

        return 0;
    });
}

export function ConversationHistory({
    conversationId,
    currentUserId,
    recipientUserId,
    createClientMessageId,
    userNames,
    currentUserName,
}) {
    const [history, setHistory] = useState(initialHistory);
    const [retryKey, setRetryKey] = useState(0);
    const [syncRetryKey, setSyncRetryKey] = useState(0);
    const [syncError, setSyncError] = useState("");

    const requestVersionRef = useRef(0);
    const loadingOlderRef = useRef(false);
    const latestMessageIdRef = useRef(null)

    const {
        socket,
        status: realtimeStatus,
    } = useRealtime();

    const checkpoints = useConversationCheckpoints(
        conversationId,
        currentUserId
    );

    // Não mostra histórico de outra conversa
    // durante uma mudança de seleção.
    const visibleHistory =
        history.conversationId === conversationId
            ? history
            : initialHistory;

    // ========================================
    // 1. CARREGAR HISTÓRICO HTTP
    // ========================================

    useEffect(() => {
        const version = ++requestVersionRef.current;

        loadingOlderRef.current = false;

        conversationService.getHistory(conversationId)
            .then((response) => {
                if (version !== requestVersionRef.current) {
                    return;
                }

                if (!isValidHistoryPage(response)) {
                    throw new Error("INVALID_HISTORY_RESPONSE");
                }

                setHistory((current) => {
                    // Preserva mensagens recebidas durante
                    // o carregamento inicial.
                    const pendingItems =
                        current.conversationId === conversationId
                            ? current.items
                            : [];

                    return {
                        conversationId,
                        status: "success",
                        items: mergeMessages(
                            response.items,
                            pendingItems
                        ),
                        hasMore: response.hasMore,
                        nextCursor: response.nextCursor ?? null,
                        loadingOlder: false,
                        olderError: "",
                        error: "",
                    };
                });
            })
            .catch((error) => {
                if (version !== requestVersionRef.current) {
                    return;
                }

                setHistory({
                    ...initialHistory,
                    conversationId,
                    status: "error",
                    error: error.status === 401
                        ? "Sua sessão não é mais válida. Entre novamente."
                        : "Não foi possível carregar o histórico.",
                });
            });

        return () => {
            requestVersionRef.current += 1;
        };
    }, [conversationId, retryKey]);

    function handleRetry() {
        setHistory({
            ...initialHistory,
            conversationId,
        });

        setRetryKey((current) => current + 1);
    }

    // ========================================
    // 2. PAGINAR HISTÓRICO ANTERIOR
    // ========================================

    async function handleLoadEarlier() {
        if (
            visibleHistory.status !== "success" ||
            !visibleHistory.hasMore ||
            !visibleHistory.nextCursor ||
            loadingOlderRef.current
        ) {
            return;
        }

        loadingOlderRef.current = true;

        const version = requestVersionRef.current;

        setHistory((current) => ({
            ...current,
            loadingOlder: true,
            olderError: "",
        }));

        try {
            const response = await conversationService.getHistory(
                conversationId,
                {
                    before: visibleHistory.nextCursor,
                }
            );

            if (version !== requestVersionRef.current) {
                return;
            }

            if (!isValidHistoryPage(response)) {
                throw new Error("INVALID_HISTORY_RESPONSE");
            }

            setHistory((current) => {
                if (current.conversationId !== conversationId) {
                    return current;
                }

                return {
                    ...current,
                    items: mergeMessages(
                        response.items,
                        current.items
                    ),
                    hasMore: response.hasMore,
                    nextCursor: response.nextCursor ?? null,
                    loadingOlder: false,
                    olderError: "",
                };
            });
        } catch (error) {
            if (version !== requestVersionRef.current) {
                return;
            }

            setHistory((current) => ({
                ...current,
                loadingOlder: false,
                olderError: error.status === 401
                    ? "Sua sessão não é mais válida. Entre novamente."
                    : "Não foi possível carregar mensagens anteriores.",
            }));
        } finally {
            if (version === requestVersionRef.current) {
                loadingOlderRef.current = false;
            }
        }
    }

    // ========================================
    // 3. ENVIAR MENSAGEM
    // ========================================

    async function handleSendMessage(payload) {
        const version = requestVersionRef.current;

        const response =
            realtimeStatus === "connected" && socket?.connected
                ? await sendRealtimeMessage(
                    socket,
                    conversationId,
                    payload
                )
                : await conversationService.sendMessage(
                    conversationId,
                    payload
                );

        const message = response?.message;

        if (
            typeof message?._id !== "string" ||
            message.conversation_id !== conversationId ||
            typeof message.content !== "string"
        ) {
            throw new Error("INVALID_MESSAGE_RESPONSE");
        }

        if (version !== requestVersionRef.current) {
            return;
        }

        setHistory((current) => {
            if (
                current.status !== "success" ||
                current.conversationId !== conversationId
            ) {
                return current;
            }

            if (
                current.items.some(
                    (item) => item._id === message._id
                )
            ) {
                return current;
            }

            return {
                ...current,
                items: mergeMessages(
                    current.items,
                    [message]
                ),
            };
        });
    }

    // ========================================
    // 4. RECEBER message:new
    // ========================================

    useEffect(() => {
        if (realtimeStatus !== "connected" || !socket) {
            return;
        }

        function handleNewMessage(payload) {
            const message = payload?.message;

            if (
                typeof message?._id !== "string" ||
                message.conversation_id !== conversationId ||
                typeof message.content !== "string"
            ) {
                return;
            }

            setHistory((current) => {
                const sameConversation =
                    current.conversationId === conversationId;

                const currentItems = sameConversation
                    ? current.items
                    : [];

                if (
                    currentItems.some(
                        (item) => item._id === message._id
                    )
                ) {
                    return current;
                }

                return {
                    ...(sameConversation
                        ? current
                        : initialHistory),
                    conversationId,
                    items: mergeMessages(
                        currentItems,
                        [message]
                    ),
                };
            });
        }

        socket.on("message:new", handleNewMessage);

        return () => {
            socket.off("message:new", handleNewMessage);
        };
    }, [socket, realtimeStatus, conversationId]);

    // ========================================
    // 5. SINCRONIZAR APÓS CONEXÃO
    // OU RECONEXÃO
    // ========================================
    // Mantém a referência da última mensagem
    // sem reiniciar a sincronização a cada atualização.
    useEffect(() => {
        latestMessageIdRef.current =
            history.items[history.items.length - 1]?._id ?? null;
    }, [history.items]);

    useEffect(() => {
        if (
            realtimeStatus !== "connected" ||
            !socket?.connected ||
            history.status !== "success" ||
            history.conversationId !== conversationId
        ) {
            return;
        }

        let cancelled = false;
        const version = requestVersionRef.current;
        // Utiliza o último identificador conhecido
        // sem criar dependência direta de history.items.
        let cursor = latestMessageIdRef.current;

        function isActive() {
            return (
                !cancelled &&
                version === requestVersionRef.current &&
                socket.connected
            );
        }

        async function synchronize() {
            setSyncError("");

            let pages = 0;

            try {
                while (isActive()) {
                    const result = await syncRealtimeMessages(
                        socket,
                        conversationId,
                        cursor
                            ? {
                                afterMessageId: cursor,
                                limit: 50,
                            }
                            : {
                                limit: 50,
                            }
                    );

                    if (!isActive()) {
                        return;
                    }

                    // Incorpora cada página sem substituir
                    // mensagens recebidas por message:new.
                    setHistory((current) => {
                        if (
                            current.status !== "success" ||
                            current.conversationId !== conversationId
                        ) {
                            return current;
                        }

                        const items = mergeMessages(
                            current.items,
                            result.items
                        );

                        if (items.length === current.items.length) {
                            return current;
                        }

                        return {
                            ...current,
                            items,
                        };
                    });

                    if (!result.hasMore) {
                        break;
                    }

                    cursor = result.nextAfterMessageId;
                    pages += 1;

                    // Proteção contra sincronizações
                    // excessivamente longas.
                    if (pages >= 100) {
                        throw new Error("SYNC_PAGE_LIMIT");
                    }
                }
            } catch {
                if (isActive()) {
                    setSyncError(
                        "Não foi possível sincronizar todas as mensagens."
                    );
                }
            }
        }

        void synchronize();

        return () => {
            cancelled = true;
        };
    }, [
        conversationId,
        socket,
        realtimeStatus,
        history.status,
        history.conversationId,
        syncRetryKey,
    ]);

    // ========================================
    // 6. INTERFACE
    // ========================================

    return (
        <section
            aria-label="Histórico da conversa"
            className="mvp-history"
        >
            {visibleHistory.status === "loading" && (
                <p
                    role="status"
                    className="p-6 text-center text-sm text-slate-400"
                >
                    Carregando mensagens...
                </p>
            )}

            {visibleHistory.status === "error" && (
                <div role="alert" className="space-y-3 p-6">
                    <p className="text-sm text-rose-500">
                        {visibleHistory.error}
                    </p>

                    <button
                        type="button"
                        onClick={handleRetry}
                        className="cursor-pointer rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950"
                    >
                        Tentar novamente
                    </button>
                </div>
            )}

            {visibleHistory.status === "success" && (
                <>
                    {visibleHistory.hasMore && (
                        <div className="border-b border-slate-400/10 p-3 text-center">
                            <button
                                type="button"
                                onClick={handleLoadEarlier}
                                disabled={visibleHistory.loadingOlder}
                                className="cursor-pointer rounded-lg border border-teal-500/30 px-4 py-2 text-sm text-teal-300 transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {visibleHistory.loadingOlder
                                    ? "Carregando mensagens anteriores..."
                                    : "Carregar mensagens anteriores"}
                            </button>
                        </div>
                    )}

                    {visibleHistory.olderError && (
                        <p
                            role="alert"
                            className="px-4 py-3 text-center text-sm text-rose-500"
                        >
                            {visibleHistory.olderError}
                        </p>
                    )}

                    {syncError && (
                        <div
                            role="alert"
                            className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-500/20 p-3"
                        >
                            <p className="text-xs text-rose-400">
                                {syncError}
                            </p>

                            <button
                                type="button"
                                onClick={() => {
                                    setSyncError("");
                                    setSyncRetryKey(
                                        (current) => current + 1
                                    );
                                }}
                                className="cursor-pointer text-xs text-teal-300 underline"
                            >
                                Tentar sincronização
                            </button>
                        </div>
                    )}

                    <MessageList
                        messages={visibleHistory.items}
                        currentUserId={currentUserId}
                        recipientUserId={recipientUserId}
                        checkpoints={checkpoints}
                        userNames={userNames}
                        currentUserName={currentUserName}
                    />

                    <MessageCheckpoints
                        conversationId={conversationId}
                        currentUserId={currentUserId}
                        messages={visibleHistory.items}
                    />

                    <MessageComposer
                        onSend={handleSendMessage}
                        createClientMessageId={createClientMessageId}
                    />
                </>
            )}
        </section>
    );
}
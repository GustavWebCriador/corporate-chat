import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { conversationService } from "../../../services/api/conversationService";
import { useRealtime } from "../../realtime/hooks/useRealtime";

import {
    HISTORY_PAGE_SIZE,
    MESSAGE_MAX_LENGTH,
    MESSAGE_STATUS,
    applyReceipts,
    createClientMessageId,
    fromServerMessage,
    mergeMessages,
} from "../utils/messages";

const SYNC_MAX_PAGES = 20;

// Falhas de conexão: a mensagem é reenviada automaticamente.
const RETRYABLE_REALTIME_CODES = new Set([
    "REALTIME_UNAVAILABLE",
    "REALTIME_TIMEOUT",
    "INTERNAL_ERROR",
]);

function describeSendError(error) {
    const status = error?.status;
    const code = error?.code;

    if (status === 429 || code === "RATE_LIMITED") {
        return "Muitas mensagens em sequência. Aguarde e tente novamente.";
    }

    if (status === 403 || code === "USER_NOT_ACTIVE_MEMBER") {
        return "Você não participa mais desta conversa.";
    }

    if (
        status === 400 ||
        status === 413 ||
        code?.startsWith?.("MESSAGE_") ||
        code === "VALIDATION_ERROR"
    ) {
        return error.message || "Mensagem inválida.";
    }

    return "Não foi possível enviar. Verifique sua conexão.";
}

function isRetryable(error, viaRealtime) {
    if (viaRealtime) {
        return RETRYABLE_REALTIME_CODES.has(error?.code);
    }

    return !error?.status || error.status >= 429;
}

/**
 * Estado das mensagens de uma conversa (FE-04 + FE-06).
 *
 * - RF11: 50 mensagens mais recentes e páginas anteriores por cursor;
 * - RF07: Enviando → Enviada → Entregue → Lida, ou Falha;
 * - RF12: com o socket conectado, envio, recebimento, entrega e leitura
 *   acontecem em tempo real; sem socket, usa a API REST;
 * - RF08/CA12.4: após reconectar, sincroniza mensagens perdidas e
 *   reenvia falhas de conexão com o mesmo clientMessageId.
 */
export function useConversationMessages(
    conversationId,
    currentUserId,
    { isGroup = false } = {}
) {
    const realtime = useRealtime();

    const [messages, setMessages] = useState([]);
    const [receipts, setReceipts] = useState({});
    const [status, setStatus] = useState("loading");
    const [error, setError] = useState("");
    const [hasMore, setHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [visible, setVisible] = useState(
        () => typeof document === "undefined" || !document.hidden
    );

    const cursorRef = useRef(null);
    const loadingOlderRef = useRef(false);
    const conversationRef = useRef(conversationId);
    const lastReadRef = useRef(null);
    const messagesRef = useRef(messages);
    const realtimeRef = useRef(realtime);
    const readyAtLoadRef = useRef(null);

    // Atualizado no mesmo commit da renderização (antes da pintura): um
    // evento "online" logo após a falha precisa enxergar a mensagem FAILED.
    useLayoutEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        realtimeRef.current = realtime;
    }, [realtime]);

    // Carga inicial do histórico ao abrir a conversa.
    useEffect(() => {
        let active = true;

        conversationRef.current = conversationId;
        cursorRef.current = null;
        lastReadRef.current = null;
        readyAtLoadRef.current = null;

        conversationService
            .getHistory(conversationId, { limit: HISTORY_PAGE_SIZE })
            .then((page) => {
                if (!active) return;

                if (!Array.isArray(page?.items)) {
                    throw new Error("INVALID_HISTORY_RESPONSE");
                }

                cursorRef.current = page.nextCursor ?? null;
                readyAtLoadRef.current = realtimeRef.current.readyCount;
                setHasMore(Boolean(page.hasMore));
                setMessages((current) =>
                    mergeMessages(
                        current,
                        page.items.map((item) =>
                            fromServerMessage(item, currentUserId)
                        )
                    )
                );
                setStatus("ready");
            })
            .catch((err) => {
                if (!active) return;

                setStatus("error");
                setError(
                    err?.status === 403
                        ? "Você não tem acesso a esta conversa."
                        : "Não foi possível carregar as mensagens."
                );
            });

        return () => {
            active = false;
        };
    }, [conversationId, currentUserId, reloadKey]);

    const reload = useCallback(() => {
        setStatus("loading");
        setError("");
        setMessages([]);
        setHasMore(false);
        setReloadKey((current) => current + 1);
    }, []);

    // Carrega mensagens anteriores (navegação para cima — RF11/RF13).
    const loadOlder = useCallback(async () => {
        if (loadingOlderRef.current || !cursorRef.current) {
            return;
        }

        const requestedConversation = conversationRef.current;

        loadingOlderRef.current = true;
        setLoadingOlder(true);

        try {
            const page = await conversationService.getHistory(
                requestedConversation,
                {
                    limit: HISTORY_PAGE_SIZE,
                    before: cursorRef.current,
                }
            );

            if (conversationRef.current !== requestedConversation) {
                return;
            }

            cursorRef.current = page?.nextCursor ?? null;
            setHasMore(Boolean(page?.hasMore));
            setMessages((current) =>
                mergeMessages(
                    current,
                    (page?.items ?? []).map((item) =>
                        fromServerMessage(item, currentUserId)
                    )
                )
            );
        } catch {
            // Mantém as mensagens atuais; o usuário pode tentar novamente.
        } finally {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
        }
    }, [currentUserId]);

    const deliver = useCallback(async (pending) => {
        const targetConversation = conversationRef.current;
        const viaRealtime = realtimeRef.current.isConnected;
        const payload = {
            clientMessageId: pending.clientMessageId,
            content: pending.content,
        };

        try {
            const result = viaRealtime
                ? await realtimeRef.current.emitWithAck("message:send", {
                    conversationId: targetConversation,
                    ...payload,
                })
                : await conversationService.sendMessage(
                    targetConversation,
                    payload
                );

            if (conversationRef.current === targetConversation) {
                setMessages((current) =>
                    mergeMessages(current, [
                        fromServerMessage(result.message, currentUserId),
                    ])
                );
            }

            return result;
        } catch (err) {
            if (conversationRef.current === targetConversation) {
                setMessages((current) =>
                    current.map((item) =>
                        item.clientMessageId === pending.clientMessageId &&
                        !item.id
                            ? {
                                ...item,
                                status: MESSAGE_STATUS.FAILED,
                                error: describeSendError(err),
                                retryable: isRetryable(err, viaRealtime),
                            }
                            : item
                    )
                );
            }

            return null;
        }
    }, [currentUserId]);

    // Envio de nova mensagem (CA07.1–CA07.4).
    const send = useCallback((rawContent) => {
        const content = rawContent.trim();

        if (!content || content.length > MESSAGE_MAX_LENGTH) {
            return null;
        }

        const pending = {
            key: createClientMessageId(),
            id: null,
            clientMessageId: createClientMessageId(),
            senderId: currentUserId,
            content,
            createdAt: new Date().toISOString(),
            isOwn: true,
            status: MESSAGE_STATUS.SENDING,
        };

        setMessages((current) => [...current, pending]);

        return deliver(pending);
    }, [currentUserId, deliver]);

    // Reenvio preservando o mesmo clientMessageId (CA08.4).
    const retry = useCallback((clientMessageId) => {
        const target = messagesRef.current.find(
            (item) =>
                item.clientMessageId === clientMessageId &&
                item.status === MESSAGE_STATUS.FAILED
        );

        if (!target) {
            return null;
        }

        setMessages((current) =>
            current.map((item) =>
                item.clientMessageId === clientMessageId && !item.id
                    ? {
                        ...item,
                        status: MESSAGE_STATUS.SENDING,
                        error: undefined,
                    }
                    : item
            )
        );

        return deliver(target);
    }, [deliver]);

    const retryConnectionFailures = useCallback(() => {
        messagesRef.current
            .filter(
                (item) =>
                    item.status === MESSAGE_STATUS.FAILED &&
                    item.retryable
            )
            .forEach((item) => retry(item.clientMessageId));
    }, [retry]);

    // Sem socket: reenvia quando o navegador volta a ficar online.
    useEffect(() => {
        window.addEventListener("online", retryConnectionFailures);

        return () => {
            window.removeEventListener("online", retryConnectionFailures);
        };
    }, [retryConnectionFailures]);

    // Mensagens novas em tempo real (CA06.3 / CA12.1).
    const { subscribe } = realtime;

    useEffect(() => {
        const unsubscribeNew = subscribe("message:new", (payload) => {
            const message = payload?.message;

            if (message?.conversation_id !== conversationRef.current) {
                return;
            }

            setMessages((current) =>
                mergeMessages(current, [
                    fromServerMessage(message, currentUserId),
                ])
            );
        });

        // Checkpoints de entrega e leitura dos outros participantes.
        const handleCheckpoint = (payload) => {
            const checkpoint = payload?.checkpoint;

            if (
                checkpoint?.conversation_id !== conversationRef.current ||
                !checkpoint.user_id ||
                checkpoint.user_id === currentUserId
            ) {
                return;
            }

            setReceipts((current) => ({
                ...current,
                [checkpoint.user_id]: {
                    delivered: checkpoint.last_delivered_message_id ?? null,
                    read: checkpoint.last_read_message_id ?? null,
                },
            }));
        };

        const unsubscribeDelivery = subscribe(
            "message:delivery:update",
            handleCheckpoint
        );
        const unsubscribeRead = subscribe(
            "message:read:update",
            handleCheckpoint
        );

        return () => {
            unsubscribeNew();
            unsubscribeDelivery();
            unsubscribeRead();
        };
    }, [subscribe, currentUserId]);

    // Após (re)conexão: busca mensagens perdidas e reenvia falhas (CA12.4).
    const { readyCount, isConnected } = realtime;

    useEffect(() => {
        if (
            status !== "ready" ||
            !isConnected ||
            readyAtLoadRef.current === null ||
            readyCount <= readyAtLoadRef.current
        ) {
            return;
        }

        readyAtLoadRef.current = readyCount;

        const targetConversation = conversationRef.current;

        async function synchronize() {
            let afterMessageId = [...messagesRef.current]
                .reverse()
                .find((item) => item.id)?.id;

            for (let page = 0; page < SYNC_MAX_PAGES; page += 1) {
                const data = await realtimeRef.current.emitWithAck(
                    "realtime:sync",
                    {
                        conversationId: targetConversation,
                        ...(afterMessageId ? { afterMessageId } : {}),
                        limit: HISTORY_PAGE_SIZE,
                    }
                );

                if (conversationRef.current !== targetConversation) {
                    return;
                }

                setMessages((current) =>
                    mergeMessages(
                        current,
                        (data?.items ?? []).map((item) =>
                            fromServerMessage(item, currentUserId)
                        )
                    )
                );

                if (!data?.hasMore || !data.nextAfterMessageId) {
                    return;
                }

                afterMessageId = data.nextAfterMessageId;
            }
        }

        synchronize()
            .catch(() => {
                // O histórico continua disponível pela API REST.
            })
            .finally(() => {
                if (conversationRef.current === targetConversation) {
                    retryConnectionFailures();
                }
            });
    }, [readyCount, isConnected, status, currentUserId, retryConnectionFailures]);

    // Acompanha se a aba está visível para registrar leitura somente nela.
    useEffect(() => {
        function handleVisibility() {
            setVisible(!document.hidden);
        }

        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, []);

    // Registra entrega/leitura da mensagem mais recente recebida.
    useEffect(() => {
        if (status !== "ready") return;

        const latestReceived = [...messages]
            .reverse()
            .find((item) => item.id && !item.isOwn);

        if (!latestReceived) {
            return;
        }

        const readKey = `${latestReceived.id}:${visible ? "read" : "delivered"}`;

        if (lastReadRef.current === readKey) {
            return;
        }

        lastReadRef.current = readKey;

        const event = visible ? "message:read" : "message:delivered";
        const payload = {
            conversationId,
            messageId: latestReceived.id,
        };

        const request = isConnected
            ? realtimeRef.current.emitWithAck(event, payload)
            : visible
                ? conversationService.markRead(conversationId, latestReceived.id)
                : Promise.resolve();

        request.catch(() => {
            // Checkpoint auxiliar; falhas não bloqueiam o chat.
            lastReadRef.current = null;
        });
    }, [messages, status, conversationId, visible, isConnected]);

    // Estados Entregue/Lida das mensagens próprias.
    const displayedMessages = useMemo(
        () => applyReceipts(messages, receipts, { isGroup }),
        [messages, receipts, isGroup]
    );

    return {
        messages: displayedMessages,
        status,
        error,
        hasMore,
        loadingOlder,
        loadOlder,
        send,
        retry,
        reload,
    };
}

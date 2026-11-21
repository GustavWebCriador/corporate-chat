import { useCallback, useEffect, useRef, useState } from "react";

import { conversationService } from "../../../services/api/conversationService";

import {
    HISTORY_PAGE_SIZE,
    MESSAGE_MAX_LENGTH,
    MESSAGE_STATUS,
    createClientMessageId,
    fromServerMessage,
    mergeMessages,
} from "../utils/messages";

function describeSendError(error) {
    if (error?.status === 429) {
        return "Muitas mensagens em sequência. Aguarde e tente novamente.";
    }

    if (error?.status === 400 || error?.status === 413) {
        return error.message || "Mensagem inválida.";
    }

    if (error?.status === 403) {
        return "Você não participa mais desta conversa.";
    }

    return "Não foi possível enviar. Verifique sua conexão.";
}

/**
 * Estado das mensagens de uma conversa (FE-04).
 *
 * - RF11: carrega as 50 mensagens mais recentes e páginas anteriores por cursor.
 * - RF07: envio com estados Enviando → Enviada, ou Falha.
 * - RF08: reenvio com o mesmo clientMessageId (idempotente), inclusive
 *   automaticamente quando o navegador volta a ficar online.
 */
export function useConversationMessages(conversationId, currentUserId) {
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState("loading");
    const [error, setError] = useState("");
    const [hasMore, setHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const cursorRef = useRef(null);
    const loadingOlderRef = useRef(false);
    const conversationRef = useRef(conversationId);
    const lastReadRef = useRef(null);
    const messagesRef = useRef(messages);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Carga inicial do histórico ao abrir a conversa.
    useEffect(() => {
        let active = true;

        conversationRef.current = conversationId;
        cursorRef.current = null;
        lastReadRef.current = null;

        conversationService
            .getHistory(conversationId, { limit: HISTORY_PAGE_SIZE })
            .then((page) => {
                if (!active) return;

                if (!Array.isArray(page?.items)) {
                    throw new Error("INVALID_HISTORY_RESPONSE");
                }

                cursorRef.current = page.nextCursor ?? null;
                setHasMore(Boolean(page.hasMore));
                setMessages(
                    mergeMessages(
                        [],
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

        try {
            const result = await conversationService.sendMessage(
                targetConversation,
                {
                    clientMessageId: pending.clientMessageId,
                    content: pending.content,
                }
            );

            if (conversationRef.current !== targetConversation) {
                return result;
            }

            setMessages((current) =>
                mergeMessages(current, [
                    fromServerMessage(result.message, currentUserId),
                ])
            );

            return result;
        } catch (err) {
            if (conversationRef.current === targetConversation) {
                setMessages((current) =>
                    current.map((item) =>
                        item.clientMessageId === pending.clientMessageId
                            ? {
                                ...item,
                                status: MESSAGE_STATUS.FAILED,
                                error: describeSendError(err),
                                retryable: !err?.status || err.status >= 429,
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
                item.clientMessageId === clientMessageId
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

    // Reenvia automaticamente falhas de conexão quando a rede retorna.
    useEffect(() => {
        function handleOnline() {
            messagesRef.current
                .filter(
                    (item) =>
                        item.status === MESSAGE_STATUS.FAILED &&
                        item.retryable
                )
                .forEach((item) => retry(item.clientMessageId));
        }

        window.addEventListener("online", handleOnline);

        return () => {
            window.removeEventListener("online", handleOnline);
        };
    }, [retry]);

    // Registra leitura da mensagem mais recente recebida de outro participante.
    useEffect(() => {
        if (status !== "ready") return;

        const latestReceived = [...messages]
            .reverse()
            .find((item) => item.id && !item.isOwn);

        if (!latestReceived || lastReadRef.current === latestReceived.id) {
            return;
        }

        lastReadRef.current = latestReceived.id;

        conversationService
            .markRead(conversationId, latestReceived.id)
            .catch(() => {
                // A leitura é um checkpoint auxiliar; falhas não bloqueiam o chat.
                lastReadRef.current = null;
            });
    }, [messages, status, conversationId]);

    return {
        messages,
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

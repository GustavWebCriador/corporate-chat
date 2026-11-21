
import { useEffect, useState } from "react";

import { useRealtime } from "./useRealtime";

import { conversationService } from "../../../services/api/conversationService";

// Combina o checkpoint persistido com eventos realtime.
// Uma atualização antiga não pode regredir o estado.
function mergeCheckpoint(previous = {}, incoming) {
    const result = {
        ...previous,
        conversation_id: incoming.conversation_id,
        user_id: incoming.user_id,
    };

    const fields = [
        ["last_delivered_message_id", "last_delivered_at"],
        ["last_read_message_id", "last_read_at"],
    ];

    for (const [messageField, dateField] of fields) {
        const incomingMessageId = incoming[messageField];

        if (
            typeof incomingMessageId !== "string" ||
            !incomingMessageId
        ) {
            continue;
        }

        const previousDate = previous[dateField];
        const incomingDate = incoming[dateField];

        const previousTime = Date.parse(previousDate);
        const incomingTime = Date.parse(incomingDate);

        // Não sobrescreve um checkpoint mais recente.
        if (
            Number.isFinite(previousTime) &&
            (
                !Number.isFinite(incomingTime) ||
                incomingTime < previousTime
            )
        ) {
            continue;
        }

        result[messageField] = incomingMessageId;
        result[dateField] = incomingDate ?? null;
    }

    return result;
}

export function useConversationCheckpoints(
    conversationId,
    currentUserId
) {
    const { socket, status } = useRealtime();

    const [state, setState] = useState({
        conversationId: null,
        byUser: {},
    });

    // ========================================
    // 1. RECEBER EVENTOS SOCKET.IO
    // ========================================

    useEffect(() => {
        if (
            !conversationId ||
            !currentUserId ||
            status !== "connected" ||
            !socket?.connected
        ) {
            return;
        }

        function handleCheckpointUpdate(payload) {
            const checkpoint = payload?.checkpoint;

            if (
                !checkpoint ||
                checkpoint.conversation_id !== conversationId ||
                typeof checkpoint.user_id !== "string" ||
                !checkpoint.user_id ||
                checkpoint.user_id === currentUserId
            ) {
                return;
            }

            setState((current) => {
                const previousUsers =
                    current.conversationId === conversationId
                        ? current.byUser
                        : {};

                return {
                    conversationId,
                    byUser: {
                        ...previousUsers,
                        [checkpoint.user_id]: mergeCheckpoint(
                            previousUsers[checkpoint.user_id],
                            checkpoint
                        ),
                    },
                };
            });
        }

        socket.on(
            "message:delivery:update",
            handleCheckpointUpdate
        );

        socket.on(
            "message:read:update",
            handleCheckpointUpdate
        );

        return () => {
            socket.off(
                "message:delivery:update",
                handleCheckpointUpdate
            );

            socket.off(
                "message:read:update",
                handleCheckpointUpdate
            );
        };
    }, [
        socket,
        status,
        conversationId,
        currentUserId,
    ]);

    // ========================================
    // 2. RECUPERAR CHECKPOINTS PERSISTIDOS
    // ========================================

    useEffect(() => {
        if (!conversationId || !currentUserId) {
            return;
        }

        let active = true;

        async function loadCheckpoints() {
            try {
                const response =
                    await conversationService.getCheckpoints(
                        conversationId
                    );

                if (!active) {
                    return;
                }

                if (!Array.isArray(response?.checkpoints)) {
                    throw new Error(
                        "INVALID_CHECKPOINTS_RESPONSE"
                    );
                }

                setState((current) => {
                    // Mantém eventos Socket.IO que possam ter
                    // chegado antes da resposta HTTP.
                    const previousUsers =
                        current.conversationId === conversationId
                            ? current.byUser
                            : {};

                    const nextUsers = {
                        ...previousUsers,
                    };

                    for (const checkpoint of response.checkpoints) {
                        if (
                            !checkpoint ||
                            checkpoint.conversation_id !== conversationId ||
                            typeof checkpoint.user_id !== "string" ||
                            !checkpoint.user_id ||
                            checkpoint.user_id === currentUserId
                        ) {
                            continue;
                        }

                        nextUsers[checkpoint.user_id] =
                            mergeCheckpoint(
                                nextUsers[checkpoint.user_id],
                                checkpoint
                            );
                    }

                    return {
                        conversationId,
                        byUser: nextUsers,
                    };
                });
            } catch {
                // Não fabricamos confirmações quando
                // a consulta HTTP não está disponível.
                // O tratamento visual de indisponibilidade
                // será revisado separadamente.
            }
        }

        void loadCheckpoints();

        return () => {
            active = false;
        };
    }, [
        conversationId,
        currentUserId,
        status,
    ]);

    // Não expõe dados de outra conversa.
    return state.conversationId === conversationId
        ? state.byUser
        : {};
}

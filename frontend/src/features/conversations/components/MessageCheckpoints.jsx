
import { useEffect, useState } from "react";

import { conversationService } from "../../../services/api/conversationService";
import { useRealtime } from "../../realtime/hooks/useRealtime";

import {
    markRealtimeDelivered,
    markRealtimeRead,
} from "../../../services/realtime/chatCheckpoints";

// Verifica se o usuário está visualizando a aplicação.
function isConversationVisible() {
    return (
        document.visibilityState === "visible" &&
        document.hasFocus()
    );
}

export function MessageCheckpoints({
    conversationId,
    currentUserId,
    messages = [],
}) {
    // Conexão Socket.IO da sessão autenticada.
    const {
        socket,
        status: realtimeStatus,
    } = useRealtime();

    const [isViewing, setIsViewing] = useState(
        isConversationVisible
    );

    const [error, setError] = useState("");
    const [retryKey, setRetryKey] = useState(0);

    // Identifica a mensagem recebida mais recente.
    // Não confirma mensagens enviadas pelo próprio usuário.
    const latestReceivedMessage = [...messages]
        .reverse()
        .find(
            (message) =>
                typeof message._id === "string" &&
                typeof message.sender_id === "string" &&
                message.sender_id !== currentUserId
        );

    const latestReceivedId = latestReceivedMessage?._id;

    // ========================================
    // 1. MONITORAR VISIBILIDADE
    // ========================================

    useEffect(() => {
        function updateVisibility() {
            setIsViewing(isConversationVisible());
        }

        document.addEventListener(
            "visibilitychange",
            updateVisibility
        );

        window.addEventListener(
            "focus",
            updateVisibility
        );

        window.addEventListener(
            "blur",
            updateVisibility
        );

        return () => {
            document.removeEventListener(
                "visibilitychange",
                updateVisibility
            );

            window.removeEventListener(
                "focus",
                updateVisibility
            );

            window.removeEventListener(
                "blur",
                updateVisibility
            );
        };
    }, []);

    // ========================================
    // 2. CONFIRMAR ENTREGA OU LEITURA
    // ========================================

    useEffect(() => {
        if (
            !conversationId ||
            !currentUserId ||
            !latestReceivedId
        ) {
            return;
        }

        let active = true;

        async function confirmCheckpoint() {
            try {
                const realtimeAvailable =
                    realtimeStatus === "connected" &&
                    socket?.connected;

                if (isViewing) {
                    // Leitura também confirma entrega
                    // automaticamente no backend.
                    if (realtimeAvailable) {
                        await markRealtimeRead(
                            socket,
                            conversationId,
                            latestReceivedId
                        );
                    } else {
                        await conversationService.markRead(
                            conversationId,
                            latestReceivedId
                        );
                    }
                } else {
                    // Aplicação sem foco:
                    // confirma apenas a entrega.
                    if (realtimeAvailable) {
                        await markRealtimeDelivered(
                            socket,
                            conversationId,
                            latestReceivedId
                        );
                    } else {
                        await conversationService.markDelivered(
                            conversationId,
                            latestReceivedId
                        );
                    }
                }

                if (active) {
                    setError("");
                }
            } catch {
                if (active) {
                    setError(
                        "Não foi possível atualizar a confirmação de entrega ou leitura."
                    );
                }
            }
        }

        void confirmCheckpoint();

        return () => {
            active = false;
        };
    }, [
        conversationId,
        currentUserId,
        latestReceivedId,
        isViewing,
        socket,
        realtimeStatus,
        retryKey,
    ]);

    // ========================================
    // 3. APRESENTAR ERRO E PERMITIR RETRY
    // ========================================

    if (!error) {
        return null;
    }

    return (
        <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-400/10 p-3"
        >
            <p className="text-xs text-rose-400">
                {error}
            </p>

            <button
                type="button"
                onClick={() => {
                    setError("");
                    setRetryKey((current) => current + 1);
                }}
                className="cursor-pointer text-xs text-teal-300 underline"
            >
                Tentar novamente
            </button>
        </div>
    );
}

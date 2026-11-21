import { CONNECTION_STATUS } from "../context/realtimeContext";
import { useRealtime } from "../hooks/useRealtime";

const MESSAGES = {
    [CONNECTION_STATUS.RECONNECTING]: {
        text: "Reconectando...",
        className: "border-amber-400/40 bg-amber-400/10 text-amber-400",
    },
    [CONNECTION_STATUS.UNAVAILABLE]: {
        text: "Sem conexão em tempo real. As mensagens serão enviadas pelo servidor e atualizadas ao reabrir a conversa.",
        className: "border-rose-500/40 bg-rose-500/10 text-rose-500",
    },
};

/**
 * Indica a perda da conexão em tempo real (CA12.3).
 * Nada é exibido enquanto a conexão está normal.
 */
export function ConnectionStatus() {
    const { status } = useRealtime();
    const message = MESSAGES[status];

    if (!message) {
        return null;
    }

    return (
        <p
            role="status"
            aria-live="polite"
            className={`border-b px-4 py-2 text-center text-sm ${message.className}`}
        >
            {message.text}
        </p>
    );
}

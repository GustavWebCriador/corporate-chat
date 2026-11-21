import { useLayoutEffect, useRef } from "react";

import { MessageItem } from "./MessageItem";

const LOAD_OLDER_THRESHOLD = 48;
const STICK_TO_BOTTOM_THRESHOLD = 120;

/**
 * Lista de mensagens com controle de rolagem (RF13):
 * - ao abrir, posiciona na mensagem mais recente (CA13.1);
 * - novas mensagens levam ao final quando o usuário já está próximo dele
 *   ou quando a mensagem é própria;
 * - ao chegar ao topo, carrega o histórico anterior (CA11.3 / CA13.2),
 *   preservando a posição de leitura.
 */
export function MessageList({
    messages,
    getAuthorName,
    hasMore,
    loadingOlder,
    onLoadOlder,
    onRetry,
}) {
    const containerRef = useRef(null);
    const previousRef = useRef({
        firstKey: null,
        lastKey: null,
        scrollHeight: 0,
        nearBottom: true,
    });

    useLayoutEffect(() => {
        const container = containerRef.current;

        if (!container) return;

        const previous = previousRef.current;
        const firstKey = messages[0]?.key ?? null;
        const last = messages[messages.length - 1];
        const lastKey = last?.key ?? null;

        if (previous.lastKey === null) {
            // Primeira renderização com mensagens: vai ao final.
            container.scrollTop = container.scrollHeight;
        } else if (firstKey !== previous.firstKey && lastKey === previous.lastKey) {
            // Histórico anterior foi inserido acima: mantém a posição.
            container.scrollTop +=
                container.scrollHeight - previous.scrollHeight;
        } else if (
            lastKey !== previous.lastKey &&
            (previous.nearBottom || last?.isOwn)
        ) {
            container.scrollTop = container.scrollHeight;
        }

        previousRef.current = {
            firstKey,
            lastKey,
            scrollHeight: container.scrollHeight,
            nearBottom: true,
        };

        previousRef.current.nearBottom =
            container.scrollHeight -
                container.scrollTop -
                container.clientHeight <
            STICK_TO_BOTTOM_THRESHOLD;
    }, [messages]);

    function handleScroll(event) {
        const container = event.currentTarget;

        previousRef.current.nearBottom =
            container.scrollHeight -
                container.scrollTop -
                container.clientHeight <
            STICK_TO_BOTTOM_THRESHOLD;

        previousRef.current.scrollHeight = container.scrollHeight;

        if (
            container.scrollTop <= LOAD_OLDER_THRESHOLD &&
            hasMore &&
            !loadingOlder
        ) {
            onLoadOlder?.();
        }
    }

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            data-testid="message-list"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
            {hasMore && (
                <div className="mb-4 flex justify-center">
                    <button
                        type="button"
                        onClick={() => onLoadOlder?.()}
                        disabled={loadingOlder}
                        className="rounded-lg border border-slate-400/20 px-3 py-1 text-xs text-slate-300 hover:bg-navy-800 disabled:opacity-50"
                    >
                        {loadingOlder
                            ? "Carregando mensagens anteriores..."
                            : "Carregar mensagens anteriores"}
                    </button>
                </div>
            )}

            {messages.length === 0 ? (
                <p
                    role="status"
                    className="py-10 text-center text-sm text-slate-400"
                >
                    Nenhuma mensagem ainda. Envie a primeira!
                </p>
            ) : (
                <ol
                    aria-label="Mensagens"
                    aria-live="polite"
                    className="space-y-4"
                >
                    {messages.map((message) => (
                        <MessageItem
                            key={message.key}
                            message={message}
                            authorName={getAuthorName(message.senderId)}
                            onRetry={onRetry}
                        />
                    ))}
                </ol>
            )}
        </div>
    );
}

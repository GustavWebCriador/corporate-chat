import { useRef, useState } from "react";

const MAX_MESSAGE_LENGTH = 1000;

export function MessageComposer({
    onSend,
    createClientMessageId = () => crypto.randomUUID(),
}) {
    const [content, setContent] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [hasPendingRetry, setHasPendingRetry] = useState(false);
    const [error, setError] = useState("");

    const pendingPayloadRef = useRef(null);
    const inFlightRef = useRef(false);

    const normalizedContent = content.trim();

    const canSend =
        typeof onSend === "function" &&
        !isSending &&
        normalizedContent.length > 0 &&
        normalizedContent.length <= MAX_MESSAGE_LENGTH;

    function handleContentChange(event) {
        const nextContent = event.target.value;

        // Alterar o conteúdo após uma falha representa
        // uma nova mensagem, com outro clientMessageId.
        if (
            pendingPayloadRef.current &&
            pendingPayloadRef.current.content !== nextContent.trim()
        ) {
            pendingPayloadRef.current = null;
            setHasPendingRetry(false);
        }

        setContent(nextContent);
        setError("");
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (!canSend || inFlightRef.current) {
            return;
        }

        // O mesmo payload é reutilizado após uma falha
        // para preservar a idempotência do envio.
        const payload = pendingPayloadRef.current ?? {
            clientMessageId: createClientMessageId(),
            content: normalizedContent,
        };

        pendingPayloadRef.current = payload;
        inFlightRef.current = true;

        setIsSending(true);
        setError("");

        try {
            await onSend(payload);

            pendingPayloadRef.current = null;

            setHasPendingRetry(false);
            setContent("");
        } catch (err) {
            // A requisição pode ter sido persistida pelo
            // backend mesmo sem confirmação ao cliente.
            setHasPendingRetry(true);

            setError(
                err?.status === 401
                    ? "Sua sessão não é mais válida. Entre novamente."
                    : "Não foi possível enviar a mensagem. Tente novamente."
            );
        } finally {
            inFlightRef.current = false;
            setIsSending(false);
        }
    }

    return (
        <form
            aria-label="Enviar mensagem"
            onSubmit={handleSubmit}
            className="mvp-message-composer"
        >
            <div className="mvp-composer-toolbar" aria-hidden="true">
                <span>Mensagem</span>
                <span className="mvp-composer-toolbar-hint">Enter para enviar · Shift+Enter para nova linha</span>
            </div>
            <label
                htmlFor="message-content"
                className="sr-only"
            >
                Mensagem
            </label>

            <textarea
                id="message-content"
                value={content}
                onChange={handleContentChange}
                disabled={isSending}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={3}
                placeholder="Digite sua mensagem..."
                className="mvp-message-input"
            />

            {error && (
                <p
                    role="alert"
                    className="text-sm text-rose-500"
                >
                    {error}
                </p>
            )}

            <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                    {content.length}/{MAX_MESSAGE_LENGTH}
                </span>

                <button
                    type="submit"
                    disabled={!canSend}
                    className="mvp-message-send"
                >
                    {isSending
                        ? "Enviando..."
                        : hasPendingRetry
                            ? "Tentar novamente"
                            : "Enviar"}
                </button>
            </div>
        </form>
    );
}
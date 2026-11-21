import { useState } from "react";

import { MESSAGE_MAX_LENGTH } from "../utils/messages";

/**
 * Campo de envio de mensagens de texto.
 *
 * - CA07.1/CA07.2: até 1.000 caracteres (o campo não aceita mais que isso);
 * - CA07.3: mensagens vazias ou só com espaços não são enviadas;
 * - Enter envia; Shift+Enter quebra a linha.
 */
export function MessageComposer({ onSend, disabled = false }) {
    const [text, setText] = useState("");

    const content = text.trim();
    const canSend = !disabled && content.length > 0 &&
        content.length <= MESSAGE_MAX_LENGTH;

    function submit() {
        if (!canSend) return;

        onSend(content);
        setText("");
    }

    function handleSubmit(event) {
        event.preventDefault();
        submit();
    }

    function handleKeyDown(event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex items-end gap-3 border-t border-slate-400/10 px-4 py-3"
        >
            <div className="min-w-0 flex-1">
                <label htmlFor="message-input" className="sr-only">
                    Mensagem
                </label>

                <textarea
                    id="message-input"
                    rows={2}
                    value={text}
                    maxLength={MESSAGE_MAX_LENGTH}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    placeholder="Digite uma mensagem"
                    aria-describedby="message-counter"
                    className="block w-full resize-none rounded-lg border border-slate-400/15 bg-navy-800 px-3 py-2 text-sm text-slate-300 outline-none focus:border-teal-500 disabled:opacity-50"
                />

                <p
                    id="message-counter"
                    className="mt-1 text-right text-xs text-slate-400"
                >
                    {text.length}/{MESSAGE_MAX_LENGTH}
                </p>
            </div>

            <button
                type="submit"
                disabled={!canSend}
                className="mb-6 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950 transition-opacity disabled:opacity-40"
            >
                Enviar
            </button>
        </form>
    );
}

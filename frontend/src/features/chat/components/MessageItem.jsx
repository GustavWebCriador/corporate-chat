import { Avatar } from "../../../components/ui/Avatar";

import { MESSAGE_STATUS, formatMessageTimestamp } from "../utils/messages";
import { MessageStatus } from "./MessageStatus";

/**
 * Mensagem individual: autor, data/hora (CA11.4), conteúdo e,
 * nas mensagens próprias, o estado de envio (RF07 / CA08.3).
 */
export function MessageItem({ message, authorName, onRetry }) {
    const { isOwn, status } = message;
    const failed = status === MESSAGE_STATUS.FAILED;

    return (
        <li
            className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
            data-own={isOwn ? "true" : "false"}
        >
            {!isOwn && <Avatar name={authorName} size="sm" />}

            <div className={`flex min-w-0 max-w-[80%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
                <div className="flex flex-wrap items-baseline gap-2 text-xs">
                    <span className="font-semibold text-slate-300">
                        {isOwn ? "Você" : authorName}
                    </span>

                    <time
                        dateTime={message.createdAt}
                        className="text-slate-400"
                    >
                        {formatMessageTimestamp(message.createdAt)}
                    </time>
                </div>

                <p
                    className={`mt-1 whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                        isOwn
                            ? "bg-teal-500/15 text-slate-300"
                            : "bg-navy-800 text-slate-300"
                    } ${failed ? "border border-rose-500/60" : ""}`}
                >
                    {message.content}
                </p>

                {isOwn && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <MessageStatus status={status} />

                        {failed && (
                            <>
                                {message.error && (
                                    <span className="text-xs text-slate-400">
                                        {message.error}
                                    </span>
                                )}

                                <button
                                    type="button"
                                    onClick={() => onRetry?.(message.clientMessageId)}
                                    className="text-xs font-semibold text-teal-300 underline-offset-2 hover:underline"
                                >
                                    Tentar novamente
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </li>
    );
}

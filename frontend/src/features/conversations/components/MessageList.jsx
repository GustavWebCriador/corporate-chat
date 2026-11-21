
import { getMessageStatus } from "../utils/messageStatus";
import { MessageStatusIndicator } from "./MessageStatusIndicator";

export function MessageList({
    messages = [],
    currentUserId,
    recipientUserId,
    checkpoints = {},
}) {
    if (messages.length === 0) {
        return (
            <p
                role="status"
                className="p-6 text-center text-sm text-slate-400"
            >
                Nenhuma mensagem nesta conversa.
            </p>
        );
    }

    return (
        <ol
            aria-label="Histórico de mensagens"
            className="m-0 flex list-none flex-col gap-3 p-4"
        >
            {messages.map((message) => {
                const isOwnMessage =
                    message.sender_id === currentUserId;

                // Calcula o estado com base na
                // confirmação do destinatário.
                const messageStatus = isOwnMessage
                    ? getMessageStatus({
                        message,
                        messages,
                        currentUserId,
                        recipientUserId,
                        checkpoints,
                    })
                    : null;

                return (
                    <li
                        key={message._id}
                        className={`flex ${
                            isOwnMessage
                                ? "justify-end"
                                : "justify-start"
                        }`}
                    >
                        <article
                            aria-label={
                                isOwnMessage
                                    ? "Mensagem enviada por você"
                                    : "Mensagem recebida"
                            }
                            className={`max-w-[85%] rounded-xl px-4 py-3 text-sm break-words whitespace-pre-wrap sm:max-w-[75%] ${
                                isOwnMessage
                                    ? "bg-teal-500 text-navy-950"
                                    : "bg-navy-800 text-slate-300"
                            }`}
                        >
                            <p>{message.content}</p>

                            {messageStatus && (
                                <div className="mt-2 flex justify-end">
                                    <MessageStatusIndicator
                                        status={messageStatus}
                                    />
                                </div>
                            )}
                        </article>
                    </li>
                );
            })}
        </ol>
    );
}

import { getMessageStatus } from "../utils/messageStatus";
import { MessageStatusIndicator } from "./MessageStatusIndicator";
import { MvpAvatar } from "../../../components/ui/MvpAvatar";

function timeLabel(value) {
    if (!value || Number.isNaN(Date.parse(value))) return "";
    return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit", minute: "2-digit",
    }).format(new Date(value));
}

export function MessageList({
    messages = [], currentUserId, recipientUserId,
    checkpoints = {}, userNames = {}, currentUserName = "Você",
}) {
    if (messages.length === 0) {
        return <p role="status" className="mvp-message-empty">Nenhuma mensagem nesta conversa.</p>;
    }

    return (
        <ol aria-label="Histórico de mensagens" className="mvp-messages-list chat-scroll">
            {messages.map((message) => {
                const isOwnMessage = message.sender_id === currentUserId;
                const authorName = isOwnMessage
                    ? currentUserName
                    : userNames[message.sender_id] || "Participante";
                const messageStatus = isOwnMessage
                    ? getMessageStatus({ message, messages, currentUserId, recipientUserId, checkpoints })
                    : null;
                return (
                    <li key={message._id} className="mvp-message-row">
                        <MvpAvatar name={authorName} size={28} />
                        <article
                            aria-label={isOwnMessage ? "Mensagem enviada por você" : "Mensagem recebida"}
                            className="mvp-message-article"
                        >
                            <div className="mvp-message-meta">
                                <strong>{authorName}</strong>
                                <time dateTime={message.created_at || undefined}>
                                    {timeLabel(message.created_at)}
                                </time>
                            </div>
                            <p className="mvp-message-body">{message.content}</p>
                            {messageStatus && (
                                <div className="mvp-message-checkpoint">
                                    <MessageStatusIndicator status={messageStatus} />
                                </div>
                            )}
                        </article>
                    </li>
                );
            })}
        </ol>
    );
}
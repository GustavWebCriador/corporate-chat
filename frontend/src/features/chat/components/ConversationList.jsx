import { Avatar } from "../../../components/ui/Avatar";

import { getConversationTitle } from "../utils/conversations";
import { formatMessageTimestamp } from "../utils/messages";

/**
 * Lista de conversas do dashboard (RF05).
 *
 * Grupos recebem ícone e etiqueta próprios, diferenciando-os
 * das conversas privadas (CA05.3 / CA09.5).
 */
export function ConversationList({
    conversations = [],
    activeId,
    onSelect,
}) {
    if (conversations.length === 0) {
        return (
            <p className="rounded-lg border border-slate-400/10 bg-navy-900 p-5 text-sm text-slate-400">
                Nenhuma conversa iniciada.
            </p>
        );
    }

    return (
        <ul className="space-y-1">
            {conversations.map((conversation) => {
                const isGroup = conversation.type === "GROUP";
                const title = getConversationTitle(conversation);
                const active = conversation.conversation_id === activeId;
                const lastMessage = conversation.last_message;

                return (
                    <li key={conversation.conversation_id}>
                        <button
                            type="button"
                            onClick={() => onSelect?.(conversation)}
                            aria-current={active ? "true" : undefined}
                            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500 ${
                                active
                                    ? "border-teal-500/40 bg-navy-800"
                                    : "border-slate-400/10 bg-navy-900 hover:bg-navy-800"
                            }`}
                        >
                            <Avatar name={title} isGroup={isGroup} />

                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                    <span className="truncate text-sm font-semibold text-slate-300">
                                        {title}
                                    </span>

                                    {isGroup && (
                                        <span className="shrink-0 rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
                                            Grupo
                                        </span>
                                    )}
                                </span>

                                <span className="mt-0.5 block truncate text-xs text-slate-400">
                                    {lastMessage?.content ?? "Sem mensagens."}
                                </span>
                            </span>

                            {conversation.last_message_at && (
                                <time
                                    dateTime={conversation.last_message_at}
                                    className="shrink-0 self-start text-[11px] text-slate-400"
                                >
                                    {formatMessageTimestamp(conversation.last_message_at)}
                                </time>
                            )}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

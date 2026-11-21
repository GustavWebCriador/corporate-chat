import { useCallback, useState } from "react";

import { Avatar } from "../../../components/ui/Avatar";
import { GroupDetailsDialog } from "../../groups/components/GroupDetailsDialog";

import { useConversationMessages } from "../hooks/useConversationMessages";
import { getConversationTitle } from "../utils/conversations";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";

/**
 * Conversa aberta: cabeçalho, histórico e envio (FE-04).
 *
 * Deve ser montado com `key={conversation_id}` para que
 * cada conversa tenha seu próprio estado.
 */
export function ChatPanel({
    conversation,
    currentUser,
    usersById,
    onBack,
    onMessageSent,
    onGroupChanged,
    onLeftGroup,
}) {
    const conversationId = conversation.conversation_id;
    const isGroup = conversation.type === "GROUP";
    const [renamedTitle, setRenamedTitle] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const title = renamedTitle ?? getConversationTitle(conversation);

    const {
        messages,
        status,
        error,
        hasMore,
        loadingOlder,
        loadOlder,
        send,
        retry,
        reload,
    } = useConversationMessages(conversationId, currentUser?.user_id, {
        isGroup,
    });

    const getAuthorName = useCallback(
        (senderId) => {
            if (senderId === currentUser?.user_id) {
                return currentUser?.name ?? "Você";
            }

            return usersById.get(senderId)?.name ?? "Usuário indisponível";
        },
        [currentUser, usersById]
    );

    async function handleSend(content) {
        const result = await send(content);

        if (result) {
            onMessageSent?.(conversationId);
        }
    }

    return (
        <section
            aria-label={`Conversa com ${title}`}
            className="flex h-[75dvh] min-h-0 flex-col rounded-lg border border-slate-400/10 bg-navy-900 md:h-full"
        >
            <header className="flex items-center gap-3 border-b border-slate-400/10 px-4 py-3">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-navy-800 lg:hidden"
                    >
                        ← Voltar
                    </button>
                )}

                <span className="hidden sm:block">
                    <Avatar name={title} isGroup={isGroup} size="lg" />
                </span>

                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-slate-300">
                        {title}
                    </h2>

                    <p className="text-xs text-slate-400">
                        {isGroup ? "Grupo" : "Conversa privada"}
                    </p>
                </div>

                {isGroup && (
                    <button
                        type="button"
                        onClick={() => setShowDetails(true)}
                        className="shrink-0 rounded-lg border border-slate-400/20 px-3 py-1.5 text-xs text-slate-300 hover:bg-navy-800"
                    >
                        Participantes
                    </button>
                )}
            </header>

            {isGroup && showDetails && (
                <GroupDetailsDialog
                    groupId={conversationId}
                    currentUser={currentUser}
                    usersById={usersById}
                    onClose={() => setShowDetails(false)}
                    onRenamed={(name) => {
                        setRenamedTitle(name);
                        onGroupChanged?.(conversationId);
                    }}
                    onMembersChanged={() => onGroupChanged?.(conversationId)}
                    onLeft={() => {
                        setShowDetails(false);
                        onLeftGroup?.(conversationId);
                    }}
                />
            )}

            {status === "loading" && (
                <p role="status" className="flex-1 p-6 text-sm text-slate-400">
                    Carregando mensagens...
                </p>
            )}

            {status === "error" && (
                <div role="alert" className="flex-1 space-y-3 p-6">
                    <p className="text-sm text-rose-500">{error}</p>

                    <button
                        type="button"
                        onClick={reload}
                        className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950"
                    >
                        Tentar novamente
                    </button>
                </div>
            )}

            {status === "ready" && (
                <>
                    <MessageList
                        messages={messages}
                        getAuthorName={getAuthorName}
                        hasMore={hasMore}
                        loadingOlder={loadingOlder}
                        onLoadOlder={loadOlder}
                        onRetry={retry}
                    />

                    <MessageComposer onSend={handleSend} />
                </>
            )}
        </section>
    );
}

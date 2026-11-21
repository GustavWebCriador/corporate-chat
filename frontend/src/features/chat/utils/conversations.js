/**
 * Título exibido para a conversa: nome do grupo ou do outro participante.
 */
export function getConversationTitle(conversation) {
    if (conversation.type === "GROUP") {
        return conversation.name || "Grupo sem nome";
    }

    return conversation.contact?.name ?? "Contato indisponível";
}

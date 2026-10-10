const Conversation =
    require("../models/mongodb/Conversation");

const ConversationMember =
    require("../models/mongodb/ConversationMember");

const {
    createPrivateConversation,
} = require("./integration/chatPersistenceService");

const {
    getMessageHistory,
} = require("./queries/messageQueryService");

function createConversationService({
    createPrivate = createPrivateConversation,
    getHistory = getMessageHistory,
} = {}) {
    async function createPrivateForUser({
        requesterId,
        otherUserId,
    }) {
        return createPrivate({
            requesterId,
            otherUserId,
        });
    }

    async function listForUser({ userId }) {
        const memberships = await ConversationMember
            .find({
                user_id: userId,
                status: "ACTIVE",
            })
            .sort({ joined_at: -1 })
            .lean();

        if (memberships.length === 0) {
            return [];
        }

        const conversations = await Conversation.find({
            _id: {
                $in: memberships.map(
                    (membership) => membership.conversation_id
                ),
            },
        }).lean();

        const conversationsById = new Map(
            conversations.map((conversation) => [
                conversation._id.toString(),
                conversation,
            ])
        );

        return memberships
            .map((membership) => {
                const conversation = conversationsById.get(
                    membership.conversation_id.toString()
                );

                if (!conversation) {
                    return null;
                }

                return {
                    ...conversation,
                    membership: {
                        role: membership.role,
                        status: membership.status,
                        joined_at: membership.joined_at,
                    },
                };
            })
            .filter(Boolean);
    }

    async function getHistoryPage({
        conversationId,
        userId,
        limit,
        before,
    }) {
        return getHistory({
            conversationId,
            userId,
            limit,
            before,
        });
    }

    return {
        createPrivateForUser,
        listForUser,
        getHistory: getHistoryPage,
    };
}

module.exports = {
    createConversationService,
};
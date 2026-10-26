const mongoose =
    require("mongoose");

const AppError =
    require(
        "../errors/AppError"
    );

const ConversationMember =
    require(
        "../models/mongodb/ConversationMember"
    );


function createRealtimeAudienceService({
    ConversationMemberModel =
        ConversationMember,
} = {}) {

    async function getActiveUserIds(
        conversationId
    ) {
        if (
            typeof conversationId !==
                "string" ||
            !mongoose.isValidObjectId(
                conversationId
            )
        ) {
            throw AppError
                .badRequest(
                    "conversationId inválido.",
                    "INVALID_CONVERSATION_ID"
                );
        }


        const memberships =
            await ConversationMemberModel
                .find({
                    conversation_id:
                        conversationId,

                    status:
                        "ACTIVE",
                })
                .select({
                    user_id:
                        1,

                    _id:
                        0,
                })
                .lean();


        return [
            ...new Set(
                memberships.map(
                    membership =>
                        membership.user_id
                )
            ),
        ];
    }


    return {
        getActiveUserIds,
    };
}


module.exports = {
    createRealtimeAudienceService,
};
const mongoose = require("mongoose");

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const conversationMemberSchema = new mongoose.Schema(
    {
        conversation_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
        },

        user_id: {
            type: String,
            required: true,

            validate: {
                validator: (value) => UUID_REGEX.test(value),
                message: "user_id deve possuir UUID válido.",
            },
        },

        role: {
            type: String,
            enum: ["CREATOR", "MEMBER"],
            required: true,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "LEFT", "REMOVED"],
            default: "ACTIVE",
            required: true,
        },

        joined_at: {
            type: Date,
            default: Date.now,
            required: true,
        },

        left_at: {
            type: Date,
            default: null,
        },

        removed_at: {
            type: Date,
            default: null,
        },

        removed_by: {
            type: String,
            default: null,

            validate: {
                validator: function (value) {
                    if (value == null) {
                        return true;
                    }

                    return UUID_REGEX.test(value);
                },

                message: "removed_by deve possuir UUID válido.",
            },
        },

        last_delivered_message_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },

        last_delivered_at: {
            type: Date,
            default: null,
        },

        last_read_message_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },

        last_read_at: {
            type: Date,
            default: null,
        },
    },

    {
        versionKey: false,
        collection: "conversation_members",
    }
);


/*
 * Um usuário só pode possuir um vínculo
 * por conversa.
 */
conversationMemberSchema.index(
    {
        conversation_id: 1,
        user_id: 1,
    },
    {
        unique: true,
    }
);


/*
 * Consulta eficiente das conversas
 * pertencentes a determinado usuário.
 */
conversationMemberSchema.index({
    user_id: 1,
    status: 1,
});


conversationMemberSchema.pre("validate", function () {

    if (this.status === "LEFT" && !this.left_at) {
        throw new Error(
            "Membro com status LEFT deve possuir left_at."
        );
    }

    if (
        this.status === "REMOVED" &&
        (!this.removed_at || !this.removed_by)
    ) {
        throw new Error(
            "Membro REMOVED deve possuir removed_at e removed_by."
        );
    }
});


const ConversationMember = mongoose.model(
    "ConversationMember",
    conversationMemberSchema
);

module.exports = ConversationMember;
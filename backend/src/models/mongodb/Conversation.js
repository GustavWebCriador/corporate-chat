const mongoose = require("mongoose");

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const conversationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["PRIVATE", "GROUP"],
            required: true,
        },

        name: {
            type: String,
            trim: true,
            maxlength: 30, // RF09 - O nome deverá possuir no máximo 30 caracteres.

            validate: {
                validator: function (value) {
                    if (this.type === "GROUP") {
                        return Boolean(value && value.trim());
                    }

                    return value == null || value === "";
                },

                message:
                    "name é obrigatório para GROUP e não deve ser utilizado em PRIVATE.",
            },
        },

        private_key: {
            type: String,
            trim: true,
            default: undefined,

            validate: {
                validator: function (value) {
                    if (this.type === "PRIVATE") {
                        return Boolean(value && value.trim());
                    }

                    return value == null || value === "";
                },

                message:
                    "private_key é obrigatória somente para conversas PRIVATE.",
            },
        },

        last_message_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },

        last_message_at: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: {
            createdAt: "created_at",
            updatedAt: "updated_at",
        },

        versionKey: false,
        collection: "conversations",
    }
);

conversationSchema.index(
    { private_key: 1 },
    {
        unique: true,

        partialFilterExpression: {
            type: "PRIVATE",
            private_key: { $type: "string" },
        },
    }
);

/*
 Otimiza ordenação por atividade recente.
 */
conversationSchema.index({
    last_message_at: -1,
});

const Conversation = mongoose.model(
    "Conversation",
    conversationSchema
);

module.exports = Conversation;
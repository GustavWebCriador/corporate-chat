const mongoose = require("mongoose");

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const messageSchema = new mongoose.Schema(
    {
        conversation_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
        },

        sender_id: {
            type: String,
            required: true,
            trim: true,

            validate: {
                validator: (value) => UUID_REGEX.test(value),
                message: "sender_id deve possuir UUID válido.",
            },
        },

        client_message_id: {
            type: String,
            required: true,
            trim: true,
        },

        // RF07 - Envio de Mensagens
        content: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 1000,
        },

        created_at: {
            type: Date,
            default: Date.now,
            required: true,
        },
    },
    {
        versionKey: false,
        collection: "messages",
    }
);

/*
 Impede duplicação da mesma mensagem
 em tentativas de reenvio.
 O mesmo usuário não pode possuir duas mensagens  com o mesmo client_message_id.
 */
messageSchema.index(
    {
        sender_id: 1,
        client_message_id: 1,
    },
    {
        unique: true,
    }
);

/*
 * Índice principal para carregamento
 * do histórico da conversa.
 */
messageSchema.index({
    conversation_id: 1,
    created_at: -1,
    _id: -1,
});

const Message = mongoose.model(
    "Message",
    messageSchema
);

module.exports = Message;
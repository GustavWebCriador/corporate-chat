const mongoose = require("mongoose");

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


const conversationSchema =
    new mongoose.Schema(
        {
            type: {
                type: String,
                enum: [
                    "PRIVATE",
                    "GROUP",
                ],
                required: true,
            },


            /*
             * GROUP:
             * nome obrigatório.
             *
             * PRIVATE:
             * não deve possuir nome.
             */
            name: {
                type: String,
                trim: true,
                maxlength: 30,

                required: function () {
                    return (
                        this.type ===
                        "GROUP"
                    );
                },

                validate: {
                    validator:
                        function (value) {

                            if (
                                this.type ===
                                "PRIVATE"
                            ) {
                                return (
                                    value == null ||
                                    value === ""
                                );
                            }

                            return true;
                        },

                    message:
                        "name deve existir somente em GROUP.",
                },
            },


            /*
             * UUID PostgreSQL.
             *
             * É uma referência lógica para:
             * users.user_id
             */
            created_by: {
                type: String,
                required: true,
                trim: true,

                validate: {
                    validator:
                        (value) =>
                            UUID_REGEX.test(
                                value
                            ),

                    message:
                        "created_by deve possuir UUID válido.",
                },
            },


            /*
             * PRIVATE:
             * chave obrigatória para evitar
             * conversa duplicada.
             *
             * GROUP:
             * não utiliza private_key.
             */
            private_key: {
                type: String,
                trim: true,
                default: undefined,

                required: function () {
                    return (
                        this.type ===
                        "PRIVATE"
                    );
                },

                validate: {
                    validator:
                        function (value) {

                            if (
                                this.type ===
                                "GROUP"
                            ) {
                                return (
                                    value == null ||
                                    value === ""
                                );
                            }

                            return true;
                        },

                    message:
                        "private_key deve existir somente em PRIVATE.",
                },
            },


            last_message_id: {
                type:
                    mongoose.Schema.Types
                        .ObjectId,

                ref:
                    "Message",

                default:
                    null,
            },


            last_message_at: {
                type: Date,
                default: null,
            },
        },


        {
            timestamps: {
                createdAt:
                    "created_at",

                updatedAt:
                    "updated_at",
            },

            versionKey:
                false,

            collection:
                "conversations",
        }
    );


/*
 * Impede duas conversas privadas
 * para o mesmo par de usuários.
 */
conversationSchema.index(
    {
        private_key: 1,
    },

    {
        unique: true,

        partialFilterExpression: {
            type:
                "PRIVATE",

            private_key: {
                $type:
                    "string",
            },
        },
    }
);


/*
 * Ordenação das conversas
 * por atividade recente.
 */
conversationSchema.index({
    last_message_at: -1,
});


const Conversation =
    mongoose.model(
        "Conversation",
        conversationSchema
    );


module.exports =
    Conversation;
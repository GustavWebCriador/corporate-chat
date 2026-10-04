require("dotenv").config();

const {
    test,
    before,
    after,
    afterEach,
} = require("node:test");

const assert =
    require("node:assert/strict");

const {
    randomUUID,
} = require("node:crypto");

const mongoose =
    require("mongoose");

const {
    connectMongoDB,
} = require(
    "../../../src/config/db/mongodb"
);

const Conversation =
    require(
        "../../../src/models/mongodb/Conversation"
    );

const ConversationMember =
    require(
        "../../../src/models/mongodb/ConversationMember"
    );

const Message =
    require(
        "../../../src/models/mongodb/Message"
    );


/*
 * IDs gerados especificamente
 * para esta suíte.
 */
const testConversationIds =
    new Set();


function createObjectId() {

    const id =
        new mongoose.Types.ObjectId();

    testConversationIds.add(
        id.toString()
    );

    return id;
}


/*
 * ============================================
 * SETUP
 * ============================================
 */

before(async () => {

    await connectMongoDB();


    /*
     * Garantimos que os índices UNIQUE
     * necessários aos testes estão ativos.
     */
    await Conversation.syncIndexes();

    await ConversationMember
        .syncIndexes();

    await Message.syncIndexes();
});


/*
 * ============================================
 * CLEANUP
 * ============================================
 */

async function cleanup() {

    const ids =
        [
            ...testConversationIds,
        ]
            .map(
                id =>
                    new mongoose
                        .Types
                        .ObjectId(id)
            );


    /*
     * Apagamos SOMENTE dados da PER-07.
     *
     * Não tocamos nas fixtures da PER-06.
     */
    await Message.deleteMany({

        $or: [

            {
                conversation_id: {
                    $in:
                        ids,
                },
            },

            {
                client_message_id: {
                    $regex:
                        "^per07-",
                },
            },
        ],
    });


    await ConversationMember
        .deleteMany({

            conversation_id: {
                $in:
                    ids,
            },
        });


    await Conversation
        .deleteMany({

            _id: {
                $in:
                    ids,
            },
        });


    testConversationIds.clear();
}


afterEach(async () => {

    await cleanup();

});


after(async () => {

    await cleanup();

    await mongoose.disconnect();

});


/*
 * ============================================
 * HELPERS
 * ============================================
 */

async function expectValidationError(
    action,
    field
) {

    await assert.rejects(
        action,

        (error) => {

            assert.ok(
                error.errors?.[
                    field
                ],
                `Esperado erro no campo ${field}`
            );

            return true;
        }
    );
}


async function expectDuplicateKey(
    action
) {

    await assert.rejects(
        action,

        (error) => {

            assert.equal(
                error.code,
                11000
            );

            return true;
        }
    );
}


/*
 * ============================================
 * CONVERSATIONS
 * ============================================
 */


test(
    "MONGO: GROUP válido deve ser aceito",

    async () => {

        const conversation =
            await Conversation.create({

                _id:
                    createObjectId(),

                type:
                    "GROUP",

                name:
                    "PER07 Group",

                created_by:
                    randomUUID(),
            });


        assert.equal(
            conversation.type,
            "GROUP"
        );
    }
);


test(
    "MONGO: GROUP sem nome deve ser rejeitado",

    async () => {

        const conversation =
            new Conversation({

                _id:
                    createObjectId(),

                type:
                    "GROUP",

                created_by:
                    randomUUID(),
            });


        await expectValidationError(

            () =>
                conversation
                    .validate(),

            "name"
        );
    }
);


test(
    "MONGO: PRIVATE sem private_key deve ser rejeitado",

    async () => {

        const conversation =
            new Conversation({

                _id:
                    createObjectId(),

                type:
                    "PRIVATE",

                created_by:
                    randomUUID(),
            });


        await expectValidationError(

            () =>
                conversation
                    .validate(),

            "private_key"
        );
    }
);


test(
    "MONGO: PRIVATE não pode possuir name",

    async () => {

        const conversation =
            new Conversation({

                _id:
                    createObjectId(),

                type:
                    "PRIVATE",

                name:
                    "Nome inválido",

                created_by:
                    randomUUID(),

                private_key:
                    `per07-${randomUUID()}`,
            });


        await expectValidationError(

            () =>
                conversation
                    .validate(),

            "name"
        );
    }
);


test(
    "MONGO: created_by inválido deve ser rejeitado",

    async () => {

        const conversation =
            new Conversation({

                _id:
                    createObjectId(),

                type:
                    "GROUP",

                name:
                    "PER07 Group",

                created_by:
                    "uuid-invalido",
            });


        await expectValidationError(

            () =>
                conversation
                    .validate(),

            "created_by"
        );
    }
);


test(
    "MONGO: private_key duplicada deve ser rejeitada",

    async () => {

        const privateKey =
            `per07-${randomUUID()}`;


        await Conversation.create({

            _id:
                createObjectId(),

            type:
                "PRIVATE",

            created_by:
                randomUUID(),

            private_key:
                privateKey,
        });


        await expectDuplicateKey(

            () =>
                Conversation.create({

                    _id:
                        createObjectId(),

                    type:
                        "PRIVATE",

                    created_by:
                        randomUUID(),

                    private_key:
                        privateKey,
                })
        );
    }
);


/*
 * ============================================
 * CONVERSATION MEMBERS
 * ============================================
 */


test(
    "MONGO: membro ACTIVE válido deve ser aceito",

    async () => {

        const member =
            await ConversationMember.create({

                conversation_id:
                    createObjectId(),

                user_id:
                    randomUUID(),

                role:
                    "MEMBER",

                status:
                    "ACTIVE",
            });


        assert.equal(
            member.status,
            "ACTIVE"
        );
    }
);


test(
    "MONGO: mesmo usuário não pode aparecer duas vezes na mesma conversa",

    async () => {

        const conversationId =
            createObjectId();

        const userId =
            randomUUID();


        await ConversationMember.create({

            conversation_id:
                conversationId,

            user_id:
                userId,

            role:
                "MEMBER",

            status:
                "ACTIVE",
        });


        await expectDuplicateKey(

            () =>
                ConversationMember
                    .create({

                        conversation_id:
                            conversationId,

                        user_id:
                            userId,

                        role:
                            "MEMBER",

                        status:
                            "ACTIVE",
                    })
        );
    }
);


test(
    "MONGO: LEFT sem left_at deve ser rejeitado",

    async () => {

        const member =
            new ConversationMember({

                conversation_id:
                    createObjectId(),

                user_id:
                    randomUUID(),

                role:
                    "MEMBER",

                status:
                    "LEFT",
            });


        await assert.rejects(

            () =>
                member.validate(),

            /left_at/i
        );
    }
);


test(
    "MONGO: REMOVED sem removed_at e removed_by deve ser rejeitado",

    async () => {

        const member =
            new ConversationMember({

                conversation_id:
                    createObjectId(),

                user_id:
                    randomUUID(),

                role:
                    "MEMBER",

                status:
                    "REMOVED",
            });


        await assert.rejects(

            () =>
                member.validate(),

            /removed_at|removed_by/i
        );
    }
);


test(
    "MONGO: user_id inválido deve ser rejeitado",

    async () => {

        const member =
            new ConversationMember({

                conversation_id:
                    createObjectId(),

                user_id:
                    "usuario-invalido",

                role:
                    "MEMBER",

                status:
                    "ACTIVE",
            });


        await expectValidationError(

            () =>
                member.validate(),

            "user_id"
        );
    }
);


/*
 * ============================================
 * MESSAGES
 * ============================================
 */


test(
    "MONGO: mensagem válida deve ser aceita",

    async () => {

        const message =
            await Message.create({

                conversation_id:
                    createObjectId(),

                sender_id:
                    randomUUID(),

                client_message_id:
                    `per07-${randomUUID()}`,

                content:
                    "Mensagem válida PER-07",
            });


        assert.equal(
            message.content,
            "Mensagem válida PER-07"
        );
    }
);


test(
    "MONGO: mensagem vazia deve ser rejeitada",

    async () => {

        const message =
            new Message({

                conversation_id:
                    createObjectId(),

                sender_id:
                    randomUUID(),

                client_message_id:
                    `per07-${randomUUID()}`,

                content:
                    "",
            });


        await expectValidationError(

            () =>
                message.validate(),

            "content"
        );
    }
);


test(
    "MONGO: mensagem acima de 1000 caracteres deve ser rejeitada",

    async () => {

        const message =
            new Message({

                conversation_id:
                    createObjectId(),

                sender_id:
                    randomUUID(),

                client_message_id:
                    `per07-${randomUUID()}`,

                content:
                    "A".repeat(1001),
            });


        await expectValidationError(

            () =>
                message.validate(),

            "content"
        );
    }
);


test(
    "MONGO: sender_id inválido deve ser rejeitado",

    async () => {

        const message =
            new Message({

                conversation_id:
                    createObjectId(),

                sender_id:
                    "uuid-invalido",

                client_message_id:
                    `per07-${randomUUID()}`,

                content:
                    "Mensagem",
            });


        await expectValidationError(

            () =>
                message.validate(),

            "sender_id"
        );
    }
);


test(
    "MONGO: mesma mensagem do mesmo remetente não pode ser duplicada",

    async () => {

        const conversationId =
            createObjectId();

        const senderId =
            randomUUID();

        const clientMessageId =
            `per07-${randomUUID()}`;


        await Message.create({

            conversation_id:
                conversationId,

            sender_id:
                senderId,

            client_message_id:
                clientMessageId,

            content:
                "Primeira tentativa",
        });


        await expectDuplicateKey(

            () =>
                Message.create({

                    conversation_id:
                        conversationId,

                    sender_id:
                        senderId,

                    client_message_id:
                        clientMessageId,

                    content:
                        "Reenvio",
                })
        );
    }
);


test(
    "MONGO: client_message_id igual é permitido para remetentes diferentes",

    async () => {

        const conversationId =
            createObjectId();

        const clientMessageId =
            `per07-${randomUUID()}`;


        await Message.create({

            conversation_id:
                conversationId,

            sender_id:
                randomUUID(),

            client_message_id:
                clientMessageId,

            content:
                "Mensagem usuário A",
        });


        const second =
            await Message.create({

                conversation_id:
                    conversationId,

                sender_id:
                    randomUUID(),

                client_message_id:
                    clientMessageId,

                content:
                    "Mensagem usuário B",
            });


        assert.ok(
            second._id
        );
    }
);
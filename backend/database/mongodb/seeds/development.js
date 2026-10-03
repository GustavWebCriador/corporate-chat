require("dotenv").config();

const mongoose = require("mongoose");


// =====================================================
// CONEXÃO MONGODB
// =====================================================

const {connectMongoDB} =
    require("../../../src/config/db/mongodb");

// =====================================================
// MODELS
// =====================================================

const Conversation =
    require("../../../src/models/mongodb/Conversation");

const ConversationMember =
    require("../../../src/models/mongodb/ConversationMember");

const Message =
    require("../../../src/models/mongodb/Message");


// =====================================================
// FIXTURES COMPARTILHADAS
// =====================================================

const {
    users,
    mongoIds,
    clientMessageIds,
    generatePrivateKey,
} = require("../../../scripts/shared/dev-fixtures");

// =====================================================
// FUNÇÃO AUXILIAR DE UPSERT
//
// Se não existe → cria
// Se já existe → atualiza
//
// Isso evita duplicação quando o seed é executado
// mais de uma vez.
// =====================================================

async function upsertDocument(
    Model,
    filter,
    data
) {
    let document =
        await Model.findOne(filter);

    if (!document) {
        document =
            new Model(data);
    } else {
        const {
            _id,
            ...updateData
        } = data;

        document.set(
            updateData
        );
    }

    await document.save();

    return document;
}


// =====================================================
// SEED PRINCIPAL
// =====================================================

async function seed() {

    try {

        // =================================================
        // PROTEÇÃO
        // =================================================

        if (
            process.env.NODE_ENV !==
            "development"
        ) {
            throw new Error(
                "MongoDB development seed cannot run outside development."
            );
        }


        console.log("");
        console.log(
            "============================================"
        );
        console.log(
            " Corporate Chat - MongoDB Development Seed"
        );
        console.log(
            "============================================"
        );


        // =================================================
        // CONECTA NO MONGODB
        // =================================================

        await connectMongoDB();

        console.log(
            "[SEED] MongoDB connected."
        );


        // =================================================
        // PASSO 14
        // CRIAR OBJECT IDS FIXOS
        // =================================================

        const privateConversationId =
            new mongoose.Types.ObjectId(
                mongoIds.conversations.private
            );

        const groupConversationId =
            new mongoose.Types.ObjectId(
                mongoIds.conversations.group
            );


        const privateMessage1Id =
            new mongoose.Types.ObjectId(
                mongoIds.messages.private1
            );

        const privateMessage2Id =
            new mongoose.Types.ObjectId(
                mongoIds.messages.private2
            );


        const groupMessage1Id =
            new mongoose.Types.ObjectId(
                mongoIds.messages.group1
            );

        const groupMessage2Id =
            new mongoose.Types.ObjectId(
                mongoIds.messages.group2
            );

        const groupMessage3Id =
            new mongoose.Types.ObjectId(
                mongoIds.messages.group3
            );


        console.log(
            "[SEED] MongoDB fixed IDs loaded."
        );


        // =================================================
        // PASSO 15
        // CONVERSA PRIVADA
        // Gustavo ↔ Eduardo
        // =================================================

        const privateConversation =
            await upsertDocument(
                Conversation,

                {
                    _id:
                        privateConversationId,
                },

                {
                    _id:
                        privateConversationId,

                    type:
                        "PRIVATE",

                    name:
                        null,

                    created_by:
                        users.gustavo.user_id,

                    private_key:
                        generatePrivateKey(
                            users.gustavo.user_id,
                            users.eduardo.user_id
                        ),
                }
            );


        console.log(
            "[SEED] Private conversation: OK"
        );


        // =================================================
        // PASSO 16
        // PARTICIPANTES DA CONVERSA PRIVADA
        // =================================================

        const privateGustavo =
            await upsertDocument(
                ConversationMember,

                {
                    conversation_id:
                        privateConversationId,

                    user_id:
                        users.gustavo.user_id,
                },

                {
                    conversation_id:
                        privateConversationId,

                    user_id:
                        users.gustavo.user_id,

                    role:
                        "CREATOR",

                    status:
                        "ACTIVE",

                    joined_at:
                        new Date(
                            "2026-09-30T12:00:00.000Z"
                        ),
                }
            );


        const privateEduardo =
            await upsertDocument(
                ConversationMember,

                {
                    conversation_id:
                        privateConversationId,

                    user_id:
                        users.eduardo.user_id,
                },

                {
                    conversation_id:
                        privateConversationId,

                    user_id:
                        users.eduardo.user_id,

                    role:
                        "MEMBER",

                    status:
                        "ACTIVE",

                    joined_at:
                        new Date(
                            "2026-09-30T12:00:00.000Z"
                        ),
                }
            );


        console.log(
            "[SEED] Private conversation members: OK"
        );


        // =================================================
        // PASSO 17
        // MENSAGENS PRIVADAS
        // =================================================

        const privateMessage1 =
            await upsertDocument(
                Message,

                {
                    _id:
                        privateMessage1Id,
                },

                {
                    _id:
                        privateMessage1Id,

                    conversation_id:
                        privateConversationId,

                    sender_id:
                        users.gustavo.user_id,

                    client_message_id:
                        clientMessageIds.private1,

                    content:
                        "Olá Eduardo! Ambiente de desenvolvimento funcionando.",

                    created_at:
                        new Date(
                            "2026-09-30T12:01:00.000Z"
                        ),
                }
            );


        const privateMessage2 =
            await upsertDocument(
                Message,

                {
                    _id:
                        privateMessage2Id,
                },

                {
                    _id:
                        privateMessage2Id,

                    conversation_id:
                        privateConversationId,

                    sender_id:
                        users.eduardo.user_id,

                    client_message_id:
                        clientMessageIds.private2,

                    content:
                        "MongoDB integrado ao PostgreSQL com UUID.",

                    created_at:
                        new Date(
                            "2026-09-30T12:02:00.000Z"
                        ),
                }
            );


        console.log(
            "[SEED] Private messages: OK"
        );


        // =================================================
        // PASSO 18
        // ATUALIZAR ÚLTIMA MENSAGEM DA CONVERSA PRIVADA
        // =================================================

        privateConversation.last_message_id =
            privateMessage2._id;

        privateConversation.last_message_at =
            privateMessage2.created_at;

        await privateConversation.save();


        console.log(
            "[SEED] Private conversation last message: OK"
        );


        // =================================================
        // PASSO 19
        // SIMULAR ENTREGA E LEITURA
        // CONVERSA PRIVADA
        // =================================================

        privateGustavo.last_delivered_message_id =
            privateMessage2._id;

        privateGustavo.last_delivered_at =
            privateMessage2.created_at;

        privateGustavo.last_read_message_id =
            privateMessage2._id;

        privateGustavo.last_read_at =
            privateMessage2.created_at;

        await privateGustavo.save();


        privateEduardo.last_delivered_message_id =
            privateMessage2._id;

        privateEduardo.last_delivered_at =
            privateMessage2.created_at;

        privateEduardo.last_read_message_id =
            privateMessage2._id;

        privateEduardo.last_read_at =
            privateMessage2.created_at;

        await privateEduardo.save();


        console.log(
            "[SEED] Private delivery/read state: OK"
        );


        // =================================================
        // PASSO 20
        // CRIAR GRUPO
        // =================================================

        const group =
            await upsertDocument(
                Conversation,

                {
                    _id:
                        groupConversationId,
                },

                {
                    _id:
                        groupConversationId,

                    type:
                        "GROUP",

                    name:
                        "Equipe Corporate Chat",

                    created_by:
                        users.gustavo.user_id,

                    private_key:
                        null,
                }
            );


        console.log(
            "[SEED] Group conversation: OK"
        );


        // =================================================
        // PASSO 21
        // PARTICIPANTES DO GRUPO
        // =================================================

        const groupUsers = [
            {
                user:
                    users.gustavo,

                role:
                    "CREATOR",
            },

            {
                user:
                    users.eduardo,

                role:
                    "MEMBER",
            },

            {
                user:
                    users.alexandre,

                role:
                    "MEMBER",
            },

            {
                user:
                    users.mauricio,

                role:
                    "MEMBER",
            },
        ];


        const groupMembers = {};


        for (
            const item of groupUsers
        ) {

            const member =
                await upsertDocument(
                    ConversationMember,

                    {
                        conversation_id:
                            groupConversationId,

                        user_id:
                            item.user.user_id,
                    },

                    {
                        conversation_id:
                            groupConversationId,

                        user_id:
                            item.user.user_id,

                        role:
                            item.role,

                        status:
                            "ACTIVE",

                        joined_at:
                            new Date(
                                "2026-09-30T13:00:00.000Z"
                            ),
                    }
                );


            groupMembers[
                item.user.user_id
            ] = member;
        }


        console.log(
            "[SEED] Group members: OK"
        );


        // =================================================
        // PASSO 22
        // MENSAGENS DO GRUPO
        // =================================================

        const groupMessage1 =
            await upsertDocument(
                Message,

                {
                    _id:
                        groupMessage1Id,
                },

                {
                    _id:
                        groupMessage1Id,

                    conversation_id:
                        groupConversationId,

                    sender_id:
                        users.gustavo.user_id,

                    client_message_id:
                        clientMessageIds.group1,

                    content:
                        "Equipe, iniciamos os testes do Corporate Chat.",

                    created_at:
                        new Date(
                            "2026-09-30T13:01:00.000Z"
                        ),
                }
            );


        const groupMessage2 =
            await upsertDocument(
                Message,

                {
                    _id:
                        groupMessage2Id,
                },

                {
                    _id:
                        groupMessage2Id,

                    conversation_id:
                        groupConversationId,

                    sender_id:
                        users.alexandre.user_id,

                    client_message_id:
                        clientMessageIds.group2,

                    content:
                        "Persistência PostgreSQL e MongoDB pronta.",

                    created_at:
                        new Date(
                            "2026-09-30T13:02:00.000Z"
                        ),
                }
            );


        const groupMessage3 =
            await upsertDocument(
                Message,

                {
                    _id:
                        groupMessage3Id,
                },

                {
                    _id:
                        groupMessage3Id,

                    conversation_id:
                        groupConversationId,

                    sender_id:
                        users.mauricio.user_id,

                    client_message_id:
                        clientMessageIds.group3,

                    content:
                        "Testando controle de leitura do grupo.",

                    created_at:
                        new Date(
                            "2026-09-30T13:03:00.000Z"
                        ),
                }
            );


        console.log(
            "[SEED] Group messages: OK"
        );


        // =================================================
        // PASSO 23
        // ÚLTIMA MENSAGEM DO GRUPO
        // =================================================

        group.last_message_id =
            groupMessage3._id;

        group.last_message_at =
            groupMessage3.created_at;

        await group.save();


        console.log(
            "[SEED] Group last message: OK"
        );


        // =================================================
        // PASSO 24
        // ESTADOS DIFERENTES DE ENTREGA / LEITURA
        // =================================================


        // -------------------------------------------------
        // GUSTAVO
        // Entregue até mensagem 3
        // Leu até mensagem 3
        // -------------------------------------------------

        const gustavoMember =
            groupMembers[
                users.gustavo.user_id
            ];


        gustavoMember.last_delivered_message_id =
            groupMessage3._id;

        gustavoMember.last_delivered_at =
            groupMessage3.created_at;

        gustavoMember.last_read_message_id =
            groupMessage3._id;

        gustavoMember.last_read_at =
            groupMessage3.created_at;

        await gustavoMember.save();


        // -------------------------------------------------
        // EDUARDO
        // Entregue até mensagem 3
        // Leu somente até mensagem 2
        // -------------------------------------------------

        const eduardoMember =
            groupMembers[
                users.eduardo.user_id
            ];


        eduardoMember.last_delivered_message_id =
            groupMessage3._id;

        eduardoMember.last_delivered_at =
            groupMessage3.created_at;

        eduardoMember.last_read_message_id =
            groupMessage2._id;

        eduardoMember.last_read_at =
            groupMessage2.created_at;

        await eduardoMember.save();


        // -------------------------------------------------
        // ALEXANDRE
        // Entregue até mensagem 3
        // Leu somente mensagem 1
        // -------------------------------------------------

        const alexandreMember =
            groupMembers[
                users.alexandre.user_id
            ];


        alexandreMember.last_delivered_message_id =
            groupMessage3._id;

        alexandreMember.last_delivered_at =
            groupMessage3.created_at;

        alexandreMember.last_read_message_id =
            groupMessage1._id;

        alexandreMember.last_read_at =
            groupMessage1.created_at;

        await alexandreMember.save();


        // -------------------------------------------------
        // MAURICIO
        // Entregue até mensagem 3
        // Leu até mensagem 3
        // -------------------------------------------------

        const mauricioMember =
            groupMembers[
                users.mauricio.user_id
            ];


        mauricioMember.last_delivered_message_id =
            groupMessage3._id;

        mauricioMember.last_delivered_at =
            groupMessage3.created_at;

        mauricioMember.last_read_message_id =
            groupMessage3._id;

        mauricioMember.last_read_at =
            groupMessage3.created_at;

        await mauricioMember.save();


        console.log(
            "[SEED] Group delivery/read state: OK"
        );


        // =================================================
        // RESULTADO FINAL
        // =================================================

        console.log("");
        console.log(
            "============================================"
        );

        console.log(
            " MongoDB development seed completed"
        );

        console.log(
            "============================================"
        );

        console.log("");

        console.log(
            "Private conversation:",
            privateConversation._id.toString()
        );

        console.log(
            "Group conversation:",
            group._id.toString()
        );

        console.log("");

        console.log(
            "Private messages: 2"
        );

        console.log(
            "Group messages: 3"
        );

        console.log(
            "Total messages: 5"
        );

        console.log("");

        console.log(
            "MongoDB development seed: OK"
        );

    } catch (error) {

        console.error("");
        console.error(
            "============================================"
        );

        console.error(
            " MongoDB development seed: FAILED"
        );

        console.error(
            "============================================"
        );

        console.error("");

        console.error(error);

        process.exitCode = 1;

    } finally {

        await mongoose.disconnect();

        console.log("");
        console.log(
            "[MONGODB] Connection closed."
        );
    }
}


seed();
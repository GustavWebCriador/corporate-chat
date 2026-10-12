require("dotenv").config();


const {
    test,
    before,
    after,
    afterEach,
} = require(
    "node:test"
);


const assert =
    require(
        "node:assert/strict"
    );


const {
    randomUUID,
} = require(
    "node:crypto"
);


const mongoose =
    require(
        "mongoose"
    );


const {
    sequelize,
    User,
} = require(
    "../../../src/models/postgres"
);


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


const {
    createUserRepository,
} = require(
    "../../../src/repositories/postgres/userRepository"
);


const {
    createDashboardService,
} = require(
    "../../../src/services/dashboard/dashboardService"
);


const {
    createPrivateConversation,
    createGroupConversation,
    createMessage,
} = require(
    "../../../src/services/integration/chatPersistenceService"
);


/*
 * =====================================================
 * DADOS TEMPORÁRIOS
 * =====================================================
 *
 * Estes Sets permitem remover somente os registros
 * criados pela BE-06.
 *
 * Não alteramos a massa DEV existente.
 * =====================================================
 */

const testUserIds =
    new Set();


const testConversationIds =
    new Set();


/*
 * =====================================================
 * HELPERS
 * =====================================================
 */

async function createTestUser({

    name =
        "BE06 Integration User",

    status =
        "ACTIVE",

    isAdmin =
        false,

} = {}) {

    const userId =
        randomUUID();


    const user =
        await User.create({

            user_id:
                userId,

            name,

            email:
                `be06-${userId.slice(0, 8)}@test.local`,

            password_hash:
                "be06-integration-test-hash",

            status,

            is_admin:
                isAdmin,
        });


    testUserIds.add(
        user.user_id
    );


    return user.get({
        plain: true,
    });
}


function rememberConversation(
    conversation
) {

    testConversationIds.add(
        conversation
            ._id
            .toString()
    );


    return conversation;
}


/*
 * =====================================================
 * SETUP
 * =====================================================
 */

before(
    async () => {

        await sequelize
            .authenticate();


        await connectMongoDB();


        /*
         * Os testes utilizam constraints e índices
         * reais do MongoDB.
         */
        await Conversation
            .syncIndexes();

        await ConversationMember
            .syncIndexes();

        await Message
            .syncIndexes();
    }
);


/*
 * =====================================================
 * CLEANUP
 * =====================================================
 */

async function cleanup() {

    const conversationIds =
        [
            ...testConversationIds,
        ]
            .map(
                id =>
                    new mongoose
                        .Types
                        .ObjectId(
                            id
                        )
            );


    /*
     * MongoDB precisa ser limpo
     * respeitando as referências lógicas:
     *
     * messages
     * conversation_members
     * conversations
     */
    if (
        conversationIds.length >
        0
    ) {

        await Message.deleteMany({

            conversation_id: {

                $in:
                    conversationIds,
            },
        });


        await ConversationMember
            .deleteMany({

                conversation_id: {

                    $in:
                        conversationIds,
                },
            });


        await Conversation
            .deleteMany({

                _id: {

                    $in:
                        conversationIds,
                },
            });
    }


    testConversationIds
        .clear();


    /*
     * Após remover as referências MongoDB,
     * podemos apagar os usuários PostgreSQL.
     */
    if (
        testUserIds.size >
        0
    ) {

        await User.destroy({

            where: {

                user_id: [
                    ...testUserIds,
                ],
            },
        });
    }


    testUserIds
        .clear();
}


afterEach(
    async () => {

        await cleanup();
    }
);


after(
    async () => {

        await cleanup();

        await mongoose
            .disconnect();

        await sequelize
            .close();
    }
);


/*
 * =====================================================
 * TESTE 1
 *
 * PostgreSQL real:
 * contatos ACTIVE e exclusão do próprio usuário.
 * =====================================================
 */

test(
    "BE-06 INTEGRATION: repository lista somente contatos ACTIVE e exclui o próprio usuário",

    async () => {

        const currentUser =
            await createTestUser({

                name:
                    "BE06 Usuário Atual",
            });


        const activeContactA =
            await createTestUser({

                name:
                    "BE06 Contato A",
            });


        const activeContactB =
            await createTestUser({

                name:
                    "BE06 Contato B",
            });


        const inactiveContact =
            await createTestUser({

                name:
                    "BE06 Inativo",

                status:
                    "INACTIVE",
            });


        const repository =
            createUserRepository();


        const contacts =
            await repository
                .findActiveContacts({

                    excludeUserId:
                        currentUser
                            .user_id,
                });


        const ids =
            contacts.map(
                contact =>
                    contact.user_id
            );


        /*
         * Os dois contatos ACTIVE criados
         * devem aparecer.
         */
        assert.ok(
            ids.includes(
                activeContactA.user_id
            )
        );


        assert.ok(
            ids.includes(
                activeContactB.user_id
            )
        );


        /*
         * O próprio usuário não é contato.
         */
        assert.equal(
            ids.includes(
                currentUser.user_id
            ),
            false
        );


        /*
         * Usuário INACTIVE não pode ser
         * selecionado para nova conversa.
         */
        assert.equal(
            ids.includes(
                inactiveContact.user_id
            ),
            false
        );


        /*
         * A consulta do repository retorna
         * somente campos públicos.
         */
        const contact =
            contacts.find(
                item =>
                    item.user_id ===
                    activeContactA.user_id
            );


        assert.deepEqual(
            Object.keys(
                contact
            ).sort(),
            [
                "email",
                "name",
                "status",
                "user_id",
            ]
        );


        assert.equal(
            contact.status,
            "ACTIVE"
        );
    }
);


/*
 * =====================================================
 * TESTE 2
 *
 * PostgreSQL real:
 * resolução de participantes históricos.
 * =====================================================
 */

test(
    "BE-06 INTEGRATION: repository resolve dados públicos por UUID incluindo usuário INACTIVE",

    async () => {

        const activeUser =
            await createTestUser({

                name:
                    "BE06 Active Resolve",
            });


        const inactiveUser =
            await createTestUser({

                name:
                    "BE06 Inactive Resolve",

                status:
                    "INACTIVE",
            });


        const repository =
            createUserRepository();


        const users =
            await repository
                .findPublicByIds([
                    activeUser.user_id,
                    inactiveUser.user_id,

                    /*
                     * Duplicado propositalmente.
                     * O repository deve normalizar.
                     */
                    activeUser.user_id,
                ]);


        assert.equal(
            users.length,
            2
        );


        const inactive =
            users.find(
                user =>
                    user.user_id ===
                    inactiveUser.user_id
            );


        assert.ok(
            inactive
        );


        assert.equal(
            inactive.status,
            "INACTIVE"
        );


        assert.equal(
            Object.prototype
                .hasOwnProperty
                .call(
                    inactive,
                    "password_hash"
                ),
            false
        );


        assert.equal(
            Object.prototype
                .hasOwnProperty
                .call(
                    inactive,
                    "is_admin"
                ),
            false
        );
    }
);


/*
 * =====================================================
 * TESTE 3
 *
 * PostgreSQL + MongoDB reais.
 *
 * Cria:
 *
 * usuário A
 * usuário B
 * usuário C
 *
 * A ↔ B PRIVATE
 *
 * A + B + C GROUP
 *
 * e mensagens reais.
 * =====================================================
 */

test(
    "BE-06 INTEGRATION: dashboard integra PostgreSQL e MongoDB para PRIVATE e GROUP",

    async () => {

        const userA =
            await createTestUser({

                name:
                    "BE06 User A",
            });


        const userB =
            await createTestUser({

                name:
                    "BE06 User B",
            });


        const userC =
            await createTestUser({

                name:
                    "BE06 User C",
            });


        /*
         * Usuário INACTIVE existe no PostgreSQL,
         * mas não deve aparecer em contacts.
         */
        const inactiveUser =
            await createTestUser({

                name:
                    "BE06 User Inactive",

                status:
                    "INACTIVE",
            });


        /*
         * PRIVATE
         */
        const privateConversation =
            rememberConversation(

                await createPrivateConversation({

                    requesterId:
                        userA.user_id,

                    otherUserId:
                        userB.user_id,
                })
            );


        const privateMessageResult =
            await createMessage({

                conversationId:
                    privateConversation._id,

                senderId:
                    userB.user_id,

                clientMessageId:
                    randomUUID(),

                content:
                    "Mensagem privada BE-06",
            });


        /*
         * GROUP
         */
        const groupConversation =
            rememberConversation(

                await createGroupConversation({

                    creatorId:
                        userA.user_id,

                    memberIds: [
                        userB.user_id,
                        userC.user_id,
                    ],

                    name:
                        "Grupo BE-06",
                })
            );


        const groupMessageResult =
            await createMessage({

                conversationId:
                    groupConversation._id,

                senderId:
                    userC.user_id,

                clientMessageId:
                    randomUUID(),

                content:
                    "Mensagem grupo BE-06",
            });


        /*
         * Service real.
         *
         * Sem repositories simulados.
         */
        const dashboardService =
            createDashboardService();


        const dashboard =
            await dashboardService
                .getDashboard({

                    userId:
                        userA.user_id,

                    query: {
                        limit:
                            "50",
                    },
                });


        /*
         * =============================================
         * CONTACTS
         * =============================================
         */

        const contactIds =
            dashboard
                .contacts
                .map(
                    contact =>
                        contact.user_id
                );


        assert.ok(
            contactIds.includes(
                userB.user_id
            )
        );


        assert.ok(
            contactIds.includes(
                userC.user_id
            )
        );


        assert.equal(
            contactIds.includes(
                userA.user_id
            ),
            false
        );


        assert.equal(
            contactIds.includes(
                inactiveUser.user_id
            ),
            false
        );


        /*
         * =============================================
         * PRIVATE
         * =============================================
         */

        const privateResult =
            dashboard
                .conversations
                .find(
                    conversation =>
                        conversation
                            .conversation_id ===
                        privateConversation
                            ._id
                            .toString()
                );


        assert.ok(
            privateResult
        );


        assert.equal(
            privateResult.type,
            "PRIVATE"
        );


        assert.equal(
            privateResult.name,
            null
        );


        assert.equal(
            privateResult
                .contact
                .user_id,
            userB.user_id
        );


        assert.equal(
            privateResult
                .contact
                .name,
            "BE06 User B"
        );


        assert.equal(
            privateResult
                .last_message
                .message_id,
            privateMessageResult
                .message
                ._id
                .toString()
        );


        assert.equal(
            privateResult
                .last_message
                .content,
            "Mensagem privada BE-06"
        );


        /*
         * =============================================
         * GROUP
         * =============================================
         */

        const groupResult =
            dashboard
                .conversations
                .find(
                    conversation =>
                        conversation
                            .conversation_id ===
                        groupConversation
                            ._id
                            .toString()
                );


        assert.ok(
            groupResult
        );


        assert.equal(
            groupResult.type,
            "GROUP"
        );


        assert.equal(
            groupResult.name,
            "Grupo BE-06"
        );


        assert.equal(
            groupResult.contact,
            null
        );


        assert.equal(
            groupResult
                .last_message
                .message_id,
            groupMessageResult
                .message
                ._id
                .toString()
        );


        assert.equal(
            groupResult
                .last_message
                .sender_id,
            userC.user_id
        );


        assert.equal(
            groupResult
                .last_message
                .content,
            "Mensagem grupo BE-06"
        );


        /*
         * =============================================
         * DTO SEGURO
         * =============================================
         */

        const serialized =
            JSON.stringify(
                dashboard
            );


        assert.equal(
            serialized.includes(
                "password_hash"
            ),
            false
        );


        assert.equal(
            serialized.includes(
                "private_key"
            ),
            false
        );


        assert.equal(
            serialized.includes(
                "client_message_id"
            ),
            false
        );


        assert.equal(
            serialized.includes(
                "participant_user_ids"
            ),
            false
        );
    }
);


/*
 * =====================================================
 * TESTE 4
 *
 * Usuário pode ser desativado depois da criação
 * da conversa.
 *
 * Ele não pode mais aparecer em "contacts",
 * mas a conversa histórica ainda deve identificar
 * quem é o participante.
 * =====================================================
 */

test(
    "BE-06 INTEGRATION: contato INACTIVE não fica disponível, mas permanece identificável no histórico PRIVATE",

    async () => {

        const userA =
            await createTestUser({

                name:
                    "BE06 Histórico A",
            });


        const userB =
            await createTestUser({

                name:
                    "BE06 Histórico B",
            });


        /*
         * A conversa precisa ser criada enquanto
         * ambos estão ACTIVE.
         */
        const conversation =
            rememberConversation(

                await createPrivateConversation({

                    requesterId:
                        userA.user_id,

                    otherUserId:
                        userB.user_id,
                })
            );


        /*
         * Depois da conversa existir,
         * o usuário B é desativado.
         */
        await User.update(

            {
                status:
                    "INACTIVE",
            },

            {
                where: {
                    user_id:
                        userB.user_id,
                },
            }
        );


        const dashboardService =
            createDashboardService();


        const dashboard =
            await dashboardService
                .getDashboard({

                    userId:
                        userA.user_id,

                    query: {
                        limit:
                            "50",
                    },
                });


        /*
         * Não pode aparecer nos contatos
         * disponíveis.
         */
        assert.equal(

            dashboard.contacts.some(
                contact =>
                    contact.user_id ===
                    userB.user_id
            ),

            false
        );


        /*
         * Mas a conversa histórica continua
         * identificando o participante.
         */
        const privateConversation =
            dashboard
                .conversations
                .find(
                    item =>
                        item
                            .conversation_id ===
                        conversation
                            ._id
                            .toString()
                );


        assert.ok(
            privateConversation
        );


        assert.equal(
            privateConversation.type,
            "PRIVATE"
        );


        assert.equal(
            privateConversation
                .contact
                .user_id,
            userB.user_id
        );


        assert.equal(
            privateConversation
                .contact
                .name,
            "BE06 Histórico B"
        );


        assert.equal(
            privateConversation
                .contact
                .status,
            "INACTIVE"
        );
    }
);
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

const bcrypt =
    require("bcryptjs");

const mongoose =
    require("mongoose");

const {
    sequelize,
    User,
    AuthSession,
} = require("../../../src/models/postgres");

const {
    connectMongoDB,
} = require("../../../src/config/db/mongodb");

const {
    createApp,
} = require("../../../src/app");

const {
    authService,
} = require("../../../src/services/auth/authService");

const {
    createConversationService,
} = require("../../../src/services/conversationService");

const Conversation =
    require("../../../src/models/mongodb/Conversation");

const ConversationMember =
    require("../../../src/models/mongodb/ConversationMember");

const Message =
    require("../../../src/models/mongodb/Message");

/*
 * ============================================
 * DADOS TEMPORÁRIOS
 * ============================================
 */

const testUserIds =
    new Set();

const testConversationIds =
    new Set();

const PASSWORD =
    "SenhaTeste@123";

let server;
let baseUrl;

async function createTestUser(
    {
        status = "ACTIVE",
    } = {}
) {
    const id =
        randomUUID();

    const password_hash =
        await bcrypt.hash(
            PASSWORD,
            10
        );

    const user =
        await User.create({

            user_id:
                id,

            name:
                "BE07 Integration",

            email:
                `be07-${id.slice(0, 8)}@test.local`,

            password_hash,

            status,

            is_admin:
                false,
        });

    testUserIds.add(
        user.user_id
    );

    return user;
}

/*
 * Login real: valida credenciais no PostgreSQL,
 * cria sessão em auth_sessions e devolve JWT.
 */
async function login(
    user
) {
    const result =
        await authService.login({

            email:
                user.email,

            password:
                PASSWORD,
        });

    return result.token;
}

function authorizationHeaders(
    token
) {
    return {
        Authorization: `Bearer ${token}`,
    };
}

function postPrivate(
    token,
    otherUserId
) {
    return fetch(
        `${baseUrl}/api/v1/conversations/private`,
        {
            method: "POST",

            headers: {
                ...authorizationHeaders(
                    token
                ),

                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                otherUserId,
            }),
        }
    );
}

function listConversations(
    token
) {
    return fetch(
        `${baseUrl}/api/v1/conversations`,
        {
            headers: authorizationHeaders(
                token
            ),
        }
    );
}

function getHistory(
    token,
    conversationId,
    query = ""
) {
    return fetch(
        `${baseUrl}/api/v1/conversations/${conversationId}/messages${query}`,
        {
            headers: authorizationHeaders(
                token
            ),
        }
    );
}

async function createConversationBetween(
    userA,
    userB
) {
    const tokenA =
        await login(
            userA
        );

    const response =
        await postPrivate(
            tokenA,
            userB.user_id
        );

    const body =
        await response.json();

    assert.equal(
        response.status,
        201
    );

    const conversationId =
        body.data.conversation._id;

    testConversationIds.add(
        conversationId
    );

    return conversationId;
}

async function insertMessages(
    conversationId,
    participants,
    count = 3
) {
    const baseDate =
        new Date(
            "2031-01-01T12:00:00.000Z"
        );

    const documents =
        [];

    for (
        let index = 0;
        index < count;
        index++
    ) {
        documents.push({

            conversation_id:
                conversationId,

            sender_id:
                participants[
                    index %
                        participants.length
                ],

            client_message_id:
                `be07-${randomUUID()}`,

            content:
                `Mensagem ${index + 1}`,

            created_at:
                new Date(
                    baseDate.getTime() +
                        (
                            index *
                            1000
                        )
                ),
        });
    }

    await Message.insertMany(
        documents
    );

    return documents;
}

async function cleanup() {
    const conversationIds =
        [
            ...testConversationIds,
        ].map(
            id =>
                new mongoose
                    .Types
                    .ObjectId(
                        id
                    )
        );

    if (
        conversationIds.length
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

    testConversationIds.clear();

    if (
        testUserIds.size >
        0
    ) {
        await AuthSession
            .destroy({

                where: {

                    user_id: [
                        ...testUserIds,
                    ],
                },
            });

        await User.destroy({

            where: {

                user_id: [
                    ...testUserIds,
                ],
            },
        });
    }

    testUserIds.clear();
}

before(async () => {
    if (
        process.env.NODE_ENV !==
        "development"
    ) {
        throw new Error(
            "Este teste deve executar somente no ambiente development."
        );
    }

    await sequelize.authenticate();

    await connectMongoDB();

    await Conversation.syncIndexes();

    await ConversationMember
        .syncIndexes();

    await Message.syncIndexes();

    /*
     * Aplicação real com o serviço de
     * conversas ligado aos bancos de
     * desenvolvimento.
     */
    const conversationService =
        createConversationService();

    const app =
        createApp({

            authService,

            conversationService,
        });

    await new Promise(
        (
            resolve
        ) => {
            server =
                app.listen(
                    0,
                    "127.0.0.1",
                    () => {
                        baseUrl =
                            `http://127.0.0.1:${server.address().port}`;

                        resolve();
                    }
                );
        }
    );
});

afterEach(async () => {
    await cleanup();
});

after(async () => {
    await cleanup();

    await new Promise(
        (
            resolve,
            reject
        ) => {
            server.close(
                (
                    error
                ) => {
                    if (
                        error
                    ) {
                        reject(
                            error
                        );

                        return;
                    }

                    resolve();
                }
            );
        }
    );

    await mongoose.disconnect();

    await sequelize.close();
});

/*
 * ============================
 * CENÁRIOS POSITIVOS
 * ============================
 */

test(
    "INTEGRATION BE-07: login real emite JWT e endpoint cria conversa privada com dois membros",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const conversationId =
            await createConversationBetween(
                userA,
                userB
            );

        const conversation =
            await Conversation.findById(
                conversationId
            );

        assert.ok(
            conversation
        );

        assert.equal(
            conversation.type,
            "PRIVATE"
        );

        const members =
            await ConversationMember
                .find({

                    conversation_id:
                        conversationId,
                });

        assert.equal(
            members.length,
            2
        );

        const memberUserIds =
            members
                .map(
                    member =>
                        member.user_id
                )
                .sort();

        assert.deepEqual(
            memberUserIds,
            [
                userA.user_id,
                userB.user_id,
            ].sort()
        );
    }
);

test(
    "INTEGRATION BE-07: criar a mesma conversa privada duas vezes reutiliza o documento",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const firstId =
            await createConversationBetween(
                userA,
                userB
            );

        const tokenB =
            await login(
                userB
            );

        const response =
            await postPrivate(
                tokenB,
                userA.user_id
            );

        const body =
            await response.json();

        assert.equal(
            response.status,
            201
        );

        assert.equal(
            body.data.conversation._id,
            firstId
        );

        /*
         * Continua sendo uma única
         * conversa para o par.
         */
        const conversations =
            await Conversation.find({

                type: "PRIVATE",

                private_key:
                    [
                        userA.user_id,
                        userB.user_id,
                    ]
                        .sort()
                        .join(
                            ":"
                        ),
            });

        assert.equal(
            conversations.length,
            1
        );
    }
);

test(
    "INTEGRATION BE-07: listar conversas retorna apenas as conversas do usuário autenticado",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const userC =
            await createTestUser();

        const conversationId =
            await createConversationBetween(
                userA,
                userB
            );

        const tokenA =
            await login(
                userA
            );

        const tokenC =
            await login(
                userC
            );

        const responseA =
            await listConversations(
                tokenA
            );

        const bodyA =
            await responseA.json();

        assert.equal(
            responseA.status,
            200
        );

        const idsA =
            bodyA.data.conversations.map(
                conversation =>
                    conversation._id.toString()
            );

        assert.ok(
            idsA.includes(
                conversationId
            )
        );

        /*
         * Isolamento: C não participa
         * da conversa de A e B.
         */
        const responseC =
            await listConversations(
                tokenC
            );

        const bodyC =
            await responseC.json();

        assert.equal(
            responseC.status,
            200
        );

        const idsC =
            bodyC.data.conversations.map(
                conversation =>
                    conversation._id.toString()
            );

        assert.equal(
            idsC.includes(
                conversationId
            ),
            false
        );
    }
);

test(
    "INTEGRATION BE-07: histórico retorna mensagens em ordem cronológica com paginação",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const conversationId =
            await createConversationBetween(
                userA,
                userB
            );

        const documents =
            await insertMessages(
                conversationId,
                [
                    userA.user_id,
                    userB.user_id,
                ],
                3
            );

        const tokenA =
            await login(
                userA
            );

        const firstPage =
            await getHistory(
                tokenA,
                conversationId,
                "?limit=2"
            );

        const firstBody =
            await firstPage.json();

        assert.equal(
            firstPage.status,
            200
        );

        assert.equal(
            firstBody.data.items.length,
            2
        );

        assert.equal(
            firstBody.data.hasMore,
            true
        );

        assert.ok(
            firstBody.data.nextCursor
        );

        /*
         * Ordem cronológica:
         * antiga -> nova.
         */
        assert.deepEqual(
            firstBody.data.items.map(
                item =>
                    item.content
            ),
            [
                "Mensagem 2",
                "Mensagem 3",
            ]
        );

        const secondPage =
            await getHistory(
                tokenA,
                conversationId,
                `?limit=2&before=${firstBody.data.nextCursor}`
            );

        const secondBody =
            await secondPage.json();

        assert.equal(
            secondPage.status,
            200
        );

        assert.equal(
            secondBody.data.items.length,
            1
        );

        assert.equal(
            secondBody.data.hasMore,
            false
        );

        assert.deepEqual(
            secondBody.data.items.map(
                item =>
                    item.content
            ),
            [
                "Mensagem 1",
            ]
        );

        /*
         * Sem duplicação entre páginas.
         */
        const firstIds =
            new Set(
                firstBody.data.items.map(
                    item =>
                        item._id.toString()
                )
            );

        for (
            const item of
                secondBody.data.items
        ) {
            assert.equal(
                firstIds.has(
                    item._id.toString()
                ),
                false
            );
        }

        assert.equal(
            documents.length,
            3
        );
    }
);

/*
 * ============================
 * SEGURANÇA — RESTRIÇÕES DE
 * HISTÓRICO E IDENTIDADE
 * ============================
 */

test(
    "INTEGRATION BE-07 SECURITY: usuário autenticado fora da conversa não acessa o histórico",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const outsider =
            await createTestUser();

        const conversationId =
            await createConversationBetween(
                userA,
                userB
            );

        await insertMessages(
            conversationId,
            [
                userA.user_id,
                userB.user_id,
            ],
            2
        );

        const tokenOutsider =
            await login(
                outsider
            );

        const response =
            await getHistory(
                tokenOutsider,
                conversationId
            );

        const body =
            await response.json();

        /*
         * O serviço rejeita com
         * USER_NOT_ACTIVE_MEMBER.
         */
        assert.equal(
            response.status,
            500
        );

        assert.equal(
            body.error.code,
            "INTERNAL_ERROR"
        );

        /*
         * Nenhuma mensagem é exposta
         * a quem não participa.
         */
        assert.equal(
            body.data,
            undefined
        );

        assert.equal(
            JSON.stringify(
                body
            )
                .includes(
                    "Mensagem"
                ),
            false
        );
    }
);

test(
    "INTEGRATION BE-07 SECURITY: membro com status LEFT não lista a conversa nem acessa o histórico",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const conversationId =
            await createConversationBetween(
                userA,
                userB
            );

        await insertMessages(
            conversationId,
            [
                userA.user_id,
                userB.user_id,
            ],
            2
        );

        /*
         * B sai da conversa.
         */
        await ConversationMember
            .updateOne(
                {

                    conversation_id:
                        conversationId,

                    user_id:
                        userB.user_id,
                },

                {
                    $set: {

                        status: "LEFT",

                        left_at: new Date(),
                    },
                }
            );

        const tokenB =
            await login(
                userB
            );

        const historyResponse =
            await getHistory(
                tokenB,
                conversationId
            );

        const historyBody =
            await historyResponse.json();

        assert.equal(
            historyResponse.status,
            500
        );

        assert.equal(
            historyBody.error.code,
            "INTERNAL_ERROR"
        );

        assert.equal(
            historyBody.data,
            undefined
        );

        const listResponse =
            await listConversations(
                tokenB
            );

        const listBody =
            await listResponse.json();

        assert.equal(
            listResponse.status,
            200
        );

        const ids =
            listBody.data.conversations.map(
                conversation =>
                    conversation._id.toString()
            );

        assert.equal(
            ids.includes(
                conversationId
            ),
            false
        );
    }
);

test(
    "INTEGRATION BE-07 SECURITY: token inválido é rejeitado nos três endpoints",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const conversationId =
            await createConversationBetween(
                userA,
                userB
            );

        const invalidHeaders =
            authorizationHeaders(
                "token-invalido"
            );

        const createResponse =
            await postPrivate(
                "token-invalido",
                userB.user_id
            );

        assert.equal(
            createResponse.status,
            401
        );

        const createBody =
            await createResponse.json();

        assert.equal(
            createBody.error.code,
            "TOKEN_INVALID"
        );

        const listResponse =
            await fetch(
                `${baseUrl}/api/v1/conversations`,
                {
                    headers: invalidHeaders,
                }
            );

        assert.equal(
            listResponse.status,
            401
        );

        const listBody =
            await listResponse.json();

        assert.equal(
            listBody.error.code,
            "TOKEN_INVALID"
        );

        const historyResponse =
            await getHistory(
                "token-invalido",
                conversationId
            );

        assert.equal(
            historyResponse.status,
            401
        );

        const historyBody =
            await historyResponse.json();

        assert.equal(
            historyBody.error.code,
            "TOKEN_INVALID"
        );
    }
);

test(
    "INTEGRATION BE-07 SECURITY: requisição sem token é rejeitada nos três endpoints",

    async () => {
        const userA =
            await createTestUser();

        const userB =
            await createTestUser();

        const conversationId =
            await createConversationBetween(
                userA,
                userB
            );

        const createResponse =
            await fetch(
                `${baseUrl}/api/v1/conversations/private`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                    },

                    body: JSON.stringify({
                        otherUserId:
                            userB.user_id,
                    }),
                }
            );

        assert.equal(
            createResponse.status,
            401
        );

        const createBody =
            await createResponse.json();

        assert.equal(
            createBody.error.code,
            "TOKEN_MISSING"
        );

        const listResponse =
            await fetch(
                `${baseUrl}/api/v1/conversations`
            );

        assert.equal(
            listResponse.status,
            401
        );

        const listBody =
            await listResponse.json();

        assert.equal(
            listBody.error.code,
            "TOKEN_MISSING"
        );

        const historyResponse =
            await fetch(
                `${baseUrl}/api/v1/conversations/${conversationId}/messages`
            );

        assert.equal(
            historyResponse.status,
            401
        );

        const historyBody =
            await historyResponse.json();

        assert.equal(
            historyBody.error.code,
            "TOKEN_MISSING"
        );
    }
);

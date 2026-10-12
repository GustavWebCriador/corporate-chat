process.env.NODE_ENV = "test";

process.env.JWT_SECRET =
    "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";


const test =
    require(
        "node:test"
    );

const assert =
    require(
        "node:assert/strict"
    );


const AppError =
    require(
        "../../src/errors/AppError"
    );


const {
    createApp,
} = require(
    "../../src/app"
);


const {
    createDashboardService,
} = require(
    "../../src/services/dashboard/dashboardService"
);


const {
    createHealthService,
} = require(
    "../../src/services/health/healthService"
);


/*
 * =====================================================
 * IDENTIFICADORES DE TESTE
 * =====================================================
 */

const CURRENT_USER_ID =
    "11111111-1111-4111-8111-111111111111";

const CONTACT_USER_ID =
    "22222222-2222-4222-8222-222222222222";

const GROUP_USER_ID =
    "33333333-3333-4333-8333-333333333333";

const INACTIVE_USER_ID =
    "44444444-4444-4444-8444-444444444444";

const OTHER_USER_ID =
    "55555555-5555-4555-8555-555555555555";


/*
 * =====================================================
 * AUTH SERVICE DE TESTE
 * =====================================================
 *
 * O middleware de autenticação real continua sendo
 * utilizado pela rota.
 *
 * Aqui substituímos apenas o serviço que valida
 * o token, pois os contratos completos de JWT já
 * possuem testes próprios em auth.test.js.
 * =====================================================
 */

function createTestAuthService() {

    return {

        async authenticateToken(
            token
        ) {

            if (
                token !==
                "valid-dashboard-token"
            ) {

                throw AppError.unauthorized(
                    "Token inválido.",
                    "TOKEN_INVALID"
                );
            }


            return {

                user_id:
                    CURRENT_USER_ID,

                name:
                    "Usuário Atual",

                email:
                    "atual@corp.local",

                status:
                    "ACTIVE",

                is_admin:
                    false,
            };
        },
    };
}


/*
 * =====================================================
 * USER REPOSITORY EM MEMÓRIA
 * =====================================================
 */

function createMemoryUserRepository() {

    const rows = [
        {
            user_id:
                CURRENT_USER_ID,

            name:
                "Usuário Atual",

            email:
                "atual@corp.local",

            status:
                "ACTIVE",

            is_admin:
                false,

            password_hash:
                "HASH-NAO-PODE-VAZAR",
        },

        {
            user_id:
                CONTACT_USER_ID,

            name:
                "Contato Ativo",

            email:
                "contato@corp.local",

            status:
                "ACTIVE",

            is_admin:
                false,

            password_hash:
                "HASH-CONTATO",
        },

        {
            user_id:
                GROUP_USER_ID,

            name:
                "Outro Contato",

            email:
                "grupo@corp.local",

            status:
                "ACTIVE",

            is_admin:
                true,

            password_hash:
                "HASH-GRUPO",
        },

        {
            user_id:
                INACTIVE_USER_ID,

            name:
                "Contato Inativo",

            email:
                "inativo@corp.local",

            status:
                "INACTIVE",

            is_admin:
                false,

            password_hash:
                "HASH-INATIVO",
        },
    ];


    const calls = {

        excludeUserId:
            null,

        findPublicByIds:
            [],
    };


    async function findActiveContacts({
        excludeUserId,
    } = {}) {

        calls.excludeUserId =
            excludeUserId;


        return rows
            .filter(
                user =>
                    user.status ===
                        "ACTIVE" &&

                    user.user_id !==
                        excludeUserId
            )
            .map(
                user => ({
                    ...user,
                })
            );
    }


    async function findPublicByIds(
        userIds
    ) {

        calls.findPublicByIds =
            [
                ...userIds,
            ];


        const ids =
            new Set(
                userIds
            );


        return rows
            .filter(
                user =>
                    ids.has(
                        user.user_id
                    )
            )
            .map(
                user => ({
                    ...user,
                })
            );
    }


    return {

        rows,

        calls,

        findActiveContacts,

        findPublicByIds,
    };
}


/*
 * =====================================================
 * CONVERSAS EM MEMÓRIA
 * =====================================================
 */

function createConversationQueryMock() {

    const calls = {

        userId:
            null,

        limit:
            null,
    };


    async function listConversations({
        userId,
        limit,
    }) {

        calls.userId =
            userId;

        calls.limit =
            limit;


        return [
            {
                _id:
                    "66f000000000000000000001",

                type:
                    "PRIVATE",

                /*
                 * Campo interno proposital.
                 * Não poderá aparecer na API.
                 */
                private_key:
                    `${CURRENT_USER_ID}:${CONTACT_USER_ID}`,

                participant_user_ids: [
                    CURRENT_USER_ID,
                    CONTACT_USER_ID,
                ],

                membership: {
                    role:
                        "CREATOR",
                },

                last_message_id:
                    "66f000000000000000000101",

                last_message_at:
                    new Date(
                        "2030-01-01T10:00:00.000Z"
                    ),

                created_at:
                    new Date(
                        "2030-01-01T09:00:00.000Z"
                    ),

                last_message: {
                    _id:
                        "66f000000000000000000101",

                    conversation_id:
                        "66f000000000000000000001",

                    sender_id:
                        CONTACT_USER_ID,

                    client_message_id:
                        "client-private-1",

                    content:
                        "Mensagem privada",

                    created_at:
                        new Date(
                            "2030-01-01T10:00:00.000Z"
                        ),
                },
            },

            {
                _id:
                    "66f000000000000000000002",

                type:
                    "GROUP",

                name:
                    "Equipe Corporate Chat",

                participant_user_ids: [
                    CURRENT_USER_ID,
                    CONTACT_USER_ID,
                    GROUP_USER_ID,
                ],

                membership: {
                    role:
                        "MEMBER",
                },

                last_message_id:
                    "66f000000000000000000201",

                last_message_at:
                    new Date(
                        "2030-01-01T11:00:00.000Z"
                    ),

                created_at:
                    new Date(
                        "2030-01-01T08:00:00.000Z"
                    ),

                last_message: {
                    _id:
                        "66f000000000000000000201",

                    conversation_id:
                        "66f000000000000000000002",

                    sender_id:
                        GROUP_USER_ID,

                    client_message_id:
                        "client-group-1",

                    content:
                        "Mensagem do grupo",

                    created_at:
                        new Date(
                            "2030-01-01T11:00:00.000Z"
                        ),
                },
            },
        ];
    }


    return {

        calls,

        listConversations,
    };
}


/*
 * =====================================================
 * SERVIDOR
 * =====================================================
 */

function listen(
    app
) {

    return new Promise(
        resolve => {

            const server =
                app.listen(
                    0,
                    "127.0.0.1",
                    () => {

                        resolve({

                            server,

                            baseUrl:
                                `http://127.0.0.1:${server.address().port}`,
                        });
                    }
                );
        }
    );
}


function close(
    server
) {

    return new Promise(
        resolve =>
            server.close(
                resolve
            )
    );
}


/*
 * =====================================================
 * CONTEXTO DE TESTE
 * =====================================================
 */

async function createTestContext() {

    const userRepository =
        createMemoryUserRepository();


    const conversationQuery =
        createConversationQueryMock();


    const dashboardService =
        createDashboardService({

            userRepository,

            listConversations:
                conversationQuery
                    .listConversations,
        });


    const authService =
        createTestAuthService();


    const healthService =
        createHealthService({

            checks: {

                postgres:
                    async () => {},

                mongodb:
                    async () => {},
            },
        });


    const app =
        createApp({

            authService,

            healthService,

            dashboardService,
        });


    const {
        server,
        baseUrl,
    } =
        await listen(
            app
        );


    return {

        server,

        baseUrl,

        userRepository,

        conversationQuery,
    };
}


/*
 * =====================================================
 * HTTP
 * =====================================================
 */

function requestDashboard(
    baseUrl,
    {
        token,
        query = "",
    } = {}
) {

    const headers =
        {};


    if (token) {

        headers.Authorization =
            `Bearer ${token}`;
    }


    return fetch(
        `${baseUrl}/api/v1/dashboard${query}`,
        {
            headers,
        }
    );
}


/*
 * =====================================================
 * TESTES
 * =====================================================
 */

test(
    "BE-06: dashboard sem autenticação retorna 401 TOKEN_MISSING",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await requestDashboard(
                    context.baseUrl
                );


            assert.equal(
                response.status,
                401
            );


            const body =
                await response.json();


            assert.equal(
                body.error.code,
                "TOKEN_MISSING"
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);


test(
    "BE-06: usuário comum autenticado acessa o dashboard",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await requestDashboard(
                    context.baseUrl,
                    {
                        token:
                            "valid-dashboard-token",
                    }
                );


            assert.equal(
                response.status,
                200
            );


            const body =
                await response.json();


            assert.ok(
                Array.isArray(
                    body.data.contacts
                )
            );


            assert.ok(
                Array.isArray(
                    body.data.conversations
                )
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);


test(
    "BE-06: contatos possuem somente usuários ACTIVE e excluem o próprio usuário",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await requestDashboard(
                    context.baseUrl,
                    {
                        token:
                            "valid-dashboard-token",
                    }
                );


            const body =
                await response.json();


            assert.equal(
                response.status,
                200
            );


            const contactIds =
                body.data.contacts
                    .map(
                        contact =>
                            contact.user_id
                    );


            assert.ok(
                contactIds.includes(
                    CONTACT_USER_ID
                )
            );


            assert.ok(
                contactIds.includes(
                    GROUP_USER_ID
                )
            );


            assert.equal(
                contactIds.includes(
                    CURRENT_USER_ID
                ),
                false
            );


            assert.equal(
                contactIds.includes(
                    INACTIVE_USER_ID
                ),
                false
            );


            assert.equal(
                context
                    .userRepository
                    .calls
                    .excludeUserId,
                CURRENT_USER_ID
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);


test(
    "BE-06: contatos não expõem password_hash nem privilégios administrativos",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await requestDashboard(
                    context.baseUrl,
                    {
                        token:
                            "valid-dashboard-token",
                    }
                );


            const text =
                await response.text();


            assert.equal(
                response.status,
                200
            );


            assert.equal(
                text.includes(
                    "password_hash"
                ),
                false
            );


            assert.equal(
                text.includes(
                    "HASH-"
                ),
                false
            );


            assert.equal(
                text.includes(
                    "\"is_admin\""
                ),
                false
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);


test(
    "BE-06: conversa PRIVATE identifica o outro contato",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await requestDashboard(
                    context.baseUrl,
                    {
                        token:
                            "valid-dashboard-token",
                    }
                );


            const body =
                await response.json();


            const privateConversation =
                body.data.conversations
                    .find(
                        conversation =>
                            conversation.type ===
                            "PRIVATE"
                    );


            assert.ok(
                privateConversation
            );


            assert.equal(
                privateConversation
                    .conversation_id,
                "66f000000000000000000001"
            );


            assert.equal(
                privateConversation.name,
                null
            );


            assert.deepEqual(
                privateConversation.contact,
                {
                    user_id:
                        CONTACT_USER_ID,

                    name:
                        "Contato Ativo",

                    email:
                        "contato@corp.local",

                    status:
                        "ACTIVE",
                }
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);


test(
    "BE-06: conversa GROUP possui nome e não possui contact",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await requestDashboard(
                    context.baseUrl,
                    {
                        token:
                            "valid-dashboard-token",
                    }
                );


            const body =
                await response.json();


            const group =
                body.data.conversations
                    .find(
                        conversation =>
                            conversation.type ===
                            "GROUP"
                    );


            assert.ok(
                group
            );


            assert.equal(
                group.name,
                "Equipe Corporate Chat"
            );


            assert.equal(
                group.contact,
                null
            );


            assert.equal(
                group.membership.role,
                "MEMBER"
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);


test(
    "BE-06: resposta de conversas não expõe campos internos",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await requestDashboard(
                    context.baseUrl,
                    {
                        token:
                            "valid-dashboard-token",
                    }
                );


            const text =
                await response.text();


            assert.equal(
                response.status,
                200
            );


            assert.equal(
                text.includes(
                    "private_key"
                ),
                false
            );


            assert.equal(
                text.includes(
                    "participant_user_ids"
                ),
                false
            );


            assert.equal(
                text.includes(
                    "client_message_id"
                ),
                false
            );


            assert.equal(
                text.includes(
                    "last_message_id"
                ),
                false
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);


test(
    "BE-06: última mensagem utiliza contrato público",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await requestDashboard(
                    context.baseUrl,
                    {
                        token:
                            "valid-dashboard-token",
                    }
                );


            const body =
                await response.json();


            const privateConversation =
                body.data.conversations
                    .find(
                        conversation =>
                            conversation.type ===
                            "PRIVATE"
                    );


            assert.deepEqual(
                privateConversation
                    .last_message,
                {
                    message_id:
                        "66f000000000000000000101",

                    sender_id:
                        CONTACT_USER_ID,

                    content:
                        "Mensagem privada",

                    created_at:
                        "2030-01-01T10:00:00.000Z",
                }
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);


test(
    "BE-06: limit padrão é 50",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await requestDashboard(
                    context.baseUrl,
                    {
                        token:
                            "valid-dashboard-token",
                    }
                );


            assert.equal(
                response.status,
                200
            );


            assert.equal(
                context
                    .conversationQuery
                    .calls
                    .limit,
                50
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);


test(
    "BE-06: limit válido é convertido para número",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await requestDashboard(
                    context.baseUrl,
                    {
                        token:
                            "valid-dashboard-token",

                        query:
                            "?limit=25",
                    }
                );


            assert.equal(
                response.status,
                200
            );


            assert.equal(
                context
                    .conversationQuery
                    .calls
                    .limit,
                25
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);


test(
    "BE-06: limits inválidos retornam 400 VALIDATION_ERROR",

    async () => {

        const invalidLimits = [
            "0",
            "101",
            "abc",
            "-1",
            "1.5",
            "",
        ];


        for (
            const limit of
                invalidLimits
        ) {

            const context =
                await createTestContext();


            try {

                const response =
                    await requestDashboard(
                        context.baseUrl,
                        {
                            token:
                                "valid-dashboard-token",

                            query:
                                `?limit=${encodeURIComponent(limit)}`,
                        }
                    );


                assert.equal(
                    response.status,
                    400,
                    `limit=${limit}`
                );


                const body =
                    await response.json();


                assert.equal(
                    body.error.code,
                    "VALIDATION_ERROR"
                );


                assert.equal(
                    body.error
                        .details[0]
                        .field,
                    "limit"
                );

            } finally {

                await close(
                    context.server
                );
            }
        }
    }
);


test(
    "BE-06: userId enviado pelo cliente não substitui o usuário autenticado",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await requestDashboard(
                    context.baseUrl,
                    {
                        token:
                            "valid-dashboard-token",

                        query:
                            `?userId=${OTHER_USER_ID}`,
                    }
                );


            assert.equal(
                response.status,
                200
            );


            assert.equal(
                context
                    .conversationQuery
                    .calls
                    .userId,
                CURRENT_USER_ID
            );


            assert.equal(
                context
                    .userRepository
                    .calls
                    .excludeUserId,
                CURRENT_USER_ID
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);
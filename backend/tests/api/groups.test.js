process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const AppError = require("../../src/errors/AppError");

const {
    createApp,
} = require("../../src/app");


const USER_ID =
    "22222222-2222-4222-8222-222222222222";

const MEMBER_ID =
    "33333333-3333-4333-8333-333333333333";

const OTHER_MEMBER_ID =
    "44444444-4444-4444-8444-444444444444";

const GROUP_ID =
    "507f1f77bcf86cd799439011";


function listen(app) {

    return new Promise(
        (resolve) => {

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


function close(server) {

    return new Promise(
        (resolve, reject) => {

            server.close(
                (error) => {

                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        }
    );
}


function createGroupFixture(
    overrides = {}
) {

    return {

        _id:
            GROUP_ID,

        type:
            "GROUP",

        name:
            "Equipe Corporate Chat",

        created_by:
            USER_ID,

        created_at:
            "2026-10-21T12:00:00.000Z",

        updated_at:
            "2026-10-21T12:00:00.000Z",

        members: [
            {
                user_id:
                    USER_ID,

                role:
                    "CREATOR",

                status:
                    "ACTIVE",
            },

            {
                user_id:
                    MEMBER_ID,

                role:
                    "MEMBER",

                status:
                    "ACTIVE",
            },
        ],

        ...overrides,
    };
}


function createTestApi() {

    const calls = {

        create: [],

        getById: [],

        rename: [],

        addMembers: [],

        removeMember: [],

        leave: [],
    };


    const failures = {

        create: null,

        getById: null,

        rename: null,

        addMembers: null,

        removeMember: null,

        leave: null,
    };


    const authService = {

        async authenticateToken(
            token
        ) {

            if (
                token !==
                "token-de-teste"
            ) {

                throw AppError
                    .unauthorized(
                        "Token inválido.",
                        "TOKEN_INVALID"
                    );
            }


            return {

                user_id:
                    USER_ID,

                status:
                    "ACTIVE",

                is_admin:
                    false,
            };
        },
    };


    const groupService = {

        async createGroup(
            params
        ) {

            calls.create.push(
                params
            );


            if (
                failures.create
            ) {

                throw failures.create;
            }


            return createGroupFixture();
        },


        async getGroup(
            params
        ) {

            calls.getById.push(
                params
            );


            if (
                failures.getById
            ) {

                throw failures.getById;
            }


            return createGroupFixture();
        },


        async renameGroup(
            params
        ) {

            calls.rename.push(
                params
            );


            if (
                failures.rename
            ) {

                throw failures.rename;
            }


            return createGroupFixture({
                name:
                    params.input.name,
            });
        },


        async addMembers(
            params
        ) {

            calls.addMembers.push(
                params
            );


            if (
                failures.addMembers
            ) {

                throw failures
                    .addMembers;
            }


            return createGroupFixture({
                members: [
                    ...createGroupFixture()
                        .members,

                    {
                        user_id:
                            OTHER_MEMBER_ID,

                        role:
                            "MEMBER",

                        status:
                            "ACTIVE",
                    },
                ],
            });
        },


        async removeMember(
            params
        ) {

            calls.removeMember.push(
                params
            );


            if (
                failures.removeMember
            ) {

                throw failures
                    .removeMember;
            }
        },


        async leaveGroup(
            params
        ) {

            calls.leave.push(
                params
            );


            if (
                failures.leave
            ) {

                throw failures.leave;
            }
        },
    };


    return {

        app:
            createApp({
                authService,
                groupService,
            }),

        calls,

        failures,
    };
}


function authorizationHeaders() {

    return {

        Authorization:
            "Bearer token-de-teste",
    };
}


async function withApi(
    run
) {

    const {
        app,
        calls,
        failures,
    } = createTestApi();


    const {
        server,
        baseUrl,
    } = await listen(
        app
    );


    try {

        await run({
            baseUrl,
            calls,
            failures,
        });

    } finally {

        await close(
            server
        );
    }
}


function jsonHeaders(
    headers = {}
) {

    return {

        "Content-Type":
            "application/json",

        ...headers,
    };
}


/*
 * =====================================================
 * CRIAÇÃO
 * =====================================================
 */


test(
    "BE-08: criar grupo retorna 201",
    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups`,
                        {
                            method:
                                "POST",

                            headers:
                                jsonHeaders(
                                    authorizationHeaders()
                                ),

                            body:
                                JSON.stringify({
                                    name:
                                        "Equipe Corporate Chat",

                                    memberIds: [
                                        MEMBER_ID,
                                    ],
                                }),
                        }
                    );


                const body =
                    await response.json();


                assert.equal(
                    response.status,
                    201
                );

                assert.equal(
                    body.data.group.type,
                    "GROUP"
                );

                assert.equal(
                    body.data.group.name,
                    "Equipe Corporate Chat"
                );


                assert.deepEqual(
                    calls.create,
                    [
                        {
                            creatorId:
                                USER_ID,

                            input: {
                                name:
                                    "Equipe Corporate Chat",

                                memberIds: [
                                    MEMBER_ID,
                                ],
                            },
                        },
                    ]
                );
            }
        );
    }
);


test(
    "BE-08 SECURITY: criador do grupo vem do usuário autenticado",
    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups`,
                        {
                            method:
                                "POST",

                            headers:
                                jsonHeaders(
                                    authorizationHeaders()
                                ),

                            body:
                                JSON.stringify({
                                    name:
                                        "Grupo Seguro",

                                    memberIds: [
                                        MEMBER_ID,
                                    ],

                                    creatorId:
                                        OTHER_MEMBER_ID,
                                }),
                        }
                    );


                assert.equal(
                    response.status,
                    201
                );


                assert.equal(
                    calls.create[0]
                        .creatorId,
                    USER_ID
                );


                assert.notEqual(
                    calls.create[0]
                        .creatorId,
                    OTHER_MEMBER_ID
                );
            }
        );
    }
);


/*
 * =====================================================
 * CONSULTA
 * =====================================================
 */


test(
    "BE-08: consultar grupo retorna 200",
    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups/${GROUP_ID}`,
                        {
                            headers:
                                authorizationHeaders(),
                        }
                    );


                const body =
                    await response.json();


                assert.equal(
                    response.status,
                    200
                );

                assert.equal(
                    body.data.group._id,
                    GROUP_ID
                );

                assert.equal(
                    body.data.group.members.length,
                    2
                );


                assert.deepEqual(
                    calls.getById,
                    [
                        {
                            groupId:
                                GROUP_ID,

                            requesterId:
                                USER_ID,
                        },
                    ]
                );
            }
        );
    }
);


/*
 * =====================================================
 * ALTERAÇÃO DO NOME
 * =====================================================
 */


test(
    "BE-08: alterar nome do grupo retorna 200",
    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups/${GROUP_ID}`,
                        {
                            method:
                                "PATCH",

                            headers:
                                jsonHeaders(
                                    authorizationHeaders()
                                ),

                            body:
                                JSON.stringify({
                                    name:
                                        "Novo Nome",
                                }),
                        }
                    );


                const body =
                    await response.json();


                assert.equal(
                    response.status,
                    200
                );

                assert.equal(
                    body.data.group.name,
                    "Novo Nome"
                );


                assert.deepEqual(
                    calls.rename,
                    [
                        {
                            groupId:
                                GROUP_ID,

                            requesterId:
                                USER_ID,

                            input: {
                                name:
                                    "Novo Nome",
                            },
                        },
                    ]
                );
            }
        );
    }
);


/*
 * =====================================================
 * PARTICIPANTES
 * =====================================================
 */


test(
    "BE-08: adicionar participante retorna 200",
    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups/${GROUP_ID}/members`,
                        {
                            method:
                                "POST",

                            headers:
                                jsonHeaders(
                                    authorizationHeaders()
                                ),

                            body:
                                JSON.stringify({
                                    memberIds: [
                                        OTHER_MEMBER_ID,
                                    ],
                                }),
                        }
                    );


                const body =
                    await response.json();


                assert.equal(
                    response.status,
                    200
                );

                assert.equal(
                    body.data.group.members.length,
                    3
                );


                assert.deepEqual(
                    calls.addMembers,
                    [
                        {
                            groupId:
                                GROUP_ID,

                            requesterId:
                                USER_ID,

                            input: {
                                memberIds: [
                                    OTHER_MEMBER_ID,
                                ],
                            },
                        },
                    ]
                );
            }
        );
    }
);


test(
    "BE-08: remover participante retorna 204",
    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups/${GROUP_ID}/members/${MEMBER_ID}`,
                        {
                            method:
                                "DELETE",

                            headers:
                                authorizationHeaders(),
                        }
                    );


                assert.equal(
                    response.status,
                    204
                );


                assert.deepEqual(
                    calls.removeMember,
                    [
                        {
                            groupId:
                                GROUP_ID,

                            requesterId:
                                USER_ID,

                            memberId:
                                MEMBER_ID,
                        },
                    ]
                );
            }
        );
    }
);


/*
 * =====================================================
 * SAÍDA VOLUNTÁRIA
 * =====================================================
 */


test(
    "BE-08: sair do grupo retorna 204",
    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups/${GROUP_ID}/leave`,
                        {
                            method:
                                "POST",

                            headers:
                                authorizationHeaders(),
                        }
                    );


                assert.equal(
                    response.status,
                    204
                );


                assert.deepEqual(
                    calls.leave,
                    [
                        {
                            groupId:
                                GROUP_ID,

                            requesterId:
                                USER_ID,
                        },
                    ]
                );
            }
        );
    }
);


/*
 * =====================================================
 * AUTENTICAÇÃO
 * =====================================================
 */


test(
    "BE-08 SECURITY: criar grupo sem autenticação retorna 401 TOKEN_MISSING",
    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups`,
                        {
                            method:
                                "POST",

                            headers:
                                jsonHeaders(),

                            body:
                                JSON.stringify({
                                    name:
                                        "Grupo",

                                    memberIds: [
                                        MEMBER_ID,
                                    ],
                                }),
                        }
                    );


                const body =
                    await response.json();


                assert.equal(
                    response.status,
                    401
                );

                assert.equal(
                    body.error.code,
                    "TOKEN_MISSING"
                );

                assert.equal(
                    calls.create.length,
                    0
                );
            }
        );
    }
);


test(
    "BE-08 SECURITY: token inválido retorna 401 TOKEN_INVALID",
    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups`,
                        {
                            method:
                                "POST",

                            headers:
                                jsonHeaders({
                                    Authorization:
                                        "Bearer token-invalido",
                                }),

                            body:
                                JSON.stringify({
                                    name:
                                        "Grupo",

                                    memberIds: [
                                        MEMBER_ID,
                                    ],
                                }),
                        }
                    );


                const body =
                    await response.json();


                assert.equal(
                    response.status,
                    401
                );

                assert.equal(
                    body.error.code,
                    "TOKEN_INVALID"
                );

                assert.equal(
                    calls.create.length,
                    0
                );
            }
        );
    }
);


/*
 * =====================================================
 * ERROS DE NEGÓCIO
 * =====================================================
 */


test(
    "BE-08: membro não criador não pode renomear grupo",
    async () => {

        await withApi(
            async ({
                baseUrl,
                failures,
            }) => {

                failures.rename =
                    AppError.forbidden(
                        "Apenas o criador pode gerenciar o grupo.",
                        "GROUP_CREATOR_REQUIRED"
                    );


                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups/${GROUP_ID}`,
                        {
                            method:
                                "PATCH",

                            headers:
                                jsonHeaders(
                                    authorizationHeaders()
                                ),

                            body:
                                JSON.stringify({
                                    name:
                                        "Tentativa",
                                }),
                        }
                    );


                const body =
                    await response.json();


                assert.equal(
                    response.status,
                    403
                );

                assert.equal(
                    body.error.code,
                    "GROUP_CREATOR_REQUIRED"
                );
            }
        );
    }
);


test(
    "BE-08: grupo inexistente retorna 404",
    async () => {

        await withApi(
            async ({
                baseUrl,
                failures,
            }) => {

                failures.getById =
                    AppError.notFound(
                        "Grupo não encontrado.",
                        "GROUP_NOT_FOUND"
                    );


                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups/${GROUP_ID}`,
                        {
                            headers:
                                authorizationHeaders(),
                        }
                    );


                const body =
                    await response.json();


                assert.equal(
                    response.status,
                    404
                );

                assert.equal(
                    body.error.code,
                    "GROUP_NOT_FOUND"
                );
            }
        );
    }
);


test(
    "BE-08: limite máximo de participantes retorna 409",
    async () => {

        await withApi(
            async ({
                baseUrl,
                failures,
            }) => {

                failures.addMembers =
                    AppError.conflict(
                        "O grupo não pode possuir mais de 50 participantes.",
                        "GROUP_MAX_MEMBERS_EXCEEDED"
                    );


                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups/${GROUP_ID}/members`,
                        {
                            method:
                                "POST",

                            headers:
                                jsonHeaders(
                                    authorizationHeaders()
                                ),

                            body:
                                JSON.stringify({
                                    memberIds: [
                                        OTHER_MEMBER_ID,
                                    ],
                                }),
                        }
                    );


                const body =
                    await response.json();


                assert.equal(
                    response.status,
                    409
                );

                assert.equal(
                    body.error.code,
                    "GROUP_MAX_MEMBERS_EXCEEDED"
                );
            }
        );
    }
);


test(
    "BE-08: criador não pode sair do grupo",
    async () => {

        await withApi(
            async ({
                baseUrl,
                failures,
            }) => {

                failures.leave =
                    AppError.conflict(
                        "O criador não pode sair do grupo enquanto for o responsável.",
                        "GROUP_CREATOR_CANNOT_LEAVE"
                    );


                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups/${GROUP_ID}/leave`,
                        {
                            method:
                                "POST",

                            headers:
                                authorizationHeaders(),
                        }
                    );


                const body =
                    await response.json();


                assert.equal(
                    response.status,
                    409
                );

                assert.equal(
                    body.error.code,
                    "GROUP_CREATOR_CANNOT_LEAVE"
                );
            }
        );
    }
);

test(
    "BE-08: JSON inválido retorna 400 INVALID_JSON",
    async () => {

        await withApi(
            async ({
                baseUrl,
                calls,
            }) => {

                const response =
                    await fetch(
                        `${baseUrl}/api/v1/groups`,
                        {
                            method:
                                "POST",

                            headers:
                                jsonHeaders(
                                    authorizationHeaders()
                                ),

                            body:
                                "{\"name\":",
                        }
                    );


                const body =
                    await response.json();


                assert.equal(
                    response.status,
                    400
                );

                assert.equal(
                    body.error.code,
                    "INVALID_JSON"
                );

                assert.equal(
                    calls.create.length,
                    0
                );
            }
        );
    }
);
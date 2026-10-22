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
    createGroupService,
} = require("../../../src/services/groups/groupService");

const Conversation =
    require("../../../src/models/mongodb/Conversation");

const ConversationMember =
    require("../../../src/models/mongodb/ConversationMember");

const Message =
    require("../../../src/models/mongodb/Message");


const PASSWORD =
    "SenhaTeste@123";

const testUserIds =
    new Set();

const testGroupIds =
    new Set();

let server;
let baseUrl;


/*
 * =====================================================
 * USUÁRIOS DE TESTE
 * =====================================================
 */

async function createTestUser({
    status = "ACTIVE",
} = {}) {

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
                "BE08 Integration",

            email:
                `be08-${id.slice(0, 8)}@test.local`,

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
        Authorization:
            `Bearer ${token}`,
    };
}


function jsonHeaders(
    token
) {

    return {
        ...authorizationHeaders(
            token
        ),

        "Content-Type":
            "application/json",
    };
}


/*
 * =====================================================
 * API HELPERS
 * =====================================================
 */

function createGroup(
    token,
    {
        name,
        memberIds,
    }
) {

    return fetch(
        `${baseUrl}/api/v1/groups`,
        {
            method:
                "POST",

            headers:
                jsonHeaders(
                    token
                ),

            body:
                JSON.stringify({
                    name,
                    memberIds,
                }),
        }
    );
}


function getGroup(
    token,
    groupId
) {

    return fetch(
        `${baseUrl}/api/v1/groups/${groupId}`,
        {
            headers:
                authorizationHeaders(
                    token
                ),
        }
    );
}


function renameGroup(
    token,
    groupId,
    name
) {

    return fetch(
        `${baseUrl}/api/v1/groups/${groupId}`,
        {
            method:
                "PATCH",

            headers:
                jsonHeaders(
                    token
                ),

            body:
                JSON.stringify({
                    name,
                }),
        }
    );
}


function addMembers(
    token,
    groupId,
    memberIds
) {

    return fetch(
        `${baseUrl}/api/v1/groups/${groupId}/members`,
        {
            method:
                "POST",

            headers:
                jsonHeaders(
                    token
                ),

            body:
                JSON.stringify({
                    memberIds,
                }),
        }
    );
}


function removeMember(
    token,
    groupId,
    userId
) {

    return fetch(
        `${baseUrl}/api/v1/groups/${groupId}/members/${userId}`,
        {
            method:
                "DELETE",

            headers:
                authorizationHeaders(
                    token
                ),
        }
    );
}


function leaveGroup(
    token,
    groupId
) {

    return fetch(
        `${baseUrl}/api/v1/groups/${groupId}/leave`,
        {
            method:
                "POST",

            headers:
                authorizationHeaders(
                    token
                ),
        }
    );
}


async function createGroupBetween(
    creator,
    members,
    name = "Grupo BE08"
) {

    const token =
        await login(
            creator
        );

    const response =
        await createGroup(
            token,
            {
                name,

                memberIds:
                    members.map(
                        member =>
                            member.user_id
                    ),
            }
        );


    const body =
        await response.json();


    assert.equal(
        response.status,
        201
    );


    const groupId =
        body.data.group._id;


    testGroupIds.add(
        groupId
    );


    return {
        groupId,
        token,
        body,
    };
}


/*
 * =====================================================
 * CLEANUP
 * =====================================================
 */

async function cleanup() {

    const groupIds =
        [...testGroupIds]
            .map(
                id =>
                    new mongoose
                        .Types
                        .ObjectId(
                            id
                        )
            );


    if (
        groupIds.length >
        0
    ) {

        await Message.deleteMany({
            conversation_id: {
                $in:
                    groupIds,
            },
        });


        await ConversationMember
            .deleteMany({
                conversation_id: {
                    $in:
                        groupIds,
                },
            });


        await Conversation
            .deleteMany({
                _id: {
                    $in:
                        groupIds,
                },
            });
    }


    testGroupIds.clear();


    if (
        testUserIds.size >
        0
    ) {

        const userIds =
            [...testUserIds];


        await AuthSession.destroy({
            where: {
                user_id:
                    userIds,
            },
        });


        await User.destroy({
            where: {
                user_id:
                    userIds,
            },
        });
    }


    testUserIds.clear();
}


/*
 * =====================================================
 * AMBIENTE
 * =====================================================
 */

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


    await Conversation
        .syncIndexes();

    await ConversationMember
        .syncIndexes();

    await Message
        .syncIndexes();


    const groupService =
        createGroupService();


    const app =
        createApp({
            authService,
            groupService,
        });


    await new Promise(
        resolve => {

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


    if (server) {

        await new Promise(
            (
                resolve,
                reject
            ) => {

                server.close(
                    error => {

                        if (error) {
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
    }


    await mongoose.disconnect();

    await sequelize.close();
});


/*
 * =====================================================
 * CRIAÇÃO DO GRUPO
 * =====================================================
 */

test(
    "INTEGRATION BE-08: criação persiste GROUP com único CREATOR e participantes ACTIVE",

    async () => {

        const creator =
            await createTestUser();

        const member =
            await createTestUser();


        const {
            groupId,
        } =
            await createGroupBetween(
                creator,
                [
                    member,
                ]
            );


        const conversation =
            await Conversation
                .findById(
                    groupId
                );


        assert.ok(
            conversation
        );

        assert.equal(
            conversation.type,
            "GROUP"
        );

        assert.equal(
            conversation.name,
            "Grupo BE08"
        );

        assert.equal(
            conversation.created_by,
            creator.user_id
        );


        const memberships =
            await ConversationMember
                .find({
                    conversation_id:
                        groupId,
                });


        assert.equal(
            memberships.length,
            2
        );


        const creatorMembership =
            memberships.find(
                membership =>
                    membership.user_id ===
                    creator.user_id
            );


        const memberMembership =
            memberships.find(
                membership =>
                    membership.user_id ===
                    member.user_id
            );


        assert.ok(
            creatorMembership
        );

        assert.equal(
            creatorMembership.role,
            "CREATOR"
        );

        assert.equal(
            creatorMembership.status,
            "ACTIVE"
        );


        assert.ok(
            memberMembership
        );

        assert.equal(
            memberMembership.role,
            "MEMBER"
        );

        assert.equal(
            memberMembership.status,
            "ACTIVE"
        );


        assert.equal(
            memberships.filter(
                membership =>
                    membership.role ===
                    "CREATOR"
            ).length,
            1
        );
    }
);


/*
 * =====================================================
 * NOME E AUTORIZAÇÃO
 * =====================================================
 */

test(
    "INTEGRATION BE-08: apenas CREATOR pode alterar o nome do grupo",

    async () => {

        const creator =
            await createTestUser();

        const member =
            await createTestUser();


        const {
            groupId,
            token: creatorToken,
        } =
            await createGroupBetween(
                creator,
                [
                    member,
                ]
            );


        const memberToken =
            await login(
                member
            );


        const denied =
            await renameGroup(
                memberToken,
                groupId,
                "Nome Indevido"
            );


        const deniedBody =
            await denied.json();


        assert.equal(
            denied.status,
            403
        );

        assert.equal(
            deniedBody.error.code,
            "GROUP_CREATOR_REQUIRED"
        );


        const accepted =
            await renameGroup(
                creatorToken,
                groupId,
                "Grupo Renomeado"
            );


        const acceptedBody =
            await accepted.json();


        assert.equal(
            accepted.status,
            200
        );

        assert.equal(
            acceptedBody.data.group.name,
            "Grupo Renomeado"
        );


        const persisted =
            await Conversation
                .findById(
                    groupId
                );


        assert.equal(
            persisted.name,
            "Grupo Renomeado"
        );
    }
);


/*
 * =====================================================
 * ADIÇÃO DE PARTICIPANTE
 * =====================================================
 */

test(
    "INTEGRATION BE-08: CREATOR adiciona novo participante ACTIVE como MEMBER",

    async () => {

        const creator =
            await createTestUser();

        const memberA =
            await createTestUser();

        const memberB =
            await createTestUser();


        const {
            groupId,
            token,
        } =
            await createGroupBetween(
                creator,
                [
                    memberA,
                ]
            );


        const response =
            await addMembers(
                token,
                groupId,
                [
                    memberB.user_id,
                ]
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


        const membership =
            await ConversationMember
                .findOne({
                    conversation_id:
                        groupId,

                    user_id:
                        memberB.user_id,
                });


        assert.ok(
            membership
        );

        assert.equal(
            membership.role,
            "MEMBER"
        );

        assert.equal(
            membership.status,
            "ACTIVE"
        );
    }
);


/*
 * =====================================================
 * REMOÇÃO
 * =====================================================
 */

test(
    "INTEGRATION BE-08: remoção preserva vínculo como REMOVED com auditoria",

    async () => {

        const creator =
            await createTestUser();

        const memberA =
            await createTestUser();


        const {
            groupId,
            token,
        } =
            await createGroupBetween(
                creator,
                [
                    memberA,
                ]
            );


        const response =
            await removeMember(
                token,
                groupId,
                memberA.user_id
            );


        assert.equal(
            response.status,
            204
        );


        const membership =
            await ConversationMember
                .findOne({
                    conversation_id:
                        groupId,

                    user_id:
                        memberA.user_id,
                });


        assert.ok(
            membership
        );

        assert.equal(
            membership.status,
            "REMOVED"
        );

        assert.ok(
            membership.removed_at
                instanceof Date
        );

        assert.equal(
            membership.removed_by,
            creator.user_id
        );

        assert.equal(
            membership.left_at,
            null
        );


        const activeCount =
            await ConversationMember
                .countDocuments({
                    conversation_id:
                        groupId,

                    status:
                        "ACTIVE",
                });


        assert.equal(
            activeCount,
            1
        );
    }
);


/*
 * =====================================================
 * SAÍDA VOLUNTÁRIA
 * =====================================================
 */

test(
    "INTEGRATION BE-08: saída voluntária preserva vínculo como LEFT",

    async () => {

        const creator =
            await createTestUser();

        const memberA =
            await createTestUser();


        const {
            groupId,
        } =
            await createGroupBetween(
                creator,
                [
                    memberA,
                ]
            );


        const memberToken =
            await login(
                memberA
            );


        const response =
            await leaveGroup(
                memberToken,
                groupId
            );


        assert.equal(
            response.status,
            204
        );


        const membership =
            await ConversationMember
                .findOne({
                    conversation_id:
                        groupId,

                    user_id:
                        memberA.user_id,
                });


        assert.ok(
            membership
        );

        assert.equal(
            membership.status,
            "LEFT"
        );

        assert.ok(
            membership.left_at
                instanceof Date
        );

        assert.equal(
            membership.removed_at,
            null
        );

        assert.equal(
            membership.removed_by,
            null
        );


        const activeCount =
            await ConversationMember
                .countDocuments({
                    conversation_id:
                        groupId,

                    status:
                        "ACTIVE",
                });


        assert.equal(
            activeCount,
            1
        );
    }
);

/*
 * =====================================================
 * CRIADOR
 * =====================================================
 */

test(
    "INTEGRATION BE-08: CREATOR não pode sair do grupo no MVP",

    async () => {

        const creator =
            await createTestUser();

        const member =
            await createTestUser();


        const {
            groupId,
            token,
        } =
            await createGroupBetween(
                creator,
                [
                    member,
                ]
            );


        const response =
            await leaveGroup(
                token,
                groupId
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


        const membership =
            await ConversationMember
                .findOne({
                    conversation_id:
                        groupId,

                    user_id:
                        creator.user_id,
                });


        assert.equal(
            membership.role,
            "CREATOR"
        );

        assert.equal(
            membership.status,
            "ACTIVE"
        );
    }
);


/*
 * =====================================================
 * SEGURANÇA
 * =====================================================
 */

test(
    "INTEGRATION BE-08 SECURITY: usuário fora do grupo não consegue consultá-lo",

    async () => {

        const creator =
            await createTestUser();

        const member =
            await createTestUser();

        const outsider =
            await createTestUser();


        const {
            groupId,
        } =
            await createGroupBetween(
                creator,
                [
                    member,
                ]
            );


        const outsiderToken =
            await login(
                outsider
            );


        const response =
            await getGroup(
                outsiderToken,
                groupId
            );


        const body =
            await response.json();


        assert.equal(
            response.status,
            403
        );

        assert.equal(
            body.error.code,
            "GROUP_MEMBERSHIP_REQUIRED"
        );

        assert.equal(
            body.data,
            undefined
        );
    }
);


/*
 * =====================================================
 * USUÁRIO INATIVO
 * =====================================================
 */

test(
    "INTEGRATION BE-08: usuário INACTIVE não pode ser incluído na criação do grupo",

    async () => {

        const creator =
            await createTestUser();

        const inactive =
            await createTestUser({
                status:
                    "INACTIVE",
            });


        const token =
            await login(
                creator
            );


        const response =
            await createGroup(
                token,
                {
                    name:
                        "Grupo com Inativo",

                    memberIds: [
                        inactive.user_id,
                    ],
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
            "GROUP_MEMBERS_INACTIVE"
        );


        const persisted =
            await Conversation
                .findOne({
                    type:
                        "GROUP",

                    name:
                        "Grupo com Inativo",

                    created_by:
                        creator.user_id,
                });


        assert.equal(
            persisted,
            null
        );
    }
);


/*
 * =====================================================
 * VALIDAÇÃO RF09 / REGRAS DE GRUPO
 * =====================================================
 */

test(
    "INTEGRATION BE-08: nome acima de 30 caracteres é rejeitado",

    async () => {

        const creator =
            await createTestUser();

        const member =
            await createTestUser();


        const token =
            await login(
                creator
            );


        const response =
            await createGroup(
                token,
                {
                    name:
                        "A".repeat(
                            31
                        ),

                    memberIds: [
                        member.user_id,
                    ],
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
            "GROUP_NAME_TOO_LONG"
        );
    }
);


test(
    "INTEGRATION BE-08: criação rejeita mais de 50 participantes no total",

    async () => {

        const creator =
            await createTestUser();


        const token =
            await login(
                creator
            );


        /*
         * 50 IDs adicionais +
         * criador = 51.
         *
         * A validação do limite ocorre
         * antes da consulta ao PostgreSQL.
         */
        const memberIds =
            Array.from(
                {
                    length:
                        50,
                },
                () =>
                    randomUUID()
            );


        const response =
            await createGroup(
                token,
                {
                    name:
                        "Grupo Muito Grande",

                    memberIds,
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
            "INVALID_GROUP_SIZE"
        );

        assert.equal(
            body.error.details.total,
            51
        );
    }
);
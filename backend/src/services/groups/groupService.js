const mongoose = require("mongoose");

const AppError = require("../../errors/AppError");

const Conversation =
    require("../../models/mongodb/Conversation");

const ConversationMember =
    require("../../models/mongodb/ConversationMember");

const {
    createGroupConversation,
} = require("../integration/chatPersistenceService");

const {
    assertUsersActive,
} = require("../integration/userIdentityService");


const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GROUP_NAME_MAX_LENGTH = 30;
const GROUP_MIN_MEMBERS = 2;
const GROUP_MAX_MEMBERS = 50;


/*
 * RF09 / RN08
 *
 * O grupo precisa possuir nome e
 * o nome deve possuir no máximo
 * 30 caracteres.
 */
function normalizeGroupName(value) {

    if (
        typeof value !== "string" ||
        !value.trim()
    ) {

        throw AppError.badRequest(
            "Informe o nome do grupo.",
            "GROUP_NAME_REQUIRED"
        );
    }


    const name =
        value.trim();


    if (
        name.length >
        GROUP_NAME_MAX_LENGTH
    ) {

        throw AppError.badRequest(
            "O nome do grupo deve possuir no máximo 30 caracteres.",
            "GROUP_NAME_TOO_LONG",
            {
                maxLength:
                    GROUP_NAME_MAX_LENGTH,
            }
        );
    }


    return name;
}


/*
 * Validação de UUIDs recebidos
 * no payload.
 *
 * O identificador do usuário
 * autenticado nunca é obtido
 * através do body.
 */
function normalizeUserId(
    value,
    field = "userId"
) {

    if (
        typeof value !== "string" ||
        !UUID_REGEX.test(
            value.trim()
        )
    ) {

        throw AppError.badRequest(
            `${field} inválido.`,
            "INVALID_USER_ID",
            {
                field,
            }
        );
    }


    return value
        .trim()
        .toLowerCase();
}


function normalizeMemberIds(
    value,
    {
        required = true,
    } = {}
) {

    if (!Array.isArray(value)) {

        throw AppError.badRequest(
            "memberIds deve ser uma lista de usuários.",
            "INVALID_GROUP_MEMBERS"
        );
    }


    if (
        required &&
        value.length === 0
    ) {

        throw AppError.badRequest(
            "Informe pelo menos um participante.",
            "GROUP_MEMBERS_REQUIRED"
        );
    }


    const memberIds =
        value.map(
            (userId, index) =>
                normalizeUserId(
                    userId,
                    `memberIds[${index}]`
                )
        );


    /*
     * Participantes repetidos no payload
     * contam apenas uma vez.
     */
    return [
        ...new Set(
            memberIds
        ),
    ];
}


function validateGroupSize(total) {

    if (
        total < GROUP_MIN_MEMBERS ||
        total > GROUP_MAX_MEMBERS
    ) {

        throw AppError.badRequest(
            "O grupo deve possuir entre 2 e 50 participantes.",
            "INVALID_GROUP_SIZE",
            {
                min:
                    GROUP_MIN_MEMBERS,

                max:
                    GROUP_MAX_MEMBERS,

                total,
            }
        );
    }
}


/*
 * Converte erros da integração
 * PostgreSQL ↔ MongoDB para erros
 * HTTP conhecidos pela aplicação.
 */
function throwIdentityError(error) {

    if (
        !error ||
        error.name !==
            "PersistenceIntegrationError"
    ) {

        throw error;
    }


    if (
        error.code ===
        "USERS_NOT_FOUND"
    ) {

        throw AppError.badRequest(
            "Existem participantes não cadastrados.",
            "GROUP_MEMBERS_NOT_FOUND",
            error.details
        );
    }


    if (
        error.code ===
        "USERS_INACTIVE"
    ) {

        throw AppError.conflict(
            "Existem participantes inativos.",
            "GROUP_MEMBERS_INACTIVE",
            error.details
        );
    }


    if (
        error.code ===
        "INVALID_GROUP_SIZE"
    ) {

        throw AppError.badRequest(
            error.message,
            error.code,
            error.details
        );
    }


    throw error;
}


function createGroupService({
    ConversationModel =
        Conversation,

    ConversationMemberModel =
        ConversationMember,

    createGroupPersistence =
        createGroupConversation,

    assertActiveUsers =
        assertUsersActive,
} = {}) {


    /*
     * Valida ObjectId recebido
     * pela API.
     */
    function validateGroupId(
        groupId
    ) {

        if (
            !mongoose.isValidObjectId(
                groupId
            )
        ) {

            throw AppError.badRequest(
                "groupId inválido.",
                "INVALID_GROUP_ID"
            );
        }


        return groupId;
    }


    /*
     * Somente conversas GROUP
     * são aceitas nesta camada.
     *
     * Uma conversa PRIVATE não
     * deve poder utilizar endpoints
     * de gerenciamento de grupos.
     */
    async function findGroupOrFail(
        groupId
    ) {

        validateGroupId(
            groupId
        );


        const group =
            await ConversationModel
                .findOne({
                    _id:
                        groupId,

                    type:
                        "GROUP",
                });


        if (!group) {

            throw AppError.notFound(
                "Grupo não encontrado.",
                "GROUP_NOT_FOUND"
            );
        }


        return group;
    }


    async function findActiveMembership({
        groupId,
        userId,
    }) {

        return ConversationMemberModel
            .findOne({
                conversation_id:
                    groupId,

                user_id:
                    userId,

                status:
                    "ACTIVE",
            });
    }


    /*
     * Qualquer membro ACTIVE
     * pode consultar o grupo.
     */
    async function assertActiveMember({
        groupId,
        userId,
    }) {

        const membership =
            await findActiveMembership({
                groupId,
                userId,
            });


        if (!membership) {

            throw AppError.forbidden(
                "Usuário não é membro ativo do grupo.",
                "GROUP_MEMBERSHIP_REQUIRED"
            );
        }


        return membership;
    }


    /*
     * RF09:
     *
     * O MVP possui apenas um
     * responsável pelo grupo.
     *
     * Além do role CREATOR,
     * verificamos created_by para
     * preservar CONV-R05.
     */
    async function assertCreator({
        group,
        userId,
    }) {

        const membership =
            await ConversationMemberModel
                .findOne({
                    conversation_id:
                        group._id,

                    user_id:
                        userId,

                    status:
                        "ACTIVE",

                    role:
                        "CREATOR",
                });


        if (
            !membership ||
            group.created_by !== userId
        ) {

            throw AppError.forbidden(
                "Apenas o criador pode gerenciar o grupo.",
                "GROUP_CREATOR_REQUIRED"
            );
        }


        return membership;
    }


    async function countActiveMembers(
        groupId
    ) {

        return ConversationMemberModel
            .countDocuments({
                conversation_id:
                    groupId,

                status:
                    "ACTIVE",
            });
    }


    /*
     * Forma segura devolvida pela API.
     */
    function serializeGroup(
        group,
        memberships
    ) {

        const raw =
            typeof group.toObject ===
            "function"
                ? group.toObject()
                : group;


        return {
            _id:
                raw._id.toString(),

            type:
                raw.type,

            name:
                raw.name,

            created_by:
                raw.created_by,

            created_at:
                raw.created_at,

            updated_at:
                raw.updated_at,

            members:
                memberships.map(
                    (membership) => ({
                        user_id:
                            membership.user_id,

                        role:
                            membership.role,

                        status:
                            membership.status,

                        joined_at:
                            membership.joined_at,
                    })
                ),
        };
    }


    async function loadGroupView(
        group
    ) {

        const memberships =
            await ConversationMemberModel
                .find({
                    conversation_id:
                        group._id,

                    status:
                        "ACTIVE",
                })
                .sort({
                    joined_at:
                        1,
                })
                .lean();


        return serializeGroup(
            group,
            memberships
        );
    }


    /*
     * POST /api/v1/groups
     *
     * O creatorId sempre será
     * req.user.user_id.
     */
    async function createGroup({
        creatorId,
        input,
    }) {

        const creator =
            normalizeUserId(
                creatorId,
                "creatorId"
            );


        const body =
            input &&
            typeof input === "object"
                ? input
                : {};


        const name =
            normalizeGroupName(
                body.name
            );


        const memberIds =
            normalizeMemberIds(
                body.memberIds
            );


        /*
         * O criador sempre faz
         * parte do grupo.
         */
        const users = [
            ...new Set([
                creator,
                ...memberIds,
            ]),
        ];


        validateGroupSize(
            users.length
        );


        let group;


        try {

            group =
                await createGroupPersistence({
                    creatorId:
                        creator,

                    memberIds,

                    name,
                });

        } catch (error) {

            throwIdentityError(
                error
            );
        }


        return loadGroupView(
            group
        );
    }


    /*
     * GET /api/v1/groups/:groupId
     */
    async function getGroup({
        groupId,
        requesterId,
    }) {

        const userId =
            normalizeUserId(
                requesterId,
                "requesterId"
            );


        const group =
            await findGroupOrFail(
                groupId
            );


        await assertActiveMember({
            groupId:
                group._id,

            userId,
        });


        return loadGroupView(
            group
        );
    }


    /*
     * PATCH /api/v1/groups/:groupId
     */
    async function renameGroup({
        groupId,
        requesterId,
        input,
    }) {

        const userId =
            normalizeUserId(
                requesterId,
                "requesterId"
            );


        const body =
            input &&
            typeof input === "object"
                ? input
                : {};


        const name =
            normalizeGroupName(
                body.name
            );


        const group =
            await findGroupOrFail(
                groupId
            );


        await assertCreator({
            group,
            userId,
        });


        group.name =
            name;


        await group.save();


        return loadGroupView(
            group
        );
    }


    /*
     * POST
     * /api/v1/groups/:groupId/members
     */
    async function addMembers({
        groupId,
        requesterId,
        input,
    }) {

        const userId =
            normalizeUserId(
                requesterId,
                "requesterId"
            );


        const body =
            input &&
            typeof input === "object"
                ? input
                : {};


        const memberIds =
            normalizeMemberIds(
                body.memberIds
            );


        const group =
            await findGroupOrFail(
                groupId
            );


        await assertCreator({
            group,
            userId,
        });


        /*
         * Verificamos qualquer vínculo,
         * inclusive LEFT e REMOVED.
         *
         * O modelo possui índice único
         * conversation_id + user_id.
         */
        const existing =
            await ConversationMemberModel
                .find({
                    conversation_id:
                        group._id,

                    user_id: {
                        $in:
                            memberIds,
                    },
                })
                .lean();


        const existingByUser =
            new Map(
                existing.map(
                    (membership) => [
                        membership.user_id,
                        membership,
                    ]
                )
            );


        const activeAlready =
            memberIds.filter(
                (memberId) =>
                    existingByUser
                        .get(memberId)
                        ?.status ===
                    "ACTIVE"
            );


        if (
            activeAlready.length >
            0
        ) {

            throw AppError.conflict(
                "Um ou mais usuários já pertencem ao grupo.",
                "GROUP_MEMBERS_ALREADY_ACTIVE",
                {
                    user_ids:
                        activeAlready,
                }
            );
        }


        const previousMemberships =
            memberIds.filter(
                (memberId) => {

                    const membership =
                        existingByUser
                            .get(
                                memberId
                            );


                    return (
                        membership &&
                        membership.status !==
                            "ACTIVE"
                    );
                }
            );


        /*
         * A ERS não define a reentrada
         * de LEFT/REMOVED.
         *
         * Não reativamos silenciosamente
         * um vínculo histórico.
         */
        if (
            previousMemberships.length >
            0
        ) {

            throw AppError.conflict(
                "A reentrada de participante que saiu ou foi removido não está disponível no MVP.",
                "GROUP_MEMBER_REENTRY_NOT_SUPPORTED",
                {
                    user_ids:
                        previousMemberships,
                }
            );
        }


        const activeCount =
            await countActiveMembers(
                group._id
            );


        if (
            activeCount +
                memberIds.length >
            GROUP_MAX_MEMBERS
        ) {

            throw AppError.conflict(
                "O grupo não pode possuir mais de 50 participantes.",
                "GROUP_MAX_MEMBERS_EXCEEDED",
                {
                    current:
                        activeCount,

                    adding:
                        memberIds.length,

                    max:
                        GROUP_MAX_MEMBERS,
                }
            );
        }


        try {

            await assertActiveUsers(
                memberIds
            );

        } catch (error) {

            throwIdentityError(
                error
            );
        }


        try {

            await ConversationMemberModel
                .insertMany(
                    memberIds.map(
                        (memberId) => ({
                            conversation_id:
                                group._id,

                            user_id:
                                memberId,

                            role:
                                "MEMBER",

                            status:
                                "ACTIVE",

                            joined_at:
                                new Date(),
                        })
                    )
                );

        } catch (error) {

            if (
                error &&
                error.code === 11000
            ) {

                throw AppError.conflict(
                    "Conflito ao adicionar participantes ao grupo.",
                    "GROUP_MEMBERS_CONFLICT"
                );
            }


            throw error;
        }


        return loadGroupView(
            group
        );
    }


    /*
     * DELETE
     * /api/v1/groups/:groupId/members/:userId
     */
    async function removeMember({
        groupId,
        requesterId,
        memberId,
    }) {

        const creatorId =
            normalizeUserId(
                requesterId,
                "requesterId"
            );


        const targetUserId =
            normalizeUserId(
                memberId,
                "userId"
            );


        const group =
            await findGroupOrFail(
                groupId
            );


        await assertCreator({
            group,
            userId:
                creatorId,
        });


        /*
         * O MVP não possui transferência
         * de responsabilidade.
         */
        if (
            targetUserId ===
            creatorId
        ) {

            throw AppError.conflict(
                "O criador não pode remover a si próprio do grupo.",
                "GROUP_CREATOR_CANNOT_BE_REMOVED"
            );
        }


        const membership =
            await ConversationMemberModel
                .findOne({
                    conversation_id:
                        group._id,

                    user_id:
                        targetUserId,
                });


        if (!membership) {

            throw AppError.notFound(
                "Participante não encontrado no grupo.",
                "GROUP_MEMBER_NOT_FOUND"
            );
        }


        if (
            membership.role ===
            "CREATOR"
        ) {

            throw AppError.conflict(
                "O criador do grupo não pode ser removido.",
                "GROUP_CREATOR_CANNOT_BE_REMOVED"
            );
        }


        if (
            membership.status !==
            "ACTIVE"
        ) {

            throw AppError.conflict(
                "O participante não está ativo no grupo.",
                "GROUP_MEMBER_NOT_ACTIVE"
            );
        }

        membership.status =
            "REMOVED";

        membership.removed_at =
            new Date();

        membership.removed_by =
            creatorId;

        membership.left_at =
            null;


        await membership.save();
    }


    /*
     * POST
     * /api/v1/groups/:groupId/leave
     */
    async function leaveGroup({
        groupId,
        requesterId,
    }) {

        const userId =
            normalizeUserId(
                requesterId,
                "requesterId"
            );


        const group =
            await findGroupOrFail(
                groupId
            );


        const membership =
            await assertActiveMember({
                groupId:
                    group._id,

                userId,
            });


        /*
         * A ERS define apenas um
         * responsável/criador e não
         * define transferência de
         * propriedade no MVP.
         */
        if (
            membership.role ===
                "CREATOR" ||
            group.created_by ===
                userId
        ) {

            throw AppError.conflict(
                "O criador não pode sair do grupo enquanto for o responsável.",
                "GROUP_CREATOR_CANNOT_LEAVE"
            );
        }

        membership.status =
            "LEFT";

        membership.left_at =
            new Date();

        membership.removed_at =
            null;

        membership.removed_by =
            null;


        await membership.save();
    }


    return {
        createGroup,
        getGroup,
        renameGroup,
        addMembers,
        removeMember,
        leaveGroup,
    };
}


module.exports = {
    createGroupService,
};
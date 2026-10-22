function createGroupController({
    groupService,
}) {


    /**
     * POST /api/v1/groups
     *
     * Cria um grupo.
     *
     * O criador nunca vem do body.
     * A identidade é obtida exclusivamente
     * através do usuário autenticado.
     */
    async function create(
        req,
        res
    ) {

        const group =
            await groupService
                .createGroup({
                    creatorId:
                        req.user.user_id,

                    input:
                        req.body,
                });


        return res
            .status(201)
            .json({
                data: {
                    group,
                },
            });
    }


    /**
     * GET /api/v1/groups/:groupId
     *
     * Retorna o grupo e seus
     * participantes ativos.
     *
     * Apenas membro ACTIVE pode consultar.
     */
    async function getById(
        req,
        res
    ) {

        const group =
            await groupService
                .getGroup({
                    groupId:
                        req.params.groupId,

                    requesterId:
                        req.user.user_id,
                });


        return res
            .status(200)
            .json({
                data: {
                    group,
                },
            });
    }


    /**
     * PATCH /api/v1/groups/:groupId
     *
     * Altera o nome do grupo.
     *
     * A autorização do CREATOR
     * é verificada no service.
     */
    async function rename(
        req,
        res
    ) {

        const group =
            await groupService
                .renameGroup({
                    groupId:
                        req.params.groupId,

                    requesterId:
                        req.user.user_id,

                    input:
                        req.body,
                });


        return res
            .status(200)
            .json({
                data: {
                    group,
                },
            });
    }


    /**
     * POST /api/v1/groups/:groupId/members
     *
     * Adiciona um ou mais participantes.
     */
    async function addMembers(
        req,
        res
    ) {

        const group =
            await groupService
                .addMembers({
                    groupId:
                        req.params.groupId,

                    requesterId:
                        req.user.user_id,

                    input:
                        req.body,
                });


        return res
            .status(200)
            .json({
                data: {
                    group,
                },
            });
    }


    /**
     * DELETE
     * /api/v1/groups/:groupId/members/:userId
     *
     * Remove logicamente um participante.
     *
     * O vínculo não é excluído.
     * O service altera para REMOVED.
     */
    async function removeMember(
        req,
        res
    ) {

        await groupService
            .removeMember({
                groupId:
                    req.params.groupId,

                requesterId:
                    req.user.user_id,

                memberId:
                    req.params.userId,
            });


        return res
            .status(204)
            .send();
    }


    /**
     * POST /api/v1/groups/:groupId/leave
     *
     * Saída voluntária do participante.
     *
     * O vínculo é preservado com
     * status LEFT.
     */
    async function leave(
        req,
        res
    ) {

        await groupService
            .leaveGroup({
                groupId:
                    req.params.groupId,

                requesterId:
                    req.user.user_id,
            });


        return res
            .status(204)
            .send();
    }


    return {

        create,

        getById,

        rename,

        addMembers,

        removeMember,

        leave,
    };
}


module.exports = {

    createGroupController,
};
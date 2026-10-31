const express = require("express");

const {
    createGroupController,
} = require("../../controllers/groupController");

const {
    createAuthenticate,
} = require("../../middlewares/authenticate");

const {
    noStore,
} = require(
    "../../middlewares/cacheControl"
);


function createGroupRoutes({
    authService,
    groupService,
}) {

    const router =
        express.Router();


    const authenticate =
        createAuthenticate({
            authService,
        });


    const controller =
        createGroupController({
            groupService,
        });


    /*
     * Todos os endpoints de grupo
     * exigem usuário autenticado.
     */
    router.use(
        noStore,
        authenticate
    );


    /*
     * POST /api/v1/groups
     *
     * Criação de grupo.
     */
    router.post(
        "/",
        controller.create
    );


    /*
     * POST /api/v1/groups/:groupId/members
     *
     * Adiciona participantes.
     */
    router.post(
        "/:groupId/members",
        controller.addMembers
    );


    /*
     * DELETE
     * /api/v1/groups/:groupId/members/:userId
     *
     * Remove logicamente um participante.
     */
    router.delete(
        "/:groupId/members/:userId",
        controller.removeMember
    );


    /*
     * POST /api/v1/groups/:groupId/leave
     *
     * Saída voluntária do grupo.
     */
    router.post(
        "/:groupId/leave",
        controller.leave
    );


    /*
     * GET /api/v1/groups/:groupId
     *
     * Consulta dados e membros ativos.
     */
    router.get(
        "/:groupId",
        controller.getById
    );


    /*
     * PATCH /api/v1/groups/:groupId
     *
     * Alteração do nome do grupo.
     */
    router.patch(
        "/:groupId",
        controller.rename
    );


    return router;
}


module.exports = {

    createGroupRoutes,
};
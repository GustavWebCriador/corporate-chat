const express =
    require(
        "express"
    );


const {
    createAdminUserController,
} = require(
    "../../controllers/adminUserController"
);


const {
    createAuthenticate,
    requireAdmin,
} = require(
    "../../middlewares/authenticate"
);


function createAdminUserRoutes({
    authService,
    userService,
}) {

    const router =
        express.Router();


    const controller =
        createAdminUserController({
            userService,
        });


    const authenticate =
        createAuthenticate({
            authService,
        });

    const {
        noStore,
    } = require(
        "../../middlewares/cacheControl"
    );


    /*
   * O gerenciamento de usuários exige autenticação ativa
   * e privilégio administrativo atual.
   */
    router.use(
        noStore,
        authenticate,
        requireAdmin
    );


    router.post(
        "/",
        controller.create
    );


    router.get(
        "/",
        controller.list
    );


    router.get(
        "/:userId",
        controller.getById
    );


    router.patch(
        "/:userId/status",
        controller.changeStatus
    );


    router.patch(
        "/:userId/password",
        controller.resetPassword
    );


    return router;
}


module.exports = {

    createAdminUserRoutes,
};
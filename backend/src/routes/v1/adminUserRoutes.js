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


    /*
     * Todas as rotas abaixo exigem:
     *
     * 1. usuário autenticado;
     * 2. usuário ACTIVE;
     * 3. privilégio administrativo.
     */
    router.use(
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
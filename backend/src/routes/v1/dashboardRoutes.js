const express =
    require(
        "express"
    );


const {
    createDashboardController,
} = require(
    "../../controllers/dashboardController"
);


const {
    createAuthenticate,
} = require(
    "../../middlewares/authenticate"
);


function createDashboardRoutes({

    authService,

    dashboardService,

}) {

    const router =
        express.Router();


    const controller =
        createDashboardController({
            dashboardService,
        });


    const authenticate =
        createAuthenticate({
            authService,
        });


    /*
     * RF05 / BE-06
     *
     * Dashboard disponível somente
     * para usuários autenticados
     * e ACTIVE.
     *
     * Não exige perfil administrativo.
     */
    router.get(
        "/",
        authenticate,
        controller.getDashboard
    );


    return router;
}


module.exports = {

    createDashboardRoutes,
};
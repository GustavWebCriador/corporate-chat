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

const {
    noStore,
} = require(
    "../../middlewares/cacheControl"
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
    router.use(
        noStore,
        authenticate
    );

    router.get(
        "/",
        controller.getDashboard
    );


    return router;
}


module.exports = {

    createDashboardRoutes,
};
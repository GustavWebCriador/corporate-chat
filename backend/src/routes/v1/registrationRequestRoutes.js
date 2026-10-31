const express =
    require(
        "express"
    );

const {
    createRegistrationRequestController,
} = require(
    "../../controllers/registrationRequestController"
);

const {
    createAuthenticate,
    requireAdmin,
} = require(
    "../../middlewares/authenticate"
);

const {
    createRegistrationRequestRateLimiter,
} = require(
    "../../middlewares/rateLimiters"
);

const {
    noStore,
} = require(
    "../../middlewares/cacheControl"
);


function createRegistrationRequestRoutes({
    registrationRequestService,
}) {
    const router =
        express.Router();


    const controller =
        createRegistrationRequestController({
            registrationRequestService,
        });


    const registrationRequestRateLimiter =
        createRegistrationRequestRateLimiter();


    /*
     * A resposta contém dados informados pelo solicitante
     * e não deve ser armazenada por caches intermediários.
     */
    router.post(
        "/",
        noStore,
        registrationRequestRateLimiter,
        controller.create
    );


    return router;
}


function createAdminRegistrationRequestRoutes({
    authService,
    registrationRequestService,
}) {
    const router =
        express.Router();


    const controller =
        createRegistrationRequestController({
            registrationRequestService,
        });


    const authenticate =
        createAuthenticate({
            authService,
        });


    /*
     * As respostas administrativas contêm dados de usuários
     * e solicitações que não devem permanecer em cache.
     */
    router.use(
        noStore,
        authenticate,
        requireAdmin
    );


    router.get(
        "/",
        controller.list
    );


    router.post(
        "/:requestId/approve",
        controller.approve
    );


    router.post(
        "/:requestId/reject",
        controller.reject
    );


    return router;
}


module.exports = {
    createRegistrationRequestRoutes,
    createAdminRegistrationRequestRoutes,
};
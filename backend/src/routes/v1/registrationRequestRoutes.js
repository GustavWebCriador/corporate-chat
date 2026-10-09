const express = require("express");

const {
    createRegistrationRequestController,
} = require("../../controllers/registrationRequestController");

const {
    createAuthenticate,
    requireAdmin,
} = require("../../middlewares/authenticate");

/**
 * Rota pública (montada em /api/v1/registration-requests):
 *   POST /  solicitar cadastro, sem login
 */
function createRegistrationRequestRoutes({ registrationRequestService }) {
    const router = express.Router();
    const controller = createRegistrationRequestController({
        registrationRequestService,
    });

    router.post("/", controller.create);

    return router;
}

/**
 * Rotas administrativas (montadas em /api/v1/admin/registration-requests).
 * Todas exigem usuário autenticado, ACTIVE e administrador.
 *   GET  /                      listar
 *   POST /:requestId/approve    aprovar (cria o usuário)
 *   POST /:requestId/reject     rejeitar
 */
function createAdminRegistrationRequestRoutes({
    authService,
    registrationRequestService,
}) {
    const router = express.Router();
    const controller = createRegistrationRequestController({
        registrationRequestService,
    });
    const authenticate = createAuthenticate({ authService });

    router.use(authenticate, requireAdmin);

    router.get("/", controller.list);
    router.post("/:requestId/approve", controller.approve);
    router.post("/:requestId/reject", controller.reject);

    return router;
}

module.exports = {
    createRegistrationRequestRoutes,
    createAdminRegistrationRequestRoutes,
};

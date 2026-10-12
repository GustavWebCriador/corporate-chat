const express = require("express");
const { createConversationRoutes } = require("./conversationRoutes");
const { createHealthRoutes } = require("./healthRoutes");
const { createAuthRoutes } = require("./authRoutes");
const { createAdminUserRoutes } = require("./adminUserRoutes");
const {
    createRegistrationRequestRoutes,
    createAdminRegistrationRequestRoutes,
} = require("./registrationRequestRoutes");

/**
 * Roteador raiz da API (montado em /api/v1 pelo app.js).
 * Cada PBI novo registra suas rotas aqui:
 *   router.use("/users", userRoutes);
 */
function createRouter({
    healthService,
    authService,
    userService,
    registrationRequestService,
    conversationService,
}) {
    const router = express.Router();

    router.use(
        "/health",
        createHealthRoutes({ healthService })
    );

    router.use(
        "/auth",
        createAuthRoutes({ authService })
    );

    router.use(
        "/admin/users",
        createAdminUserRoutes({
            authService,
            userService,
        })
    );

    router.use(
        "/registration-requests",
        createRegistrationRequestRoutes({
            registrationRequestService,
        })
    );

    router.use(
        "/admin/registration-requests",
        createAdminRegistrationRequestRoutes({
            authService,
            registrationRequestService,
        })
    );
    router.use(
        "/conversations",
        createConversationRoutes({
            authService,
            conversationService,
        })
    );
    return router;
}

module.exports = { createRouter };

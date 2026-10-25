const express = require("express");

const { createHealthRoutes } = require("./healthRoutes");
const { createAuthRoutes } = require("./authRoutes");
const { createAdminUserRoutes } = require("./adminUserRoutes");

const {
    createRegistrationRequestRoutes,
    createAdminRegistrationRequestRoutes,
} = require("./registrationRequestRoutes");

const {
    createDashboardRoutes,
} = require(
    "./dashboardRoutes"
);

const {
    createConversationRoutes,
} = require("./conversationRoutes");

const {
    createGroupRoutes,
} = require("./groupRoutes");

const {
    createMessageRoutes,
} = require(
    "./messageRoutes"
);


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
    dashboardService,
    conversationService,
    groupService,
    messageService,
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
    "/dashboard",
    createDashboardRoutes({
        authService,
        dashboardService,
        })
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
    router.use(
        "/conversations",
        createMessageRoutes({
            authService,
            messageService,
        })
    );

    router.use(
        "/groups",
        createGroupRoutes({
            authService,
            groupService,
        })
    );

    return router;
}

module.exports = { createRouter };

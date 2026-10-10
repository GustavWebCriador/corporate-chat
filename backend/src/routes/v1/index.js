const express = require("express");

const { createHealthRoutes } = require("./healthRoutes");
const { createAuthRoutes } = require("./authRoutes");
const { createAdminUserRoutes } = require("./adminUserRoutes");

/**
 * Roteador raiz da API (montado em /api/v1 pelo app.js).
 * Cada PBI novo registra suas rotas aqui:
 *   router.use("/users", userRoutes);
 */
function createRouter({
    healthService,
    authService,
    userService,
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

    return router;
}

module.exports = { createRouter };

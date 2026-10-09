const express = require("express");

const { createHealthRoutes } = require("./healthRoutes");
const { createAuthRoutes } = require("./authRoutes");

/**
 * Roteador raiz da API (montado em /api/v1 pelo app.js).
 * Cada PBI novo registra suas rotas aqui:
 *   router.use("/users", userRoutes);
 */
function createRouter({ healthService, authService }) {
    const router = express.Router();


    router.use("/health", createHealthRoutes({ healthService }));
    router.use("/auth", createAuthRoutes({ authService }));

    return router;
}

module.exports = { createRouter };

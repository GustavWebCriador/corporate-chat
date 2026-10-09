const express = require("express");

const { createHealthController } = require("../controllers/healthController");
const { createAuthRoutes } = require("./authRoutes");

/**
 * Roteador raiz da API (montado em /api/v1 pelo app.js).
 * Cada PBI novo registra suas rotas aqui:
 *   router.use("/users", userRoutes);
 */
function createRouter({ healthService, authService }) {
    const router = express.Router();
    const healthController = createHealthController({ healthService });

    router.get("/health", healthController.getHealth);
    router.use("/auth", createAuthRoutes({ authService }));

    return router;
}

module.exports = { createRouter };

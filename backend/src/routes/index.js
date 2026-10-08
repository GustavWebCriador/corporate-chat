const express = require("express");

const { createHealthController } = require("../controllers/healthController");

/**
 * Roteador raiz da API (montado em /api/v1 pelo app.js).
 * Cada PBI novo registra suas rotas aqui:
 *   router.use("/auth", authRoutes);
 *   router.use("/users", userRoutes);
 */
function createRouter({ healthService }) {
    const router = express.Router();
    const healthController = createHealthController({ healthService });

    router.get("/health", healthController.getHealth);

    return router;
}

module.exports = { createRouter };
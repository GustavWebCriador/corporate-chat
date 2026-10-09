const express = require("express");

const { createHealthController } = require("../../controllers/healthController");

/**
 * Rotas de saúde (montadas em /api/v1/health).
 *   GET /  (pública)
 */
function createHealthRoutes({ healthService }) {
    const router = express.Router();
    const controller = createHealthController({ healthService });

    router.get("/", controller.getHealth);

    return router;
}

module.exports = { createHealthRoutes };

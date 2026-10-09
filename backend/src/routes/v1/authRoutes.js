const express = require("express");

const { createAuthController } = require("../../controllers/authController");
const { createAuthenticate } = require("../../middlewares/authenticate");

/**
 * Rotas de autenticação (montadas em /api/v1/auth).
 *   POST /login  (pública)
 *   GET  /me     (exige token)
 */
function createAuthRoutes({ authService }) {
    const router = express.Router();
    const controller = createAuthController({ authService });
    const authenticate = createAuthenticate({ authService });

    router.post("/login", controller.login);
    router.get("/me", authenticate, controller.me);

    return router;
}

module.exports = { createAuthRoutes };

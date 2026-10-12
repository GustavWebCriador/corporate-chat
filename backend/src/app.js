const express = require("express");
const cors = require("cors");

const { createRouter } = require("./routes/v1");

const { healthService: defaultHealthService } = require("./services/health/healthService");
const { authService: defaultAuthService } = require("./services/auth/authService");
const {userService: defaultUserService, } = require("./services/users/userService");
const {
    registrationRequestService: defaultRegistrationRequestService,
} = require("./services/registrationRequests/registrationRequestService");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

const API_PREFIX = "/api/v1";

const {
    createConversationService,
} = require("./services/conversationService");
const defaultConversationService = createConversationService();

function buildCorsOptions() {
    const raw = process.env.CORS_ORIGIN;

    if (raw) {
        return { origin: raw.split(",").map((origin) => origin.trim()).filter(Boolean) };
    }

    // Sem CORS_ORIGIN: liberado só fora de produção (o hardening final é o BE-12).
    return { origin: process.env.NODE_ENV !== "production" };
}

/**
 * Monta a aplicação Express sem abrir porta nem conectar em banco, para que
 * possa ser testada com facilidade. `healthService` e `authService` podem ser
 * injetados nos testes.
 */
function createApp({
    healthService = defaultHealthService,
    authService = defaultAuthService,
    userService = defaultUserService,
    registrationRequestService = defaultRegistrationRequestService,
    conversationService = defaultConversationService,
} = {}) {
    const app = express();

    app.disable("x-powered-by");

    app.use(cors(buildCorsOptions()));
    app.use(express.json({ limit: "100kb" }));

    app.use(API_PREFIX, createRouter({
        healthService,
        authService,
        userService,
        registrationRequestService,
        conversationService,
    }));

    app.use(notFound);
    app.use(errorHandler);

    return app;
}

module.exports = { createApp, API_PREFIX };

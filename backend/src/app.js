const express = require("express");
const cors = require("cors");

const { createRouter } = require("./routes/v1");

const { healthService: defaultHealthService } = require("./services/health/healthService");
const { authService: defaultAuthService } = require("./services/auth/authService");
const { userService: defaultUserService, } = require("./services/users/userService");
const { registrationRequestService: defaultRegistrationRequestService, } = require("./services/registrationRequests/registrationRequestService");
const { dashboardService: defaultDashboardService, } = require("./services/dashboard/dashboardService");


const { createMessageService, } = require("./services/messages/messageService");
const { createConversationService, } = require("./services/conversations/conversationService");
const { createGroupService, } = require("./services/groups/groupService");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const { buildCorsOptions, } = require("./config/cors");
const { createSecurityHeaders, } = require("./middlewares/securityHeaders");

const API_PREFIX = "/api/v1";

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
    dashboardService = defaultDashboardService,
    conversationService = createConversationService(),
    groupService = createGroupService(),
    messageService = createMessageService(),
} = {}) {
    const app = express();

    app.disable(
        "x-powered-by"
    );


    /*
     * Headers de segurança devem ser aplicados
     * antes das rotas da aplicação.
     */
    app.use(
        createSecurityHeaders()
    );


    app.use(
        cors(
            buildCorsOptions()
        )
    );


    app.use(
        express.json({
            limit:
                "100kb",
        })
    );

    app.use(
        API_PREFIX,

        createRouter({
            healthService,
            authService,
            userService,
            registrationRequestService,
            dashboardService,
            conversationService,
            groupService,
            messageService,
        })
    );

    app.use(notFound);
    app.use(errorHandler);

    return app;
}

module.exports = { createApp, API_PREFIX };

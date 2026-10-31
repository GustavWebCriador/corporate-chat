const express = require("express");

const {
    createConversationController,
} = require("../../controllers/conversationController");

const {
    createAuthenticate,
} = require("../../middlewares/authenticate");

const {
    noStore,
} = require(
    "../../middlewares/cacheControl"
);


function createConversationRoutes({
    authService,
    conversationService,
}) {
    const router = express.Router();

    const authenticate = createAuthenticate({
        authService,
    });

    const controller = createConversationController({
        conversationService,
    });

    router.use(noStore, authenticate);

    router.post("/private", controller.createPrivate);

    router.get("/", controller.list);

    router.get("/:conversationId/messages", controller.history);

    return router;
}

module.exports = {
    createConversationRoutes,
};
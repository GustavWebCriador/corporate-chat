const express =
    require("express");

const {
    createMessageController,
} = require(
    "../../controllers/messageController"
);

const {
    createAuthenticate,
} = require(
    "../../middlewares/authenticate"
);


function createMessageRoutes({
    authService,
    messageService,
}) {
    const router =
        express.Router();


    const authenticate =
        createAuthenticate({
            authService,
        });


    const controller =
        createMessageController({
            messageService,
        });


    /*
     * Todos os endpoints da BE-09
     * exigem usuário autenticado.
     */
    router.use(
        authenticate
    );


    /*
     * Envio de mensagem.
     */
    router.post(
        "/:conversationId/messages",
        controller.send
    );


    /*
     * ACK de entrega.
     */
    router.patch(
        "/:conversationId/delivery",
        controller.markDelivered
    );


    /*
     * ACK de leitura.
     */
    router.patch(
        "/:conversationId/read",
        controller.markRead
    );


    return router;
}


module.exports = {
    createMessageRoutes,
};
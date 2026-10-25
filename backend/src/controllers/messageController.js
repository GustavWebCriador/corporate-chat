function createMessageController({
    messageService,
}) {
    /*
     * POST
     * /api/v1/conversations/:conversationId/messages
     */
    async function send(
        req,
        res,
        next
    ) {
        try {
            const result =
                await messageService
                    .sendMessage({
                        conversationId:
                            req.params
                                .conversationId,

                        senderId:
                            req.user
                                .user_id,

                        clientMessageId:
                            req.body
                                ?.clientMessageId,

                        content:
                            req.body
                                ?.content,
                    });


            /*
             * Primeira persistência:
             * 201 Created
             *
             * Reenvio idempotente:
             * 200 OK
             */
            return res
                .status(
                    result.reused
                        ? 200
                        : 201
                )
                .json({
                    data: {
                        message:
                            result.message,

                        reused:
                            result.reused,
                    },
                });

        } catch (error) {
            return next(
                error
            );
        }
    }


    /*
     * PATCH
     * /api/v1/conversations/:conversationId/delivery
     *
     * Body:
     * {
     *   "messageId": "..."
     * }
     */
    async function markDelivered(
        req,
        res,
        next
    ) {
        try {
            const result =
                await messageService
                    .markDelivered({
                        conversationId:
                            req.params
                                .conversationId,

                        userId:
                            req.user
                                .user_id,

                        messageId:
                            req.body
                                ?.messageId,
                    });


            return res
                .status(200)
                .json({
                    data: result,
                });

        } catch (error) {
            return next(
                error
            );
        }
    }


    /*
     * PATCH
     * /api/v1/conversations/:conversationId/read
     *
     * Body:
     * {
     *   "messageId": "..."
     * }
     */
    async function markRead(
        req,
        res,
        next
    ) {
        try {
            const result =
                await messageService
                    .markRead({
                        conversationId:
                            req.params
                                .conversationId,

                        userId:
                            req.user
                                .user_id,

                        messageId:
                            req.body
                                ?.messageId,
                    });


            return res
                .status(200)
                .json({
                    data: result,
                });

        } catch (error) {
            return next(
                error
            );
        }
    }


    return {
        send,
        markDelivered,
        markRead,
    };
}


module.exports = {
    createMessageController,
};
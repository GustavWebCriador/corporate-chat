const {
    REALTIME_EVENTS,
} = require(
    "./events"
);

const {
    toAckError,
    resolveAck,
} = require(
    "./ack"
);


function registerSyncHandlers({
    socket,
    syncService,
}) {
    if (!socket) {
        throw new TypeError(
            "socket é obrigatório."
        );
    }


    if (
        !syncService ||
        typeof syncService
            .syncConversation !==
            "function"
    ) {
        throw new TypeError(
            "syncService inválido."
        );
    }


    socket.on(
        REALTIME_EVENTS.SYNC,

        async (
            payload,
            acknowledgement
        ) => {

            const ack =
                resolveAck(
                    acknowledgement
                );


            try {
                const body =
                    payload &&
                    typeof payload ===
                        "object" &&
                    !Array.isArray(
                        payload
                    )
                        ? payload
                        : {};


                /*
                 * Segurança:
                 * identidade sempre do JWT.
                 */
                const userId =
                    socket
                        .data
                        .user
                        .user_id;


                const result =
                    await syncService
                        .syncConversation({
                            conversationId:
                                body
                                    .conversationId,

                            userId,

                            afterMessageId:
                                body
                                    .afterMessageId ??
                                null,

                            limit:
                                body
                                    .limit,
                        });


                return ack({
                    ok:
                        true,

                    data:
                        result,
                });

            } catch (error) {

                return ack({
                    ok:
                        false,

                    error:
                        toAckError(
                            error
                        ),
                });
            }
        }
    );
}


module.exports = {
    registerSyncHandlers,
};
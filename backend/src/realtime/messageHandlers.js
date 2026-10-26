const AppError =
    require(
        "../errors/AppError"
    );

const {
    REALTIME_EVENTS,
} = require(
    "./events"
);

const {
    getUserRooms,
} = require(
    "./rooms"
);

const {
    toAckError,
    resolveAck,
} = require(
    "./ack"
);

/*
 * =====================================================
 * HANDLERS DE MENSAGEM
 * =====================================================
 */

function registerMessageHandlers({
    io,
    socket,
    messageService,
    audienceService,
}) {
    if (!io) {
        throw new TypeError(
            "io é obrigatório."
        );
    }


    if (!socket) {
        throw new TypeError(
            "socket é obrigatório."
        );
    }


    if (
        !messageService ||
        typeof messageService
            .sendMessage !==
        "function"
    ) {
        throw new TypeError(
            "messageService inválido."
        );
    }


    if (
        !audienceService ||
        typeof audienceService
            .getActiveUserIds !==
        "function"
    ) {
        throw new TypeError(
            "audienceService inválido."
        );
    }


    socket.on(
        REALTIME_EVENTS.MESSAGE_SEND,

        async (
            payload,
            acknowledgement
        ) => {

            /*
             * ACK é opcional no protocolo.
             *
             * Não podemos assumir que todo
             * cliente enviará callback.
             */
            const ack =
                typeof acknowledgement ===
                    "function"
                    ? acknowledgement
                    : () => { };


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
                 * SEGURANÇA:
                 *
                 * senderId NUNCA vem do payload.
                 *
                 * A identidade foi autenticada
                 * durante o handshake da BE-10.
                 */
                const senderId =
                    socket
                        .data
                        .user
                        .user_id;


                /*
                 * Fonte única da regra de negócio:
                 * messageService da BE-09.
                 */
                const result =
                    await messageService
                        .sendMessage({
                            conversationId:
                                body
                                    .conversationId,

                            senderId,

                            clientMessageId:
                                body
                                    .clientMessageId,

                            content:
                                body
                                    .content,
                        });


                /*
                 * Somente membros atualmente
                 * ACTIVE recebem a mensagem.
                 */
                const activeUserIds =
                    await audienceService
                        .getActiveUserIds(
                            result
                                .message
                                .conversation_id
                        );


                const rooms =
                    getUserRooms(
                        activeUserIds
                    );


                /*
                 * Usamos io.to(), não socket.to().
                 *
                 * Assim o próprio remetente também
                 * recebe message:new em todas as
                 * abas/dispositivos conectados.
                 */
                if (
                    rooms.length >
                    0
                ) {
                    io
                        .to(
                            rooms
                        )
                        .emit(
                            REALTIME_EVENTS
                                .MESSAGE_NEW,
                            {
                                message:
                                    result
                                        .message,
                            }
                        );
                }


                /*
                 * ACK confirma ao dispositivo
                 * que iniciou a operação que a
                 * mensagem foi persistida.
                 */
                return ack({
                    ok:
                        true,

                    data: {
                        message:
                            result.message,

                        reused:
                            result.reused,
                    },
                });

            } catch (error) {

                /*
                 * Não fazemos emit de message:new
                 * quando qualquer etapa falha.
                 */
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
    /*
 * =================================================
 * ENTREGA
 * =================================================
 */

    socket.on(
        REALTIME_EVENTS
            .MESSAGE_DELIVERED,

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
                 * A identidade responsável pelo
                 * checkpoint vem exclusivamente
                 * da conexão autenticada.
                 */
                const userId =
                    socket
                        .data
                        .user
                        .user_id;


                const result =
                    await messageService
                        .markDelivered({
                            conversationId:
                                body
                                    .conversationId,

                            userId,

                            messageId:
                                body
                                    .messageId,
                        });


                /*
                 * Utilizamos o conversation_id
                 * retornado pelo próprio checkpoint,
                 * já validado pela service.
                 */
                const conversationId =
                    result
                        .checkpoint
                        .conversation_id;


                const activeUserIds =
                    await audienceService
                        .getActiveUserIds(
                            conversationId
                        );


                const rooms =
                    getUserRooms(
                        activeUserIds
                    );


                if (
                    rooms.length >
                    0
                ) {
                    io
                        .to(
                            rooms
                        )
                        .emit(
                            REALTIME_EVENTS
                                .MESSAGE_DELIVERY_UPDATE,
                            {
                                checkpoint:
                                    result
                                        .checkpoint,

                                advanced:
                                    result
                                        .advanced,
                            }
                        );
                }


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
    /*
 * =================================================
 * LEITURA
 * =================================================
 */

    socket.on(
        REALTIME_EVENTS
            .MESSAGE_READ,

        async (
            payload,
            acknowledgement
        ) => {

            const ack =
                typeof acknowledgement ===
                    "function"
                    ? acknowledgement
                    : () => { };


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


                const userId =
                    socket
                        .data
                        .user
                        .user_id;


                const result =
                    await messageService
                        .markRead({
                            conversationId:
                                body
                                    .conversationId,

                            userId,

                            messageId:
                                body
                                    .messageId,
                        });


                const conversationId =
                    result
                        .checkpoint
                        .conversation_id;


                const activeUserIds =
                    await audienceService
                        .getActiveUserIds(
                            conversationId
                        );


                const rooms =
                    getUserRooms(
                        activeUserIds
                    );


                if (
                    rooms.length >
                    0
                ) {
                    io
                        .to(
                            rooms
                        )
                        .emit(
                            REALTIME_EVENTS
                                .MESSAGE_READ_UPDATE,
                            {
                                checkpoint:
                                    result
                                        .checkpoint,

                                advanced:
                                    result
                                        .advanced,

                                deliveryAdvanced:
                                    result
                                        .deliveryAdvanced,
                            }
                        );
                }


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
    registerMessageHandlers,
};
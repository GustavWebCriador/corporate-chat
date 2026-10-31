const {
    Server,
} = require(
    "socket.io"
);

const AppError =
    require(
        "../errors/AppError"
    );

const {
    authService:
    defaultAuthService,
} = require(
    "../services/auth/authService"
);

const {
    buildCorsOptions,
    buildSocketAllowRequest,
} = require(
    "../config/cors"
);

const {
    createConnectionRegistry,
} = require(
    "./connectionRegistry"
);

const {
    getUserRoom,
} = require(
    "./rooms"
);

const {
    REALTIME_EVENTS,
} = require(
    "./events"
);

const {
    createMessageService,
} = require(
    "../services/messages/messageService"
);

const {
    createRealtimeAudienceService,
} = require(
    "./realtimeAudienceService"
);

const {
    registerMessageHandlers,
} = require(
    "./messageHandlers"
);

const {
    createRealtimeSyncService,
} = require(
    "./realtimeSyncService"
);

const {
    registerSyncHandlers,
} = require(
    "./syncHandlers"
);


const AUTH_CONNECTION_CODES =
    new Set([
        "TOKEN_MISSING",
        "TOKEN_INVALID",
        "TOKEN_EXPIRED",
        "TOKEN_REVOKED",
        "USER_INACTIVE",
    ]);


function toConnectionError(
    error
) {
    const connectionError =
        new Error(
            "Não foi possível autenticar a conexão."
        );


    const safeCode =
        error &&
            error.isOperational &&
            AUTH_CONNECTION_CODES
                .has(
                    error.code
                )
            ? error.code
            : "SOCKET_AUTH_ERROR";


    connectionError.data = {
        code:
            safeCode,
    };


    return connectionError;
}


function createSocketServer(
    httpServer,
    {
        authService =
            defaultAuthService,

        connectionRegistry =
            createConnectionRegistry(),

        messageService =
            createMessageService(),

        audienceService =
            createRealtimeAudienceService(),

        syncService =
            createRealtimeSyncService(),

    } = {}
) {
    if (!httpServer) {
        throw new TypeError(
            "httpServer é obrigatório para inicializar Socket.IO."
        );
    }


    const io =
        new Server(
            httpServer,
            {
                cors:
                    buildCorsOptions(),

                /*
                 * A validação explícita da Origin também cobre
                 * conexões que utilizam diretamente WebSocket.
                 */
                allowRequest:
                    buildSocketAllowRequest(),

                serveClient:
                    false,

                connectionStateRecovery: {
                    maxDisconnectionDuration:
                        2 * 60 * 1000,

                    /*
                     * A recuperação não deve ignorar a autenticação,
                     * pois a sessão pode ter sido revogada no intervalo.
                     */
                    skipMiddlewares:
                        false,
                },
            }
        );


    io.use(
        async (
            socket,
            next
        ) => {
            try {
                const token =
                    socket
                        .handshake
                        ?.auth
                        ?.token;


                if (
                    typeof token !==
                        "string" ||
                    token.trim()
                        .length === 0
                ) {
                    throw AppError
                        .unauthorized(
                            "Token de autenticação ausente.",
                            "TOKEN_MISSING"
                        );
                }


                const user =
                    await authService
                        .authenticateToken(
                            token.trim()
                        );


                /*
                 * Os handlers realtime usam exclusivamente a
                 * identidade validada pelo servidor.
                 */
                socket.data.user =
                    user;


                return next();

            } catch (error) {
                return next(
                    toConnectionError(
                        error
                    )
                );
            }
        }
    );


    io.on(
        "connection",
        socket => {
            const userId =
                socket
                    .data
                    .user
                    .user_id;


            connectionRegistry
                .add(
                    userId,
                    socket.id
                );


            socket.join(
                getUserRoom(
                    userId
                )
            );


            socket.emit(
                REALTIME_EVENTS.READY,
                {
                    recovered:
                        Boolean(
                            socket.recovered
                        ),

                    connectedAt:
                        new Date()
                            .toISOString(),
                }
            );


            registerMessageHandlers({
                io,
                socket,
                messageService,
                audienceService,
            });


            registerSyncHandlers({
                socket,
                syncService,
            });


            /*
             * Socket.IO remove automaticamente o socket das rooms,
             * mas o registry da aplicação precisa ser atualizado.
             */
            socket.on(
                "disconnect",
                () => {
                    connectionRegistry
                        .remove(
                            userId,
                            socket.id
                        );
                }
            );
        }
    );


    return io;
}


module.exports = {
    createSocketServer,
};
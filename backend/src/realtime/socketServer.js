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

const AUTH_CONNECTION_CODES =
    new Set([
        "TOKEN_MISSING",
        "TOKEN_INVALID",
        "TOKEN_EXPIRED",
        "TOKEN_REVOKED",
        "USER_INACTIVE",
    ]);


/*
 * =====================================================
 * ERROS DE AUTENTICAÇÃO DO SOCKET
 * =====================================================
 */

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


/*
 * =====================================================
 * SOCKET.IO SERVER
 * =====================================================
 */

function createSocketServer(
    httpServer,
    {
        authService =
        defaultAuthService,

        connectionRegistry =
        createConnectionRegistry(),
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
                 * O frontend possuirá sua própria
                 * dependência socket.io-client.
                 *
                 * O backend não precisa disponibilizar
                 * /socket.io/socket.io.js.
                 */
                serveClient:
                    false,
            }
        );

    /*
     * =================================================
     * AUTENTICAÇÃO DA CONEXÃO
     * =================================================
     *
     * Cliente:
     *
     * io(url, {
     *     auth: {
     *         token,
     *     },
     * });
     *
     * Não utilizamos query string para JWT.
     */
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


                /*
                 * Reutiliza exatamente a mesma
                 * validação utilizada pela API HTTP.
                 *
                 * Isso verifica:
                 *
                 * - assinatura JWT;
                 * - expiração;
                 * - sub;
                 * - jti;
                 * - sessão PostgreSQL;
                 * - revogação;
                 * - usuário atual;
                 * - status ACTIVE.
                 */
                const user =
                    await authService
                        .authenticateToken(
                            token.trim()
                        );


                /*
                 * Disponibilizamos a identidade
                 * autenticada para os próximos
                 * handlers realtime.
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


    /*
     * A BE-10 apenas estabelece a conexão
     * autenticada.
     *
     * Eventos de conversa/mensagem serão
     * registrados nas próximas etapas.
     */
    io.on(
        "connection",
        socket => {

            /*
             * A identidade já foi validada
             * pelo middleware de autenticação.
             */
            const userId =
                socket
                    .data
                    .user
                    .user_id;


            /*
             * Registra esta conexão física.
             *
             * Um mesmo usuário pode possuir
             * vários socket.id simultâneos.
             */
            connectionRegistry
                .add(
                    userId,
                    socket.id
                );


            /*
             * Sala privada do usuário.
             *
             * Permitirá futuramente enviar
             * eventos para todas as conexões
             * pertencentes à mesma identidade.
             */
            socket.join(
                getUserRoom(
                    userId
                )
            );


            /*
             * Socket.IO remove automaticamente
             * o socket de suas rooms durante
             * a desconexão.
             *
             * Nosso registry precisa remover
             * explicitamente a referência.
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
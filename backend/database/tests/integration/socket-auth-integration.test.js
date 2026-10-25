require("dotenv").config();

const {
    test,
    before,
    after,
    afterEach,
} = require("node:test");

const assert =
    require("node:assert/strict");

const {
    randomUUID,
} = require("node:crypto");

const {
    createServer,
} = require("node:http");

const bcrypt =
    require("bcryptjs");

const {
    io: createClient,
} = require("socket.io-client");

const {
    sequelize,
    User,
    AuthSession,
} = require(
    "../../../src/models/postgres"
);

const {
    createAuthService,
} = require(
    "../../../src/services/auth/authService"
);

const {
    createSocketServer,
} = require(
    "../../../src/realtime/socketServer"
);


/*
 * =====================================================
 * CONSTANTES
 * =====================================================
 */

const PASSWORD =
    "SenhaSocket123";


/*
 * =====================================================
 * CONTROLE DE CLEANUP
 * =====================================================
 */

const createdUserIds =
    new Set();


/*
 * =====================================================
 * SERVICE REAL
 * =====================================================
 */

const authService =
    createAuthService();


/*
 * =====================================================
 * USUÁRIO DE TESTE
 * =====================================================
 */

async function createTestUser({
    status = "ACTIVE",
} = {}) {
    const userId =
        randomUUID();

    const passwordHash =
        await bcrypt.hash(
            PASSWORD,
            4
        );

    const user =
        await User.create({
            user_id:
                userId,

            name:
                "Socket Integration User",

            email:
                `socket-${userId.slice(0, 8)}@test.local`,

            password_hash:
                passwordHash,

            status,

            is_admin:
                false,
        });


    createdUserIds.add(
        user.user_id
    );


    return user;
}


/*
 * =====================================================
 * LOGIN REAL
 * =====================================================
 */

async function login(
    user
) {
    const result =
        await authService
            .login({
                email:
                    user.email,

                password:
                    PASSWORD,
            });


    return result.token;
}


/*
 * =====================================================
 * SOCKET SERVER REAL
 * =====================================================
 */

async function createRealtimeServer() {
    const httpServer =
        createServer();


    const io =
        createSocketServer(
            httpServer,
            {
                authService,
            }
        );


    await new Promise(
        (
            resolve,
            reject
        ) => {

            httpServer.once(
                "error",
                reject
            );


            httpServer.listen(
                0,
                "127.0.0.1",
                () => {

                    httpServer.off(
                        "error",
                        reject
                    );

                    resolve();
                }
            );
        }
    );


    const address =
        httpServer.address();


    return {
        httpServer,
        io,

        url:
            `http://127.0.0.1:${address.port}`,
    };
}


/*
 * =====================================================
 * CLIENTE
 * =====================================================
 */

function createTestClient(
    url,
    token
) {
    return createClient(
        url,
        {
            autoConnect:
                false,

            forceNew:
                true,

            reconnection:
                false,

            timeout:
                2000,

            transports: [
                "websocket",
            ],

            auth: {
                token,
            },
        }
    );
}


function waitForConnect(
    client
) {
    return new Promise(
        (
            resolve,
            reject
        ) => {

            client.once(
                "connect",
                resolve
            );


            client.once(
                "connect_error",
                reject
            );


            client.connect();
        }
    );
}


function waitForConnectError(
    client
) {
    return new Promise(
        (
            resolve,
            reject
        ) => {

            client.once(
                "connect_error",
                resolve
            );


            client.once(
                "connect",
                () => {

                    reject(
                        new Error(
                            "A conexão deveria ter sido rejeitada."
                        )
                    );
                }
            );


            client.connect();
        }
    );
}


/*
 * =====================================================
 * FECHAMENTO
 * =====================================================
 */

async function closeRealtime({
    client,
    io,
    httpServer,
}) {
    if (client) {
        client.removeAllListeners();
        client.disconnect();
    }


    if (io) {
        await new Promise(
            resolve => {

                io.close(
                    () =>
                        resolve()
                );
            }
        );
    }


    if (
        httpServer &&
        httpServer.listening
    ) {
        await new Promise(
            (
                resolve,
                reject
            ) => {

                httpServer.close(
                    error => {

                        if (
                            error &&
                            error.code !==
                                "ERR_SERVER_NOT_RUNNING"
                        ) {
                            reject(
                                error
                            );

                            return;
                        }


                        resolve();
                    }
                );
            }
        );
    }
}


/*
 * =====================================================
 * SETUP
 * =====================================================
 */

before(
    async () => {

        if (
            process.env.NODE_ENV !==
            "development"
        ) {
            throw new Error(
                "Este teste deve executar somente no ambiente development."
            );
        }


        await sequelize
            .authenticate();
    }
);


/*
 * =====================================================
 * CLEANUP
 * =====================================================
 */

afterEach(
    async () => {

        if (
            createdUserIds.size ===
            0
        ) {
            return;
        }


        const userIds =
            [
                ...createdUserIds,
            ];


        /*
         * FK de auth_sessions -> users.
         *
         * Sessões precisam ser removidas
         * antes dos usuários.
         */
        await AuthSession.destroy({
            where: {
                user_id:
                    userIds,
            },
        });


        await User.destroy({
            where: {
                user_id:
                    userIds,
            },
        });


        createdUserIds.clear();
    }
);


after(
    async () => {

        if (
            createdUserIds.size >
            0
        ) {
            const userIds =
                [
                    ...createdUserIds,
                ];


            await AuthSession.destroy({
                where: {
                    user_id:
                        userIds,
                },
            });


            await User.destroy({
                where: {
                    user_id:
                        userIds,
                },
            });
        }


        await sequelize.close();
    }
);


/*
 * =====================================================
 * CONEXÃO REAL
 * =====================================================
 */

test(
    "BE-10 INTEGRATION: JWT e sessão reais autenticam conexão Socket.IO",

    async () => {

        const user =
            await createTestUser();


        const token =
            await login(
                user
            );


        const context =
            await createRealtimeServer();


        const serverUserPromise =
            new Promise(
                resolve => {

                    context.io.once(
                        "connection",
                        socket => {

                            resolve(
                                socket
                                    .data
                                    .user
                            );
                        }
                    );
                }
            );


        const client =
            createTestClient(
                context.url,
                token
            );


        try {

            await waitForConnect(
                client
            );


            const authenticatedUser =
                await serverUserPromise;


            assert.equal(
                client.connected,
                true
            );


            assert.equal(
                authenticatedUser
                    .user_id,

                user.user_id
            );


            assert.equal(
                authenticatedUser
                    .email,

                user.email
            );


            assert.equal(
                authenticatedUser
                    .status,

                "ACTIVE"
            );


            const sessions =
                await AuthSession
                    .findAll({
                        where: {
                            user_id:
                                user.user_id,
                        },
                    });


            assert.equal(
                sessions.length,
                1
            );


            assert.equal(
                sessions[0]
                    .revoked_at,

                null
            );

        } finally {

            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);


/*
 * =====================================================
 * LOGOUT / REVOGAÇÃO
 * =====================================================
 */

test(
    "BE-10 INTEGRATION SECURITY: sessão revogada por logout bloqueia nova conexão Socket.IO",

    async () => {

        const user =
            await createTestUser();


        const token =
            await login(
                user
            );


        /*
         * Revoga a sessão real no PostgreSQL.
         */
        await authService
            .logout(
                token
            );


        const session =
            await AuthSession
                .findOne({
                    where: {
                        user_id:
                            user.user_id,
                    },
                });


        assert.ok(
            session
                .revoked_at
        );


        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                token
            );


        try {

            const error =
                await waitForConnectError(
                    client
                );


            assert.equal(
                error.data.code,
                "TOKEN_REVOKED"
            );


            assert.equal(
                client.connected,
                false
            );

        } finally {

            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);


/*
 * =====================================================
 * USUÁRIO INATIVO
 * =====================================================
 */

test(
    "BE-10 INTEGRATION SECURITY: usuário desativado após login não consegue abrir nova conexão",

    async () => {

        const user =
            await createTestUser();


        const token =
            await login(
                user
            );


        /*
         * O JWT continua criptograficamente válido,
         * mas o estado atual no PostgreSQL mudou.
         */
        await User.update(
            {
                status:
                    "INACTIVE",
            },
            {
                where: {
                    user_id:
                        user.user_id,
                },
            }
        );


        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                token
            );


        try {

            const error =
                await waitForConnectError(
                    client
                );


            assert.equal(
                error.data.code,
                "USER_INACTIVE"
            );


            assert.equal(
                client.connected,
                false
            );

        } finally {

            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);


/*
 * =====================================================
 * USUÁRIO REMOVIDO
 * =====================================================
 */

test(
    "BE-10 INTEGRATION SECURITY: token de usuário removido não autentica Socket.IO",

    async () => {

        const user =
            await createTestUser();


        const token =
            await login(
                user
            );


        /*
         * Primeiro removemos a sessão para respeitar
         * a FK. Depois removemos o usuário.
         *
         * O token continua existindo no cliente,
         * mas não representa mais uma identidade válida.
         */
        await AuthSession.destroy({
            where: {
                user_id:
                    user.user_id,
            },
        });


        await User.destroy({
            where: {
                user_id:
                    user.user_id,
            },
        });


        /*
         * Já removemos manualmente.
         */
        createdUserIds.delete(
            user.user_id
        );


        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                token
            );


        try {

            const error =
                await waitForConnectError(
                    client
                );


            /*
             * Como a sessão também não existe,
             * authenticateToken interrompe antes
             * mesmo da consulta final ao usuário.
             */
            assert.equal(
                error.data.code,
                "TOKEN_INVALID"
            );


            assert.equal(
                client.connected,
                false
            );

        } finally {

            await closeRealtime({
                client,
                io:
                    context.io,

                httpServer:
                    context.httpServer,
            });
        }
    }
);
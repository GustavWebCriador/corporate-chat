process.env.NODE_ENV =
    "test";

const test =
    require("node:test");

const assert =
    require("node:assert/strict");

const {
    createServer,
} = require(
    "node:http"
);

const {
    io: createClient,
} = require(
    "socket.io-client"
);

const {
    createSocketServer,
} = require(
    "../../src/realtime/socketServer"
);

const {
    createConnectionRegistry,
} = require(
    "../../src/realtime/connectionRegistry"
);

const {
    getUserRoom,
} = require(
    "../../src/realtime/rooms"
);


/*
 * =====================================================
 * IDENTIDADES
 * =====================================================
 */

const USER_A_ID =
    "22222222-2222-4222-8222-222222222222";

const USER_B_ID =
    "33333333-3333-4333-8333-333333333333";


/*
 * =====================================================
 * AUTH
 * =====================================================
 */

function createAuthService() {
    return {
        async authenticateToken(
            token
        ) {
            if (
                token ===
                "token-user-a"
            ) {
                return {
                    user_id:
                        USER_A_ID,

                    name:
                        "Usuário A",

                    email:
                        "user-a@test.local",

                    status:
                        "ACTIVE",

                    is_admin:
                        false,
                };
            }


            if (
                token ===
                "token-user-b"
            ) {
                return {
                    user_id:
                        USER_B_ID,

                    name:
                        "Usuário B",

                    email:
                        "user-b@test.local",

                    status:
                        "ACTIVE",

                    is_admin:
                        false,
                };
            }


            throw new Error(
                "Token inválido no teste."
            );
        },
    };
}


/*
 * =====================================================
 * SERVER
 * =====================================================
 */

async function createRealtimeServer() {
    const connectionRegistry =
        createConnectionRegistry();


    const httpServer =
        createServer();


    const io =
        createSocketServer(
            httpServer,
            {
                authService:
                    createAuthService(),

                connectionRegistry,
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


    return {
        connectionRegistry,
        httpServer,
        io,

        url:
            `http://127.0.0.1:${httpServer.address().port}`,
    };
}


/*
 * =====================================================
 * CLIENT
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


function connectClient(
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


/*
 * =====================================================
 * WAIT
 * =====================================================
 */

async function waitUntil(
    predicate,
    {
        timeout = 1000,
        interval = 10,
    } = {}
) {
    const deadline =
        Date.now() +
        timeout;


    while (
        Date.now() <
        deadline
    ) {
        if (
            predicate()
        ) {
            return;
        }


        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    interval
                )
        );
    }


    throw new Error(
        "Timeout aguardando alteração do estado realtime."
    );
}


/*
 * =====================================================
 * CLEANUP
 * =====================================================
 */

async function closeRealtime(
    context,
    clients = []
) {
    for (
        const client of
        clients
    ) {
        client.removeAllListeners();
        client.disconnect();
    }


    context
        .connectionRegistry
        .clear();


    await new Promise(
        resolve => {

            context.io.close(
                () =>
                    resolve()
            );
        }
    );


    if (
        context
            .httpServer
            .listening
    ) {
        await new Promise(
            (
                resolve,
                reject
            ) => {

                context
                    .httpServer
                    .close(
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
 * REGISTRO DA CONEXÃO
 * =====================================================
 */

test(
    "BE-10 SOCKET LIFECYCLE: conexão autenticada registra socket do usuário",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                "token-user-a"
            );


        try {

            await connectClient(
                client
            );


            assert.equal(
                context
                    .connectionRegistry
                    .isUserOnline(
                        USER_A_ID
                    ),

                true
            );


            assert.equal(
                context
                    .connectionRegistry
                    .getConnectionCount(
                        USER_A_ID
                    ),

                1
            );


            const socketIds =
                context
                    .connectionRegistry
                    .getSocketIds(
                        USER_A_ID
                    );


            assert.equal(
                socketIds.has(
                    client.id
                ),

                true
            );


            const userRoom =
                context
                    .io
                    .sockets
                    .adapter
                    .rooms
                    .get(
                        getUserRoom(
                            USER_A_ID
                        )
                    );


            assert.ok(
                userRoom
            );


            assert.equal(
                userRoom.has(
                    client.id
                ),

                true
            );

        } finally {

            await closeRealtime(
                context,
                [
                    client,
                ]
            );
        }
    }
);


/*
 * =====================================================
 * MÚLTIPLAS CONEXÕES
 * =====================================================
 */

test(
    "BE-10 SOCKET LIFECYCLE: múltiplas conexões do mesmo usuário são preservadas",

    async () => {
        const context =
            await createRealtimeServer();


        const clientA =
            createTestClient(
                context.url,
                "token-user-a"
            );


        const clientB =
            createTestClient(
                context.url,
                "token-user-a"
            );


        try {

            await connectClient(
                clientA
            );


            await connectClient(
                clientB
            );


            assert.notEqual(
                clientA.id,
                clientB.id
            );


            assert.equal(
                context
                    .connectionRegistry
                    .getConnectionCount(
                        USER_A_ID
                    ),

                2
            );


            /*
             * Fecha somente uma conexão.
             */
            clientA.disconnect();


            await waitUntil(
                () =>
                    context
                        .connectionRegistry
                        .getConnectionCount(
                            USER_A_ID
                        ) === 1
            );


            assert.equal(
                context
                    .connectionRegistry
                    .isUserOnline(
                        USER_A_ID
                    ),

                true
            );


            /*
             * Fecha a última conexão.
             */
            clientB.disconnect();


            await waitUntil(
                () =>
                    context
                        .connectionRegistry
                        .getConnectionCount(
                            USER_A_ID
                        ) === 0
            );


            assert.equal(
                context
                    .connectionRegistry
                    .isUserOnline(
                        USER_A_ID
                    ),

                false
            );

        } finally {

            await closeRealtime(
                context,
                [
                    clientA,
                    clientB,
                ]
            );
        }
    }
);


/*
 * =====================================================
 * ISOLAMENTO DE USUÁRIOS
 * =====================================================
 */

test(
    "BE-10 SOCKET LIFECYCLE: conexões de usuários diferentes permanecem isoladas",

    async () => {
        const context =
            await createRealtimeServer();


        const clientA =
            createTestClient(
                context.url,
                "token-user-a"
            );


        const clientB =
            createTestClient(
                context.url,
                "token-user-b"
            );


        try {

            await connectClient(
                clientA
            );


            await connectClient(
                clientB
            );


            assert.equal(
                context
                    .connectionRegistry
                    .getConnectionCount(
                        USER_A_ID
                    ),

                1
            );


            assert.equal(
                context
                    .connectionRegistry
                    .getConnectionCount(
                        USER_B_ID
                    ),

                1
            );


            assert.deepEqual(
                new Set(
                    context
                        .connectionRegistry
                        .getOnlineUserIds()
                ),

                new Set([
                    USER_A_ID,
                    USER_B_ID,
                ])
            );


            clientA.disconnect();


            await waitUntil(
                () =>
                    !context
                        .connectionRegistry
                        .isUserOnline(
                            USER_A_ID
                        )
            );


            assert.equal(
                context
                    .connectionRegistry
                    .isUserOnline(
                        USER_B_ID
                    ),

                true
            );

        } finally {

            await closeRealtime(
                context,
                [
                    clientA,
                    clientB,
                ]
            );
        }
    }
);


/*
 * =====================================================
 * NOVA CONEXÃO APÓS DISCONNECT
 * =====================================================
 */

test(
    "BE-10 SOCKET LIFECYCLE: nova conexão após disconnect substitui o socket efêmero anterior",

    async () => {
        const context =
            await createRealtimeServer();


        const firstClient =
            createTestClient(
                context.url,
                "token-user-a"
            );


        let secondClient =
            null;


        try {

            await connectClient(
                firstClient
            );


            const firstSocketId =
                firstClient.id;


            firstClient.disconnect();


            await waitUntil(
                () =>
                    context
                        .connectionRegistry
                        .getConnectionCount(
                            USER_A_ID
                        ) === 0
            );


            secondClient =
                createTestClient(
                    context.url,
                    "token-user-a"
                );


            await connectClient(
                secondClient
            );


            const secondSocketId =
                secondClient.id;


            assert.notEqual(
                secondSocketId,
                firstSocketId
            );


            const socketIds =
                context
                    .connectionRegistry
                    .getSocketIds(
                        USER_A_ID
                    );


            assert.equal(
                socketIds.has(
                    firstSocketId
                ),

                false
            );


            assert.equal(
                socketIds.has(
                    secondSocketId
                ),

                true
            );


            assert.equal(
                context
                    .connectionRegistry
                    .getConnectionCount(
                        USER_A_ID
                    ),

                1
            );

        } finally {

            await closeRealtime(
                context,
                [
                    firstClient,
                    ...(secondClient
                        ? [
                            secondClient,
                        ]
                        : []),
                ]
            );
        }
    }
);

test(
    "BE-10 SOCKET LIFECYCLE SECURITY: conexão rejeitada não é registrada como online",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                "token-inexistente"
            );


        const error =
            await new Promise(
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
                                    "Conexão inválida não deveria ser aceita."
                                )
                            );
                        }
                    );


                    client.connect();
                }
            );


        try {
            assert.ok(
                error
            );


            assert.equal(
                client.connected,
                false
            );


            assert.equal(
                context
                    .connectionRegistry
                    .getOnlineUserIds()
                    .length,

                0
            );

        } finally {
            await closeRealtime(
                context,
                [
                    client,
                ]
            );
        }
    }
);

test(
    "BE-10 SOCKET LIFECYCLE: room privada do usuário é removida após última desconexão",

    async () => {
        const context =
            await createRealtimeServer();


        const client =
            createTestClient(
                context.url,
                "token-user-a"
            );


        try {
            await connectClient(
                client
            );


            const roomName =
                getUserRoom(
                    USER_A_ID
                );


            assert.ok(
                context
                    .io
                    .sockets
                    .adapter
                    .rooms
                    .has(
                        roomName
                    )
            );


            client.disconnect();


            await waitUntil(
                () =>
                    !context
                        .io
                        .sockets
                        .adapter
                        .rooms
                        .has(
                            roomName
                        )
            );


            assert.equal(
                context
                    .connectionRegistry
                    .isUserOnline(
                        USER_A_ID
                    ),

                false
            );

        } finally {
            await closeRealtime(
                context,
                [
                    client,
                ]
            );
        }
    }
);
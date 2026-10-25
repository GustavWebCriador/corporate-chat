const test =
    require("node:test");

const assert =
    require("node:assert/strict");

const {
    createConnectionRegistry,
} = require(
    "../../src/realtime/connectionRegistry"
);


const USER_ID =
    "22222222-2222-4222-8222-222222222222";


test(
    "BE-10 REGISTRY: primeira conexão coloca usuário online",

    () => {
        const registry =
            createConnectionRegistry();


        const result =
            registry.add(
                USER_ID,
                "socket-1"
            );


        assert.equal(
            result.becameOnline,
            true
        );


        assert.equal(
            result.connectionCount,
            1
        );


        assert.equal(
            registry.isUserOnline(
                USER_ID
            ),
            true
        );
    }
);


test(
    "BE-10 REGISTRY: múltiplos sockets pertencem ao mesmo usuário",

    () => {
        const registry =
            createConnectionRegistry();


        registry.add(
            USER_ID,
            "socket-1"
        );


        registry.add(
            USER_ID,
            "socket-2"
        );


        assert.equal(
            registry.getConnectionCount(
                USER_ID
            ),
            2
        );


        const firstRemoval =
            registry.remove(
                USER_ID,
                "socket-1"
            );


        assert.equal(
            firstRemoval.becameOffline,
            false
        );


        assert.equal(
            registry.isUserOnline(
                USER_ID
            ),
            true
        );


        const lastRemoval =
            registry.remove(
                USER_ID,
                "socket-2"
            );


        assert.equal(
            lastRemoval.becameOffline,
            true
        );


        assert.equal(
            registry.isUserOnline(
                USER_ID
            ),
            false
        );
    }
);


test(
    "BE-10 REGISTRY: registrar mesmo socket novamente é idempotente",

    () => {
        const registry =
            createConnectionRegistry();


        registry.add(
            USER_ID,
            "socket-1"
        );


        registry.add(
            USER_ID,
            "socket-1"
        );


        assert.equal(
            registry.getConnectionCount(
                USER_ID
            ),
            1
        );
    }
);


test(
    "BE-10 REGISTRY: getSocketIds não expõe Set interno",

    () => {
        const registry =
            createConnectionRegistry();


        registry.add(
            USER_ID,
            "socket-1"
        );


        const copy =
            registry.getSocketIds(
                USER_ID
            );


        copy.clear();


        assert.equal(
            registry.getConnectionCount(
                USER_ID
            ),
            1
        );


        assert.equal(
            registry
                .getSocketIds(
                    USER_ID
                )
                .has(
                    "socket-1"
                ),

            true
        );
    }
);
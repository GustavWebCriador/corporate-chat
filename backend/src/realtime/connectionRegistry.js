function createConnectionRegistry() {
    /*
     * user_id -> Set<socket.id>
     *
     * Exemplo:
     *
     * {
     *   "uuid-user-a" => Set {
     *       "socket-1",
     *       "socket-2"
     *   }
     * }
     */
    const connectionsByUser =
        new Map();


    function add(
        userId,
        socketId
    ) {
        let sockets =
            connectionsByUser
                .get(
                    userId
                );


        if (!sockets) {
            sockets =
                new Set();

            connectionsByUser
                .set(
                    userId,
                    sockets
                );
        }


        const wasOffline =
            sockets.size === 0;


        sockets.add(
            socketId
        );


        return {
            userId,
            socketId,

            connectionCount:
                sockets.size,

            becameOnline:
                wasOffline,
        };
    }


    function remove(
        userId,
        socketId
    ) {
        const sockets =
            connectionsByUser
                .get(
                    userId
                );


        if (!sockets) {
            return {
                userId,
                socketId,

                removed:
                    false,

                connectionCount:
                    0,

                becameOffline:
                    false,
            };
        }


        const removed =
            sockets.delete(
                socketId
            );


        const connectionCount =
            sockets.size;


        const becameOffline =
            removed &&
            connectionCount === 0;


        if (
            connectionCount ===
            0
        ) {
            connectionsByUser
                .delete(
                    userId
                );
        }


        return {
            userId,
            socketId,
            removed,
            connectionCount,
            becameOffline,
        };
    }


    function isUserOnline(
        userId
    ) {
        return (
            getConnectionCount(
                userId
            ) > 0
        );
    }


    function getConnectionCount(
        userId
    ) {
        return (
            connectionsByUser
                .get(
                    userId
                )
                ?.size ?? 0
        );
    }


    function getSocketIds(
        userId
    ) {
        const sockets =
            connectionsByUser
                .get(
                    userId
                );


        return sockets
            ? new Set(
                sockets
            )
            : new Set();
    }


    function getOnlineUserIds() {
        return [
            ...connectionsByUser
                .keys(),
        ];
    }


    function clear() {
        connectionsByUser
            .clear();
    }


    return {
        add,
        remove,
        isUserOnline,
        getConnectionCount,
        getSocketIds,
        getOnlineUserIds,
        clear,
    };
}


module.exports = {
    createConnectionRegistry,
};
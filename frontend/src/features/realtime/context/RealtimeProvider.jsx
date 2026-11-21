
import { useEffect, useState } from "react";

import { useAuth } from "../../auth/hooks/useAuth";
import { createChatSocket } from "../../../services/realtime/chatSocket";
import { RealtimeContext } from "./realtimeContext";

export function RealtimeProvider({ children }) {
    const { token } = useAuth();

    const [connection, setConnection] = useState({
        token: null,
        socket: null,
        status: "disconnected",
        error: null,
    });

    useEffect(() => {
        if (!token) {
            return;
        }

        const socket = createChatSocket(token);

        function handleReady() {
            setConnection({
                token,
                socket,
                status: "connected",
                error: null,
            });
        }

        function handleConnectError(error) {
            setConnection({
                token,
                socket: null,
                status: "error",
                error: error?.data?.code ?? "CONNECTION_ERROR",
            });
        }

        function handleDisconnect() {
            setConnection({
                token,
                socket: null,
                status: "disconnected",
                error: null,
            });
        }

        // Os listeners são registrados antes da conexão.
        socket.on("realtime:ready", handleReady);
        socket.on("connect_error", handleConnectError);
        socket.on("disconnect", handleDisconnect);

        socket.connect();

        return () => {
            socket.off("realtime:ready", handleReady);
            socket.off("connect_error", handleConnectError);
            socket.off("disconnect", handleDisconnect);

            socket.removeAllListeners();
            socket.disconnect();
        };
    }, [token]);

    // Impede a exposição de sockets de uma sessão anterior.
    const value = connection.token === token
        ? {
            socket: connection.socket,
            status: connection.status,
            error: connection.error,
        }
        : {
            socket: null,
            status: token ? "connecting" : "disconnected",
            error: null,
        };

    return (
        <RealtimeContext.Provider value={value}>
            {children}
        </RealtimeContext.Provider>
    );
}
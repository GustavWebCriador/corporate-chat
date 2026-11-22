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
        readyVersion: 0,
    });

    useEffect(() => {
        if (!token) {
            return;
        }

        const socket = createChatSocket(token);

        function handleReady() {
            setConnection((current) => ({
                token,
                socket,
                status: "connected",
                error: null,
                // Cada realtime:ready indica nova sessão de transporte.
                // Permite atualizar a lista após reconexões, mesmo
                // quando o objeto Socket.IO permanece o mesmo.
                readyVersion: current.token === token
                    ? current.readyVersion + 1
                    : 1,
            }));
        }

        function handleConnectError(error) {
            setConnection((current) => ({
                ...current,
                token,
                socket: null,
                status: "error",
                error: error?.data?.code ?? "CONNECTION_ERROR",
            }));
        }

        function handleDisconnect() {
            setConnection((current) => ({
                ...current,
                token,
                socket: null,
                status: "disconnected",
                error: null,
            }));
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
            readyVersion: connection.readyVersion,
        }
        : {
            socket: null,
            status: token ? "connecting" : "disconnected",
            error: null,
            readyVersion: 0,
        };

    return (
        <RealtimeContext.Provider value={value}>
            {children}
        </RealtimeContext.Provider>
    );
}
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../auth/hooks/useAuth";
import { createChatSocket } from "../../../services/realtime/socketClient";

import {
    CONNECTION_STATUS,
    RealtimeContext,
} from "./realtimeContext";

const ACK_TIMEOUT_MS = 10000;

// Códigos do handshake que indicam sessão inválida (REALTIME.md §6).
const SESSION_ERROR_CODES = new Set([
    "TOKEN_MISSING",
    "TOKEN_INVALID",
    "TOKEN_EXPIRED",
    "TOKEN_REVOKED",
    "USER_INACTIVE",
]);

function realtimeError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

/**
 * Conexão Socket.IO controlada pelo ciclo de vida da sessão (RF12).
 *
 * - conecta após o login e desconecta no logout;
 * - expõe o estado da conexão, inclusive "reconectando" (CA12.3);
 * - incrementa `readyCount` a cada conexão pronta, para que as telas
 *   sincronizem mensagens após uma reconexão (CA12.4);
 * - encerra a sessão quando o backend recusa o token.
 */
export function RealtimeProvider({ children, createSocket = createChatSocket }) {
    const { token, expireSession } = useAuth();

    const [connectionStatus, setStatus] = useState(
        CONNECTION_STATUS.CONNECTING
    );

    // Sem sessão não há conexão.
    const status = token ? connectionStatus : CONNECTION_STATUS.IDLE;
    const [readyCount, setReadyCount] = useState(0);

    const socketRef = useRef(null);
    const listenersRef = useRef(new Map());

    useEffect(() => {
        if (!token) {
            return undefined;
        }

        const socket = createSocket(token);
        socketRef.current = socket;

        // Repassa eventos do servidor para as telas inscritas.
        const forward = (event) => (payload) => {
            listenersRef.current.get(event)?.forEach((handler) => {
                handler(payload);
            });
        };

        const forwarded = [
            "message:new",
            "message:delivery:update",
            "message:read:update",
        ];

        const forwarders = forwarded.map((event) => {
            const handler = forward(event);
            socket.on(event, handler);
            return [event, handler];
        });

        socket.on("realtime:ready", () => {
            setStatus(CONNECTION_STATUS.CONNECTED);
            setReadyCount((current) => current + 1);
        });

        socket.on("disconnect", (reason) => {
            if (reason === "io client disconnect") {
                return;
            }

            setStatus(CONNECTION_STATUS.RECONNECTING);

            // O servidor encerrou a conexão: tenta novamente; o
            // middleware recusa caso a sessão tenha sido revogada.
            if (reason === "io server disconnect") {
                socket.connect();
            }
        });

        socket.on("connect_error", (error) => {
            const code = error?.data?.code;

            if (code && SESSION_ERROR_CODES.has(code)) {
                setStatus(CONNECTION_STATUS.UNAVAILABLE);
                expireSession?.();
                return;
            }

            // Erros de middleware não reconectam sozinhos; falhas de
            // transporte seguem a reconexão automática do Socket.IO.
            setStatus(
                socket.active
                    ? CONNECTION_STATUS.RECONNECTING
                    : CONNECTION_STATUS.UNAVAILABLE
            );
        });

        socket.connect();

        return () => {
            forwarders.forEach(([event, handler]) => socket.off(event, handler));
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
            setStatus(CONNECTION_STATUS.CONNECTING);
        };
    }, [token, createSocket, expireSession]);

    const subscribe = useCallback((event, handler) => {
        const listeners = listenersRef.current;

        if (!listeners.has(event)) {
            listeners.set(event, new Set());
        }

        listeners.get(event).add(handler);

        return () => {
            listeners.get(event)?.delete(handler);
        };
    }, []);

    /**
     * Emite um evento com ACK e devolve `data` ou lança o erro
     * retornado pelo backend (REALTIME.md §17).
     */
    const emitWithAck = useCallback(async (event, payload) => {
        const socket = socketRef.current;

        if (!socket?.connected) {
            throw realtimeError(
                "REALTIME_UNAVAILABLE",
                "Conexão em tempo real indisponível."
            );
        }

        let ack;

        try {
            ack = await socket
                .timeout(ACK_TIMEOUT_MS)
                .emitWithAck(event, payload);
        } catch {
            throw realtimeError(
                "REALTIME_TIMEOUT",
                "O servidor não confirmou a operação a tempo."
            );
        }

        if (!ack?.ok) {
            throw realtimeError(
                ack?.error?.code ?? "REALTIME_ERROR",
                ack?.error?.message ?? "Falha na operação em tempo real."
            );
        }

        return ack.data;
    }, []);

    const value = useMemo(() => ({
        status,
        isConnected: status === CONNECTION_STATUS.CONNECTED,
        readyCount,
        subscribe,
        emitWithAck,
    }), [status, readyCount, subscribe, emitWithAck]);

    return (
        <RealtimeContext.Provider value={value}>
            {children}
        </RealtimeContext.Provider>
    );
}

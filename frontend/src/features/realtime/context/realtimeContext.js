import { createContext } from "react";

/**
 * Estados da conexão em tempo real.
 */
export const CONNECTION_STATUS = Object.freeze({
    IDLE: "idle",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    RECONNECTING: "reconnecting",
    UNAVAILABLE: "unavailable",
});

function offlineEmit() {
    const error = new Error("Conexão em tempo real indisponível.");
    error.code = "REALTIME_UNAVAILABLE";
    return Promise.reject(error);
}

/**
 * Valor padrão sem conexão: componentes usados fora do
 * RealtimeProvider continuam funcionando apenas com a API REST.
 */
export const OFFLINE_REALTIME = Object.freeze({
    status: CONNECTION_STATUS.IDLE,
    isConnected: false,
    readyCount: 0,
    subscribe: () => () => {},
    emitWithAck: offlineEmit,
});

export const RealtimeContext = createContext(OFFLINE_REALTIME);

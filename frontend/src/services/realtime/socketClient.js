import { io } from "socket.io-client";

const socketUrl = import.meta.env.VITE_BACKEND_URL;

export function createChatSocket(token) {
    if (!token) {
        throw new Error(
            "Token obrigatório para conexão Socket.IO."
        );
    }

    return io(socketUrl, {
        autoConnect: false,

        auth: {
            token,
        },

        reconnection: true,
    });
}
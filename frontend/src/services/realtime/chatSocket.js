
import { io } from "socket.io-client";

export function createChatSocket(
    token,
    backendUrl = import.meta.env.VITE_BACKEND_URL
) {
    if (
        typeof token !== "string" ||
        !token.trim()
    ) {
        throw new Error(
            "Token de autenticação obrigatório para o Socket.IO."
        );
    }

    if (
        typeof backendUrl !== "string" ||
        !backendUrl.trim()
    ) {
        throw new Error(
            "VITE_BACKEND_URL não configurada."
        );
    }

    return io(
        backendUrl.replace(/\/+$/, ""),
        {
            autoConnect: false,
            reconnection: true,
            auth: {
                token,
            },
        }
    );
}


import {
    beforeEach,
    expect,
    it,
    vi,
} from "vitest";

import { io } from "socket.io-client";
import { createChatSocket } from "./chatSocket";

vi.mock("socket.io-client", () => ({
    io: vi.fn(),
}));

beforeEach(() => {
    vi.resetAllMocks();
});

it("deve configurar o Socket.IO com JWT", () => {
    const socket = {
        connect: vi.fn(),
        disconnect: vi.fn(),
    };

    io.mockReturnValue(socket);

    const result = createChatSocket(
        "jwt-teste",
        "http://localhost:3000/"
    );

    expect(io).toHaveBeenCalledWith(
        "http://localhost:3000",
        {
            autoConnect: false,
            reconnection: true,
            auth: {
                token: "jwt-teste",
            },
        }
    );

    expect(result).toBe(socket);
});

it("não deve conectar automaticamente", () => {
    const socket = {
        connect: vi.fn(),
        disconnect: vi.fn(),
    };

    io.mockReturnValue(socket);

    createChatSocket(
        "jwt-teste",
        "http://localhost:3000"
    );

    expect(socket.connect).not.toHaveBeenCalled();
});

it("deve impedir conexão sem token", () => {
    expect(() =>
        createChatSocket(
            "",
            "http://localhost:3000"
        )
    ).toThrow(
        "Token de autenticação obrigatório"
    );

    expect(io).not.toHaveBeenCalled();
});

it("deve exigir URL do backend", () => {
    expect(() =>
        createChatSocket(
            "jwt-teste",
            ""
        )
    ).toThrow(
        "VITE_BACKEND_URL não configurada."
    );

    expect(io).not.toHaveBeenCalled();
});

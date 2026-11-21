
import {
    act,
    cleanup,
    render,
    screen,
} from "@testing-library/react";

import {
    afterEach,
    beforeEach,
    expect,
    test,
    vi,
} from "vitest";

import "@testing-library/jest-dom/vitest";

import { RealtimeProvider } from "./RealtimeProvider";
import { useRealtime } from "../hooks/useRealtime";
import { useAuth } from "../../auth/hooks/useAuth";
import { createChatSocket } from "../../../services/realtime/chatSocket";

vi.mock("../../auth/hooks/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../../../services/realtime/chatSocket", () => ({
    createChatSocket: vi.fn(),
}));

let handlers;
let socket;

function ConnectionStatus() {
    const { status, socket: activeSocket } = useRealtime();

    return (
        <>
            <output data-testid="socket-status">
                {status}
            </output>

            <output data-testid="socket-active">
                {activeSocket ? "Sim" : "Não"}
            </output>
        </>
    );
}

function renderProvider() {
    return (
        <RealtimeProvider>
            <ConnectionStatus />
        </RealtimeProvider>
    );
}

beforeEach(() => {
    vi.resetAllMocks();

    handlers = new Map();

    socket = {
        on: vi.fn((event, callback) => {
            handlers.set(event, callback);
        }),
        off: vi.fn((event) => {
            handlers.delete(event);
        }),
        removeAllListeners: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
    };

    createChatSocket.mockReturnValue(socket);
    useAuth.mockReturnValue({ token: null });
});

afterEach(() => {
    cleanup();
});

test("não deve conectar sem usuário autenticado", () => {
    render(renderProvider());

    expect(createChatSocket).not.toHaveBeenCalled();
    expect(socket.connect).not.toHaveBeenCalled();

    expect(
        screen.getByTestId("socket-status")
    ).toHaveTextContent("disconnected");
});

test("deve conectar após login e aguardar realtime:ready", () => {
    useAuth.mockReturnValue({ token: "jwt-teste" });

    render(renderProvider());

    expect(createChatSocket).toHaveBeenCalledWith(
        "jwt-teste"
    );

    expect(socket.connect).toHaveBeenCalledTimes(1);

    expect(
        screen.getByTestId("socket-status")
    ).toHaveTextContent("connecting");

    act(() => {
        handlers.get("realtime:ready")?.({
            recovered: false,
        });
    });

    expect(
        screen.getByTestId("socket-status")
    ).toHaveTextContent("connected");

    expect(
        screen.getByTestId("socket-active")
    ).toHaveTextContent("Sim");
});

test("deve desconectar ao encerrar a sessão", () => {
    useAuth.mockReturnValue({ token: "jwt-teste" });

    const { rerender } = render(renderProvider());

    act(() => {
        handlers.get("realtime:ready")?.({
            recovered: false,
        });
    });

    useAuth.mockReturnValue({ token: null });

    rerender(renderProvider());

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.removeAllListeners).toHaveBeenCalled();

    expect(
        screen.getByTestId("socket-status")
    ).toHaveTextContent("disconnected");

    expect(
        screen.getByTestId("socket-active")
    ).toHaveTextContent("Não");
});

test("deve tratar erro de autenticação da conexão", () => {
    useAuth.mockReturnValue({ token: "jwt-invalido" });

    render(renderProvider());

    act(() => {
        handlers.get("connect_error")?.({
            data: {
                code: "TOKEN_INVALID",
            },
        });
    });

    expect(
        screen.getByTestId("socket-status")
    ).toHaveTextContent("error");

    expect(
        screen.getByTestId("socket-active")
    ).toHaveTextContent("Não");
});
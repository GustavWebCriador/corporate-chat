import { useEffect } from "react";

import {
    afterEach,
    beforeEach,
    expect,
    test,
    vi,
} from "vitest";

import {
    act,
    cleanup,
    render,
    screen,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import { RealtimeProvider } from "./RealtimeProvider";
import { useRealtime } from "../hooks/useRealtime";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { useAuth } from "../../auth/hooks/useAuth";

vi.mock("../../auth/hooks/useAuth", () => ({
    useAuth: vi.fn(),
}));

/**
 * Socket.IO simulado: guarda os listeners e permite
 * disparar eventos do servidor nos testes.
 */
function createFakeSocket() {
    const handlers = new Map();

    const socket = {
        connected: false,
        active: true,
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event).add(handler);
            return socket;
        }),
        off: vi.fn((event, handler) => {
            handlers.get(event)?.delete(handler);
            return socket;
        }),
        removeAllListeners: vi.fn(() => handlers.clear()),
        connect: vi.fn(),
        disconnect: vi.fn(),
        emitWithAck: vi.fn(),
        timeout: vi.fn(() => socket),
        serverEmit(event, payload) {
            handlers.get(event)?.forEach((handler) => handler(payload));
        },
    };

    return socket;
}

let socket;
let createSocket;
let expireSession;
const probe = { current: null };

function Probe() {
    const realtime = useRealtime();

    useEffect(() => {
        probe.current = realtime;
    });

    return (
        <>
            <ConnectionStatus />
            <output data-testid="status">{realtime.status}</output>
            <output data-testid="ready">{realtime.readyCount}</output>
        </>
    );
}

function renderProvider() {
    return render(
        <RealtimeProvider createSocket={createSocket}>
            <Probe />
        </RealtimeProvider>
    );
}

function becomeReady() {
    act(() => {
        socket.connected = true;
        socket.serverEmit("realtime:ready", { recovered: false });
    });
}

beforeEach(() => {
    socket = createFakeSocket();
    createSocket = vi.fn(() => socket);
    expireSession = vi.fn();

    useAuth.mockReturnValue({
        token: "jwt-teste",
        expireSession,
    });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

test("conecta com o token da sessão e fica pronto após realtime:ready", () => {
    renderProvider();

    expect(createSocket).toHaveBeenCalledWith("jwt-teste");
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status")).toHaveTextContent("connecting");

    becomeReady();

    expect(screen.getByTestId("status")).toHaveTextContent("connected");
    expect(screen.getByTestId("ready")).toHaveTextContent("1");
    expect(probe.current.isConnected).toBe(true);
});

test("não conecta sem sessão", () => {
    useAuth.mockReturnValue({ token: null, expireSession });

    renderProvider();

    expect(createSocket).not.toHaveBeenCalled();
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
});

test("exibe Reconectando... quando a conexão cai (CA12.3)", () => {
    renderProvider();
    becomeReady();

    act(() => {
        socket.connected = false;
        socket.serverEmit("disconnect", "transport close");
    });

    expect(screen.getByText("Reconectando...")).toBeInTheDocument();

    becomeReady();

    expect(screen.queryByText("Reconectando...")).not.toBeInTheDocument();
    expect(screen.getByTestId("ready")).toHaveTextContent("2");
});

test("tenta reconectar quando o servidor encerra a conexão", () => {
    renderProvider();
    becomeReady();

    act(() => {
        socket.serverEmit("disconnect", "io server disconnect");
    });

    expect(socket.connect).toHaveBeenCalledTimes(2);
});

test("encerra a sessão quando o backend recusa o token", () => {
    renderProvider();

    act(() => {
        socket.active = false;
        socket.serverEmit("connect_error", {
            data: { code: "TOKEN_REVOKED" },
        });
    });

    expect(expireSession).toHaveBeenCalledTimes(1);
});

test("desconecta ao encerrar a sessão (logout)", () => {
    const { rerender } = renderProvider();
    becomeReady();

    useAuth.mockReturnValue({ token: null, expireSession });

    rerender(
        <RealtimeProvider createSocket={createSocket}>
            <Probe />
        </RealtimeProvider>
    );

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
});

test("repassa eventos do servidor às telas inscritas", () => {
    renderProvider();

    const handler = vi.fn();
    let unsubscribe;

    act(() => {
        unsubscribe = probe.current.subscribe("message:new", handler);
    });

    socket.serverEmit("message:new", { message: { _id: "m1" } });
    expect(handler).toHaveBeenCalledWith({ message: { _id: "m1" } });

    unsubscribe();
    socket.serverEmit("message:new", { message: { _id: "m2" } });
    expect(handler).toHaveBeenCalledTimes(1);
});

test("emitWithAck devolve data no sucesso e lança o erro do backend", async () => {
    renderProvider();
    becomeReady();

    socket.emitWithAck.mockResolvedValueOnce({
        ok: true,
        data: { message: { _id: "m1" } },
    });

    await expect(
        probe.current.emitWithAck("message:send", { content: "Olá" })
    ).resolves.toEqual({ message: { _id: "m1" } });

    expect(socket.timeout).toHaveBeenCalledWith(10000);

    socket.emitWithAck.mockResolvedValueOnce({
        ok: false,
        error: { code: "MESSAGE_CONTENT_TOO_LONG", message: "Longa." },
    });

    await expect(
        probe.current.emitWithAck("message:send", {})
    ).rejects.toMatchObject({ code: "MESSAGE_CONTENT_TOO_LONG" });

    socket.emitWithAck.mockRejectedValueOnce(new Error("timeout"));

    await expect(
        probe.current.emitWithAck("message:send", {})
    ).rejects.toMatchObject({ code: "REALTIME_TIMEOUT" });
});

test("emitWithAck falha sem conexão", async () => {
    renderProvider();

    await expect(
        probe.current.emitWithAck("message:send", {})
    ).rejects.toMatchObject({ code: "REALTIME_UNAVAILABLE" });

    expect(socket.emitWithAck).not.toHaveBeenCalled();
});

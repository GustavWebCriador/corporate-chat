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
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import { ChatPanel } from "./ChatPanel";
import { conversationService } from "../../../services/api/conversationService";
import {
    CONNECTION_STATUS,
    RealtimeContext,
} from "../../realtime/context/realtimeContext";

vi.mock("../../../services/api/conversationService", () => ({
    conversationService: {
        getHistory: vi.fn(),
        sendMessage: vi.fn(),
        markRead: vi.fn(),
        openPrivate: vi.fn(),
    },
}));

const ME = { user_id: "11111111-1111-4111-8111-111111111111", name: "Alexandre" };
const MARIA = { user_id: "22222222-2222-4222-8222-222222222222", name: "Maria Oliveira" };
const CONV = "507f1f77bcf86cd799439011";

const privateConversation = {
    conversation_id: CONV,
    type: "PRIVATE",
    name: null,
    contact: MARIA,
};

const usersById = new Map([[MARIA.user_id, MARIA]]);

function serverMessage(id, senderId, content, clientId = `c-${id}`) {
    return {
        _id: id,
        conversation_id: CONV,
        sender_id: senderId,
        client_message_id: clientId,
        content,
        created_at: `2026-11-21T10:${id.slice(-2)}:00.000Z`,
    };
}

/**
 * Conexão em tempo real simulada (mesmo formato do RealtimeProvider).
 */
function createRealtime(overrides = {}) {
    const handlers = new Map();

    return {
        status: CONNECTION_STATUS.CONNECTED,
        isConnected: true,
        readyCount: 1,
        subscribe: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event).add(handler);
            return () => handlers.get(event)?.delete(handler);
        }),
        emitWithAck: vi.fn().mockResolvedValue({}),
        serverEmit(event, payload) {
            act(() => {
                handlers.get(event)?.forEach((handler) => handler(payload));
            });
        },
        ...overrides,
    };
}

let realtime;

function renderPanel(conversation = privateConversation, value = realtime) {
    return render(
        <RealtimeContext.Provider value={value}>
            <ChatPanel
                conversation={conversation}
                currentUser={ME}
                usersById={usersById}
            />
        </RealtimeContext.Provider>
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    realtime = createRealtime();

    conversationService.getHistory.mockResolvedValue({
        items: [serverMessage("6900000000000000000000a1", MARIA.user_id, "Oi!")],
        hasMore: false,
        nextCursor: null,
    });
    conversationService.markRead.mockResolvedValue({});
});

afterEach(() => {
    cleanup();
});

test("envia pelo socket quando conectado (message:send)", async () => {
    realtime.emitWithAck.mockImplementation(async (event, payload) => {
        if (event === "message:send") {
            return {
                message: serverMessage(
                    "6900000000000000000000a2",
                    ME.user_id,
                    payload.content,
                    payload.clientMessageId
                ),
                reused: false,
            };
        }
        return {};
    });

    renderPanel();

    fireEvent.change(await screen.findByLabelText("Mensagem"), {
        target: { value: "Pelo socket" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
        expect(screen.getByText("Enviada")).toBeInTheDocument();
    });

    const sendCall = realtime.emitWithAck.mock.calls.find(
        ([event]) => event === "message:send"
    );

    expect(sendCall[1]).toMatchObject({
        conversationId: CONV,
        content: "Pelo socket",
    });
    expect(sendCall[1]).not.toHaveProperty("senderId");
    expect(conversationService.sendMessage).not.toHaveBeenCalled();
});

test("mostra mensagem recebida em tempo real sem recarregar (CA06.3/CA12.1)", async () => {
    renderPanel();
    await screen.findByText("Oi!");

    realtime.serverEmit("message:new", {
        message: serverMessage("6900000000000000000000a3", MARIA.user_id, "Chegou agora"),
    });

    expect(screen.getByText("Chegou agora")).toBeInTheDocument();

    // Mensagens de outras conversas são ignoradas aqui.
    realtime.serverEmit("message:new", {
        message: { ...serverMessage("6900000000000000000000a4", MARIA.user_id, "Outra conversa"), conversation_id: "outra" },
    });

    expect(screen.queryByText("Outra conversa")).not.toBeInTheDocument();
});

test("não duplica a própria mensagem recebida também por message:new", async () => {
    let resolveAck;
    realtime.emitWithAck.mockImplementation((event, payload) => {
        if (event !== "message:send") return Promise.resolve({});
        return new Promise((resolve) => {
            resolveAck = () => resolve({
                message: serverMessage("6900000000000000000000a5", ME.user_id, payload.content, payload.clientMessageId),
            });
        });
    });

    renderPanel();

    fireEvent.change(await screen.findByLabelText("Mensagem"), {
        target: { value: "Sem duplicar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    const payload = realtime.emitWithAck.mock.calls.find(([e]) => e === "message:send")[1];

    // O evento chega antes do ACK.
    realtime.serverEmit("message:new", {
        message: serverMessage("6900000000000000000000a5", ME.user_id, "Sem duplicar", payload.clientMessageId),
    });

    await act(async () => {
        resolveAck();
    });

    expect(screen.getAllByText("Sem duplicar")).toHaveLength(1);
});

test("registra leitura pelo socket e mostra Entregue/Lida (RF07)", async () => {
    conversationService.getHistory.mockResolvedValue({
        items: [
            serverMessage("6900000000000000000000b1", MARIA.user_id, "Pergunta"),
            serverMessage("6900000000000000000000b2", ME.user_id, "Resposta"),
        ],
        hasMore: false,
        nextCursor: null,
    });

    renderPanel();
    await screen.findByText("Resposta");

    await waitFor(() => {
        expect(realtime.emitWithAck).toHaveBeenCalledWith("message:read", {
            conversationId: CONV,
            messageId: "6900000000000000000000b1",
        });
    });
    expect(conversationService.markRead).not.toHaveBeenCalled();

    realtime.serverEmit("message:delivery:update", {
        checkpoint: {
            conversation_id: CONV,
            user_id: MARIA.user_id,
            last_delivered_message_id: "6900000000000000000000b2",
            last_read_message_id: null,
        },
    });

    expect(screen.getByText("Entregue")).toBeInTheDocument();

    realtime.serverEmit("message:read:update", {
        checkpoint: {
            conversation_id: CONV,
            user_id: MARIA.user_id,
            last_delivered_message_id: "6900000000000000000000b2",
            last_read_message_id: "6900000000000000000000b2",
        },
    });

    expect(screen.getByText("Lida")).toBeInTheDocument();
});

test("em grupos informa quantos participantes leram", async () => {
    const group = {
        conversation_id: CONV,
        type: "GROUP",
        name: "Equipe",
        contact: null,
    };

    conversationService.getHistory.mockResolvedValue({
        items: [serverMessage("6900000000000000000000c1", ME.user_id, "Bom dia, equipe")],
        hasMore: false,
        nextCursor: null,
    });

    renderPanel(group);
    await screen.findByText("Bom dia, equipe");

    ["u-1", "u-2"].forEach((userId) => {
        realtime.serverEmit("message:read:update", {
            checkpoint: {
                conversation_id: CONV,
                user_id: userId,
                last_delivered_message_id: "6900000000000000000000c1",
                last_read_message_id: "6900000000000000000000c1",
            },
        });
    });

    expect(screen.getByText("Lida por 2")).toBeInTheDocument();
});

test("após reconectar sincroniza mensagens perdidas e reenvia falhas (CA08.4/CA12.4)", async () => {
    realtime.emitWithAck.mockImplementation(async (event) => {
        if (event === "message:send") {
            const error = new Error("timeout");
            error.code = "REALTIME_TIMEOUT";
            throw error;
        }
        return {};
    });

    const { rerender } = renderPanel();

    fireEvent.change(await screen.findByLabelText("Mensagem"), {
        target: { value: "Durante a queda" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Falha no envio")).toBeInTheDocument();

    const firstSend = realtime.emitWithAck.mock.calls.find(([e]) => e === "message:send")[1];

    // Reconexão: o servidor responde normalmente.
    realtime.emitWithAck.mockImplementation(async (event, payload) => {
        if (event === "realtime:sync") {
            return {
                mode: "incremental",
                items: [serverMessage("6900000000000000000000d1", MARIA.user_id, "Enviada enquanto offline")],
                hasMore: false,
                nextAfterMessageId: "6900000000000000000000d1",
            };
        }
        if (event === "message:send") {
            return {
                message: serverMessage("6900000000000000000000d2", ME.user_id, payload.content, payload.clientMessageId),
            };
        }
        return {};
    });

    const reconnected = { ...realtime, readyCount: 2 };

    rerender(
        <RealtimeContext.Provider value={reconnected}>
            <ChatPanel
                conversation={privateConversation}
                currentUser={ME}
                usersById={usersById}
            />
        </RealtimeContext.Provider>
    );

    expect(await screen.findByText("Enviada enquanto offline")).toBeInTheDocument();

    expect(realtime.emitWithAck).toHaveBeenCalledWith("realtime:sync", {
        conversationId: CONV,
        afterMessageId: "6900000000000000000000a1",
        limit: 50,
    });

    await waitFor(() => {
        expect(screen.queryByText("Falha no envio")).not.toBeInTheDocument();
    });

    const sends = realtime.emitWithAck.mock.calls.filter(([e]) => e === "message:send");
    expect(sends.at(-1)[1].clientMessageId).toBe(firstSend.clientMessageId);
    expect(screen.getAllByText("Durante a queda")).toHaveLength(1);
});

test("sem socket continua usando a API REST", async () => {
    const offline = createRealtime({
        status: CONNECTION_STATUS.RECONNECTING,
        isConnected: false,
    });

    conversationService.sendMessage.mockImplementation(async (_id, payload) => ({
        message: serverMessage("6900000000000000000000e1", ME.user_id, payload.content, payload.clientMessageId),
    }));

    renderPanel(privateConversation, offline);

    fireEvent.change(await screen.findByLabelText("Mensagem"), {
        target: { value: "Via REST" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
        expect(conversationService.sendMessage).toHaveBeenCalledTimes(1);
    });

    expect(offline.emitWithAck).not.toHaveBeenCalledWith("message:send", expect.anything());
});

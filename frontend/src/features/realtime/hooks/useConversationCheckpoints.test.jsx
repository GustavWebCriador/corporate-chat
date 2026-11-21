
import {
    act,
    cleanup,
    render,
    screen,
    waitFor,
} from "@testing-library/react";

import {
    afterEach,
    beforeEach,
    expect,
    test,
    vi,
} from "vitest";

import "@testing-library/jest-dom/vitest";

import { useRealtime } from "./useRealtime";
import { useConversationCheckpoints } from "./useConversationCheckpoints";
import { conversationService } from "../../../services/api/conversationService";

vi.mock("./useRealtime", () => ({
    useRealtime: vi.fn(),
}));

vi.mock("../../../services/api/conversationService", () => ({
    conversationService: {
        getCheckpoints: vi.fn(),
    },
}));

const conversationId = "507f1f77bcf86cd799439011";
const otherConversationId = "607f1f77bcf86cd799439011";

const currentUserId = "user-01";
const otherUserId = "user-02";

const messageId = "507f1f77bcf86cd799439012";
const newerMessageId = "507f1f77bcf86cd799439013";

let handlers;
let socket;

function CheckpointProbe({
    activeConversationId = conversationId,
}) {
    const checkpoints = useConversationCheckpoints(
        activeConversationId,
        currentUserId
    );

    return (
        <output data-testid="checkpoints">
            {JSON.stringify(checkpoints)}
        </output>
    );
}

function getCheckpoints() {
    return JSON.parse(
        screen.getByTestId("checkpoints").textContent
    );
}

function emit(event, checkpoint) {
    act(() => {
        handlers.get(event)?.({ checkpoint });
    });
}

function createCheckpoint({
    activeConversationId = conversationId,
    id = messageId,
    date = "2026-11-21T10:00:00.000Z",
} = {}) {
    return {
        conversation_id: activeConversationId,
        user_id: otherUserId,
        last_delivered_message_id: id,
        last_delivered_at: date,
        last_read_message_id: id,
        last_read_at: date,
    };
}

beforeEach(() => {
    vi.resetAllMocks();

    handlers = new Map();

    socket = {
        connected: true,

        on: vi.fn((event, callback) => {
            handlers.set(event, callback);
        }),

        off: vi.fn((event, callback) => {
            if (handlers.get(event) === callback) {
                handlers.delete(event);
            }
        }),
    };

    useRealtime.mockReturnValue({
        socket,
        status: "connected",
    });

    conversationService.getCheckpoints.mockResolvedValue({
        checkpoints: [],
    });
});

afterEach(() => {
    cleanup();
});

// ========================================
// TESTES REALTIME EXISTENTES
// ========================================

test("deve receber checkpoint de entrega", () => {
    render(<CheckpointProbe />);

    emit("message:delivery:update", {
        conversation_id: conversationId,
        user_id: otherUserId,
        last_delivered_message_id: messageId,
        last_delivered_at: "2026-11-21T10:00:00.000Z",
    });

    expect(
        getCheckpoints()[otherUserId].last_delivered_message_id
    ).toBe(messageId);
});

test("deve receber checkpoint de leitura", () => {
    render(<CheckpointProbe />);

    emit("message:read:update", createCheckpoint());

    expect(
        getCheckpoints()[otherUserId].last_read_message_id
    ).toBe(messageId);
});

test("deve ignorar outras conversas e o próprio usuário", () => {
    render(<CheckpointProbe />);

    emit("message:delivery:update", {
        conversation_id: otherConversationId,
        user_id: otherUserId,
        last_delivered_message_id: messageId,
    });

    emit("message:read:update", {
        conversation_id: conversationId,
        user_id: currentUserId,
        last_read_message_id: messageId,
    });

    expect(getCheckpoints()).toEqual({});
});

test("não deve regredir checkpoints antigos", () => {
    render(<CheckpointProbe />);

    emit("message:read:update", createCheckpoint({
        id: newerMessageId,
        date: "2026-11-21T10:10:00.000Z",
    }));

    emit("message:delivery:update", createCheckpoint());

    const checkpoint = getCheckpoints()[otherUserId];

    expect(checkpoint.last_delivered_message_id)
        .toBe(newerMessageId);

    expect(checkpoint.last_read_message_id)
        .toBe(newerMessageId);
});

test("deve limpar listeners ao trocar de conversa", () => {
    const { rerender, unmount } = render(
        <CheckpointProbe />
    );

    emit("message:delivery:update", createCheckpoint());

    expect(getCheckpoints()[otherUserId]).toBeDefined();

    rerender(
        <CheckpointProbe
            activeConversationId={otherConversationId}
        />
    );

    expect(getCheckpoints()).toEqual({});

    expect(socket.off).toHaveBeenCalledWith(
        "message:delivery:update",
        expect.any(Function)
    );

    unmount();

    expect(socket.off).toHaveBeenCalledWith(
        "message:read:update",
        expect.any(Function)
    );
});

// ========================================
// NOVOS TESTES DE PERSISTÊNCIA
// ========================================

test("deve recuperar checkpoint persistido após abrir conversa", async () => {
    conversationService.getCheckpoints.mockResolvedValue({
        checkpoints: [createCheckpoint()],
    });

    render(<CheckpointProbe />);

    await waitFor(() => {
        expect(
            getCheckpoints()[otherUserId].last_read_message_id
        ).toBe(messageId);
    });

    expect(
        conversationService.getCheckpoints
    ).toHaveBeenCalledWith(conversationId);
});

test("resposta HTTP antiga não deve sobrescrever evento realtime", async () => {
    let resolveRequest;

    conversationService.getCheckpoints.mockImplementation(
        () => new Promise((resolve) => {
            resolveRequest = resolve;
        })
    );

    render(<CheckpointProbe />);

    emit("message:read:update", createCheckpoint({
        id: newerMessageId,
        date: "2026-11-21T10:10:00.000Z",
    }));

    await act(async () => {
        resolveRequest({
            checkpoints: [createCheckpoint()],
        });
    });

    expect(
        getCheckpoints()[otherUserId].last_read_message_id
    ).toBe(newerMessageId);
});

test("não deve aplicar resposta HTTP de conversa anterior", async () => {
    const resolvers = new Map();

    conversationService.getCheckpoints.mockImplementation(
        (id) => new Promise((resolve) => {
            resolvers.set(id, resolve);
        })
    );

    const { rerender } = render(<CheckpointProbe />);

    rerender(
        <CheckpointProbe
            activeConversationId={otherConversationId}
        />
    );

    await act(async () => {
        resolvers.get(conversationId)({
            checkpoints: [createCheckpoint()],
        });
    });

    expect(getCheckpoints()).toEqual({});

    await act(async () => {
        resolvers.get(otherConversationId)({
            checkpoints: [
                createCheckpoint({
                    activeConversationId: otherConversationId,
                }),
            ],
        });
    });

    expect(
        getCheckpoints()[otherUserId].conversation_id
    ).toBe(otherConversationId);
});

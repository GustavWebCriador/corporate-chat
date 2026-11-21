import { expect, test } from "vitest";

import {
    MESSAGE_STATUS,
    createClientMessageId,
    formatMessageTimestamp,
    fromServerMessage,
    mergeMessages,
} from "./messages";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function serverMessage(id, createdAt, senderId = OTHER, clientId = `c-${id}`) {
    return fromServerMessage(
        {
            _id: id,
            conversation_id: "conv-1",
            sender_id: senderId,
            client_message_id: clientId,
            content: `mensagem ${id}`,
            created_at: createdAt,
        },
        ME
    );
}

test("gera clientMessageId único a cada envio", () => {
    const first = createClientMessageId();
    const second = createClientMessageId();

    expect(first).toMatch(/^web-/);
    expect(first).not.toBe(second);
});

test("marca mensagens próprias persistidas como Enviada", () => {
    expect(serverMessage("a", "2026-11-20T10:00:00Z", ME).status)
        .toBe(MESSAGE_STATUS.SENT);

    expect(serverMessage("b", "2026-11-20T10:00:00Z").status)
        .toBeNull();
});

test("ordena cronologicamente e não duplica mensagens pelo _id", () => {
    const merged = mergeMessages(
        [serverMessage("b", "2026-11-20T10:05:00Z")],
        [
            serverMessage("a", "2026-11-20T10:00:00Z"),
            serverMessage("b", "2026-11-20T10:05:00Z"),
        ]
    );

    expect(merged.map((item) => item.id)).toEqual(["a", "b"]);
});

test("concilia mensagem pendente pelo clientMessageId", () => {
    const pending = {
        key: "local-1",
        id: null,
        clientMessageId: "web-123",
        senderId: ME,
        content: "Olá",
        createdAt: "2026-11-20T10:10:00Z",
        isOwn: true,
        status: MESSAGE_STATUS.SENDING,
    };

    const merged = mergeMessages(
        [serverMessage("a", "2026-11-20T10:00:00Z"), pending],
        [serverMessage("z", "2026-11-20T10:10:01Z", ME, "web-123")]
    );

    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({
        key: "local-1",
        id: "z",
        status: MESSAGE_STATUS.SENT,
    });
});

test("exibe só o horário para hoje e data completa nos demais dias", () => {
    const now = new Date(2026, 10, 20, 15, 0);

    expect(formatMessageTimestamp(new Date(2026, 10, 20, 9, 5), now))
        .toBe("09:05");

    expect(formatMessageTimestamp(new Date(2026, 10, 19, 9, 5), now))
        .toBe("19/11/2026 09:05");

    expect(formatMessageTimestamp("invalida", now)).toBe("");
});

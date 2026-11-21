
import { expect, test } from "vitest";

import { getMessageStatus } from "./messageStatus";

const currentUserId = "user-01";
const recipientUserId = "user-02";

const messages = [
    {
        _id: "msg-01",
        sender_id: currentUserId,
        content: "Primeira mensagem",
    },
    {
        _id: "msg-02",
        sender_id: recipientUserId,
        content: "Resposta",
    },
    {
        _id: "msg-03",
        sender_id: currentUserId,
        content: "Segunda mensagem",
    },
];

function resolve(message, checkpoints = {}) {
    return getMessageStatus({
        message,
        messages,
        currentUserId,
        recipientUserId,
        checkpoints,
    });
}

test("não deve mostrar status em mensagem recebida", () => {
    expect(resolve(messages[1])).toBeNull();
});

test("deve mostrar enviada quando não há checkpoint", () => {
    expect(resolve(messages[0])).toBe("sent");
});

test("deve mostrar entregue quando destinatário confirmou", () => {
    const checkpoints = {
        [recipientUserId]: {
            last_delivered_message_id: "msg-03",
        },
    };

    expect(
        resolve(messages[0], checkpoints)
    ).toBe("delivered");

    expect(
        resolve(messages[2], checkpoints)
    ).toBe("delivered");
});

test("deve mostrar lida quando destinatário confirmou", () => {
    const checkpoints = {
        [recipientUserId]: {
            last_delivered_message_id: "msg-03",
            last_read_message_id: "msg-03",
        },
    };

    expect(resolve(messages[0], checkpoints)).toBe("read");
    expect(resolve(messages[2], checkpoints)).toBe("read");
});

test("não deve aplicar checkpoint antigo à mensagem nova", () => {
    const checkpoints = {
        [recipientUserId]: {
            last_delivered_message_id: "msg-01",
            last_read_message_id: "msg-01",
        },
    };

    expect(resolve(messages[0], checkpoints)).toBe("read");
    expect(resolve(messages[2], checkpoints)).toBe("sent");
});

test("não deve presumir leitura quando checkpoint não está carregado", () => {
    const checkpoints = {
        [recipientUserId]: {
            last_read_message_id: "msg-fora-do-historico",
        },
    };

    expect(resolve(messages[0], checkpoints)).toBe("sent");
});

test("deve ignorar checkpoint de outro participante", () => {
    const checkpoints = {
        "user-03": {
            last_read_message_id: "msg-03",
        },
    };

    expect(resolve(messages[0], checkpoints)).toBe("sent");
});

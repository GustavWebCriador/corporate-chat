import { describe, expect, it } from "vitest";

import {
    isValidRealtimeMessage,
    mergeRealtimeMessage,
    rememberNewestMessage,
    replayRealtimeMessages,
} from "./realtimeConversations";

const older = {
    _id: "507f1f77bcf86cd799439001",
    conversation_id: "group-01",
    sender_id: "user-02",
    content: "Anterior",
    created_at: "2026-11-21T12:00:00.000Z",
};
const newer = {
    ...older,
    _id: "507f1f77bcf86cd799439002",
    content: "Atualizada",
    created_at: "2026-11-21T13:00:00.000Z",
};
const dashboard = {
    contacts: [],
    conversations: [
        {
            conversation_id: "private-01",
            type: "PRIVATE",
            last_message: { message_id: "msg-private", content: "Contato" },
            last_message_at: "2026-11-21T12:20:00.000Z",
        },
        {
            conversation_id: "group-01",
            type: "GROUP",
            name: "Equipe",
            last_message: null,
            last_message_at: null,
            created_at: "2026-11-21T10:00:00.000Z",
        },
    ],
};

describe("realtimeConversations", () => {
    it("valida o contrato message:new antes de atualizar a interface", () => {
        expect(isValidRealtimeMessage(older)).toBe(true);
        expect(isValidRealtimeMessage({ ...older, created_at: "inválido" })).toBe(false);
        expect(isValidRealtimeMessage({ ...older, sender_id: null })).toBe(false);
        expect(isValidRealtimeMessage(null)).toBe(false);
    });

    it("rejeita conteúdo inválido", () => {
        expect(isValidRealtimeMessage({ ...older, content: null })).toBe(false);
    });

    it("atualiza prévia e ordenação no formato do dashboard", () => {
        const updated = mergeRealtimeMessage(dashboard, newer);
        expect(updated.conversations[0]).toMatchObject({
            conversation_id: "group-01",
            last_message_at: newer.created_at,
            last_message: {
                message_id: newer._id,
                sender_id: newer.sender_id,
                content: "Atualizada",
            },
        });
        expect(updated.contacts).toBe(dashboard.contacts);
    });

    it("ignora evento repetido ou mais antigo sem regredir a prévia", () => {
        const updated = mergeRealtimeMessage(dashboard, newer);
        expect(mergeRealtimeMessage(updated, newer)).toBe(updated);
        expect(mergeRealtimeMessage(updated, older)).toBe(updated);
    });

    it("não inventa conversas desconhecidas nem aceita eventos inválidos", () => {
        expect(mergeRealtimeMessage(dashboard, { ...newer, conversation_id: "outra" })).toBe(dashboard);
        expect(mergeRealtimeMessage(dashboard, { ...newer, content: null })).toBe(dashboard);
    });

    it("reaplica eventos recentes sobre resposta HTTP atrasada", () => {
        const map = new Map();
        rememberNewestMessage(map, newer);
        rememberNewestMessage(map, older);
        expect(map.get("group-01")).toEqual(newer);
        const result = replayRealtimeMessages(dashboard, map);
        expect(result.conversations[0].last_message.content).toBe("Atualizada");
    });

    it("mantém somente as 100 últimas conversas observadas", () => {
        const map = new Map();
        for (let i = 0; i < 101; i += 1) {
            rememberNewestMessage(map, { ...older, conversation_id: `group-${i}` });
        }
        expect(map.size).toBe(100);
        expect(map.has("group-0")).toBe(false);
    });
});
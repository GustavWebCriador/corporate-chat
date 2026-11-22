import { describe, expect, it, vi } from "vitest";
import {
    assertLocalBackendUrl,
    createApi,
    waitSocketEvent,
    socketAck,
    assertMessage,
} from "./fe07-live-core.mjs";

describe("FE-07 - proteção e contratos do executor de integração real", () => {
    it("aceita apenas backend HTTP local", () => {
        expect(assertLocalBackendUrl("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
        expect(assertLocalBackendUrl("http://localhost:3001/")).toBe("http://localhost:3001");
    });
    it.each([
        "https://localhost:3000", "http://api.empresa.com", "http://10.0.0.1:3000",
        "http://localhost:3000/api/v1", "http://user:pass@localhost:3000",
        "http://localhost:3000?x=1", "url-invalida",
    ])("rejeita destino não autorizado: %s", (url) => {
        expect(() => assertLocalBackendUrl(url)).toThrow();
    });
    it("lê resposta com envelope data e configura JWT", async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            status: 200,
            text: async () => JSON.stringify({ data: { items: [1] } }),
        });
        const request = createApi("http://localhost:3000", fetchImpl);
        const result = await request("GET", "/dashboard", { token: "jwt-teste" });
        expect(result.data.items).toEqual([1]);
        expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer jwt-teste");
    });
    it("falha com status inesperado sem expor resposta sensível", async () => {
        const request = createApi("http://localhost:3000", vi.fn().mockResolvedValue({
            status: 403,
            text: async () => JSON.stringify({ error: { code: "FORBIDDEN", message: "Dados privados" } }),
        }));
        await expect(request("GET", "/dashboard")).rejects.toThrow("HTTP 403 (FORBIDDEN)");
    });
    it("não permite caminho externo ou protocolo embutido", async () => {
        const request = createApi("http://localhost:3000", vi.fn());
        await expect(request("GET", "//evil.example")).rejects.toThrow("Caminho");
    });
    it("normaliza validação de mensagens", () => {
        expect(assertMessage({ _id:"m1", conversation_id:"c1", sender_id:"u1", content:"Olá" }, "c1", "u1", "Olá")._id).toBe("m1");
        expect(() => assertMessage({ _id:"m1", conversation_id:"c2" }, "c1", "u1", "Olá")).toThrow();
    });
    it("aceita ACK válido e rejeita erro do backend", async () => {
        const socket = { connected: true, timeout: vi.fn().mockReturnValue({ emitWithAck: vi.fn().mockResolvedValue({ ok: true, data: { a: 1 } }) }) };
        await expect(socketAck(socket, "realtime:sync", {})).resolves.toEqual({ a: 1 });
        socket.timeout.mockReturnValue({ emitWithAck: vi.fn().mockResolvedValue({ ok: false, error: { code: "SEM_PERMISSAO" } }) });
        await expect(socketAck(socket, "realtime:sync", {})).rejects.toThrow("SEM_PERMISSAO");
    });
    it("aguarda evento do socket e remove listeners", async () => {
        const handlers = new Map();
        const socket = {
            on: vi.fn((name, handler) => handlers.set(name, handler)),
            off: vi.fn((name) => handlers.delete(name)),
        };
        const pending = waitSocketEvent(socket, "message:new", (p) => p?.id === 2, 500);
        handlers.get("message:new")({ id: 1 });
        handlers.get("message:new")({ id: 2 });
        await expect(pending).resolves.toEqual({ id: 2 });
        expect(handlers.has("message:new")).toBe(false);
    });
});
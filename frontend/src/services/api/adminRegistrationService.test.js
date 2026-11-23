import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "./httpClient";
import { adminRegistrationService } from "./adminRegistrationService";

vi.mock("./httpClient", () => ({
    httpClient: { get: vi.fn(), post: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe("FE-08 - API de solicitações administrativas", () => {
    it("lista solicitações pendentes com paginação padrão", async () => {
        httpClient.get.mockResolvedValue({ requests: [] });
        await adminRegistrationService.list();
        expect(httpClient.get).toHaveBeenCalledWith("/admin/registration-requests", {
            params: { status: "PENDING", limit: 20, offset: 0 },
        });
    });

    it("envia filtros e paginação solicitados", async () => {
        await adminRegistrationService.list({ status: "REJECTED", limit: 10, offset: 20 });
        expect(httpClient.get).toHaveBeenCalledWith("/admin/registration-requests", {
            params: { status: "REJECTED", limit: 10, offset: 20 },
        });
    });

    it("aprova com senha inicial, sem enviá-la na URL", async () => {
        await adminRegistrationService.approve("req-1", "SenhaInicial123");
        expect(httpClient.post).toHaveBeenCalledWith(
            "/admin/registration-requests/req-1/approve", { password: "SenhaInicial123" }
        );
    });

    it("rejeita com justificativa no corpo da requisição", async () => {
        await adminRegistrationService.reject("req-2", "Dados insuficientes");
        expect(httpClient.post).toHaveBeenCalledWith(
            "/admin/registration-requests/req-2/reject", { reason: "Dados insuficientes" }
        );
    });
});
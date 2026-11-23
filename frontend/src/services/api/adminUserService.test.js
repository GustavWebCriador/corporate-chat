import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "./httpClient";
import { adminUserService } from "./adminUserService";

vi.mock("./httpClient", () => ({
    httpClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe("FE-08 - API de administração de usuários", () => {
    it("consulta a listagem", async () => {
        await adminUserService.list();
        expect(httpClient.get).toHaveBeenCalledWith("/admin/users");
    });

    it("consulta um usuário", async () => {
        await adminUserService.getById("user-1");
        expect(httpClient.get).toHaveBeenCalledWith("/admin/users/user-1");
    });

    it("cadastra sem enviar privilégios administrativos", async () => {
        await adminUserService.create({ name: "Maria", email: "maria@teste.com", password: "SenhaInicial123" });
        expect(httpClient.post).toHaveBeenCalledWith("/admin/users", {
            name: "Maria", email: "maria@teste.com", password: "SenhaInicial123",
        });
    });

    it("altera somente o status do usuário", async () => {
        await adminUserService.changeStatus("user-1", "INACTIVE");
        expect(httpClient.patch).toHaveBeenCalledWith("/admin/users/user-1/status", { status: "INACTIVE" });
    });

    it("redefine senha pelo endpoint dedicado", async () => {
        await adminUserService.resetPassword("user-1", "SenhaNova123");
        expect(httpClient.patch).toHaveBeenCalledWith("/admin/users/user-1/password", { password: "SenhaNova123" });
    });
});
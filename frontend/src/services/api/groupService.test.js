
import { beforeEach, describe, expect, it, vi } from "vitest";
import { groupService } from "./groupService";
import { httpClient } from "./httpClient";

vi.mock("./httpClient", () => ({
    httpClient: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));

const groupId = "507f1f77bcf86cd799439011";
const userId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => vi.resetAllMocks());

describe("groupService", () => {
    it("deve criar um grupo", async () => {
        const response = { group: { _id: groupId, type: "GROUP" } };
        httpClient.post.mockResolvedValue(response);
        expect(await groupService.create("Equipe", [userId])).toEqual(response);
        expect(httpClient.post).toHaveBeenCalledWith("/groups", {
            name: "Equipe",
            memberIds: [userId],
        });
    });

    it("não deve enviar a identidade do criador", async () => {
        httpClient.post.mockResolvedValue({ group: { _id: groupId } });
        await groupService.create("Equipe", [userId]);
        const payload = httpClient.post.mock.calls[0][1];
        expect(payload).not.toHaveProperty("creatorId");
        expect(payload).not.toHaveProperty("requesterId");
    });

    it("deve consultar o grupo", async () => {
        const response = { group: { _id: groupId, members: [] } };
        httpClient.get.mockResolvedValue(response);
        expect(await groupService.get(groupId)).toEqual(response);
        expect(httpClient.get).toHaveBeenCalledWith(`/groups/${groupId}`);
    });

    it("deve renomear o grupo", async () => {
        const response = { group: { _id: groupId, name: "Equipe Nova" } };
        httpClient.patch.mockResolvedValue(response);
        expect(await groupService.rename(groupId, "Equipe Nova")).toEqual(response);
        expect(httpClient.patch).toHaveBeenCalledWith(`/groups/${groupId}`, {
            name: "Equipe Nova",
        });
    });

    it("deve adicionar participantes", async () => {
        httpClient.post.mockResolvedValue({ group: { _id: groupId } });
        await groupService.addMembers(groupId, [userId]);
        expect(httpClient.post).toHaveBeenCalledWith(
            `/groups/${groupId}/members`,
            { memberIds: [userId] }
        );
    });

    it("deve remover um participante", async () => {
        httpClient.delete.mockResolvedValue(null);
        expect(await groupService.removeMember(groupId, userId)).toBeNull();
        expect(httpClient.delete).toHaveBeenCalledWith(
            `/groups/${groupId}/members/${userId}`
        );
    });

    it("deve permitir saída voluntária", async () => {
        httpClient.post.mockResolvedValue(null);
        expect(await groupService.leave(groupId)).toBeNull();
        expect(httpClient.post).toHaveBeenCalledWith(`/groups/${groupId}/leave`);
    });

    it("deve codificar identificadores na URL", async () => {
        httpClient.delete.mockResolvedValue(null);
        await groupService.removeMember("grupo/123", "usuario/456");
        expect(httpClient.delete).toHaveBeenCalledWith(
            "/groups/grupo%2F123/members/usuario%2F456"
        );
    });

    it("deve preservar erros de autorização", async () => {
        const error = new Error("Permissão negada");
        error.status = 403;
        error.code = "GROUP_CREATOR_REQUIRED";
        httpClient.patch.mockRejectedValue(error);
        await expect(groupService.rename(groupId, "Novo")).rejects.toMatchObject({
            status: 403,
            code: "GROUP_CREATOR_REQUIRED",
        });
    });
});

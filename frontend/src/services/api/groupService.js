import { httpClient } from "./httpClient";

/**
 * Serviço de grupos (FE-05).
 *
 * Contrato: docs/api-docs/GROUPS.md. A identidade do criador e de quem
 * executa cada operação é sempre obtida pelo backend a partir do JWT.
 */
export const groupService = {
    // Cria o grupo; o usuário autenticado entra como CREATOR (RF09).
    create(name, memberIds) {
        return httpClient.post("/groups", { name, memberIds });
    },

    // Dados do grupo e participantes ativos.
    get(groupId) {
        return httpClient.get(`/groups/${groupId}`);
    },

    // Somente o criador (CA09.8).
    rename(groupId, name) {
        return httpClient.patch(`/groups/${groupId}`, { name });
    },

    // Somente o criador, respeitando o limite de 50 (CA09.6).
    addMembers(groupId, memberIds) {
        return httpClient.post(`/groups/${groupId}/members`, { memberIds });
    },

    // Somente o criador (CA09.7).
    removeMember(groupId, userId) {
        return httpClient.delete(`/groups/${groupId}/members/${userId}`);
    },

    // Saída voluntária (CA09.9).
    leave(groupId) {
        return httpClient.post(`/groups/${groupId}/leave`);
    },
};


import { httpClient } from "./httpClient";

function groupPath(groupId) {
    return `/groups/${encodeURIComponent(groupId)}`;
}

export const groupService = {
    create(name, memberIds) {
        return httpClient.post("/groups", { name, memberIds });
    },

    get(groupId) {
        return httpClient.get(groupPath(groupId));
    },

    rename(groupId, name) {
        return httpClient.patch(groupPath(groupId), { name });
    },

    addMembers(groupId, memberIds) {
        return httpClient.post(`${groupPath(groupId)}/members`, { memberIds });
    },

    removeMember(groupId, userId) {
        return httpClient.delete(
            `${groupPath(groupId)}/members/${encodeURIComponent(userId)}`
        );
    },

    leave(groupId) {
        return httpClient.post(`${groupPath(groupId)}/leave`);
    },
};

import { httpClient } from "./httpClient";

/** Integração FE-08 com a API administrativa de usuários (BE-04). */
export const adminUserService = {
    list() {
        return httpClient.get("/admin/users");
    },

    getById(userId) {
        return httpClient.get(`/admin/users/${encodeURIComponent(userId)}`);
    },

    create({ name, email, password }) {
        return httpClient.post("/admin/users", { name, email, password });
    },

    changeStatus(userId, status) {
        return httpClient.patch(
            `/admin/users/${encodeURIComponent(userId)}/status`,
            { status }
        );
    },

    resetPassword(userId, password) {
        return httpClient.patch(
            `/admin/users/${encodeURIComponent(userId)}/password`,
            { password }
        );
    },
};
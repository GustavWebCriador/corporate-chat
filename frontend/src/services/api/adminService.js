import { httpClient } from "./httpClient";

/**
 * Serviço administrativo (FE-08).
 *
 * Contratos: docs/api-docs/ADMIN_USERS.md e REGISTRATION.md.
 * Todas as rotas exigem JWT de usuário ACTIVE com is_admin = true;
 * a autorização é sempre verificada pelo backend.
 */
export const adminService = {
    // RF03 — usuários
    listUsers() {
        return httpClient.get("/admin/users");
    },

    createUser({ name, email, password }) {
        return httpClient.post("/admin/users", { name, email, password });
    },

    setUserStatus(userId, status) {
        return httpClient.patch(`/admin/users/${userId}/status`, { status });
    },

    resetPassword(userId, password) {
        return httpClient.patch(`/admin/users/${userId}/password`, { password });
    },

    // RF04 — solicitações de cadastro
    listRequests({ status = "PENDING", limit = 20, offset = 0 } = {}) {
        return httpClient.get("/admin/registration-requests", {
            params: { status, limit, offset },
        });
    },

    approveRequest(requestId, password) {
        return httpClient.post(
            `/admin/registration-requests/${requestId}/approve`,
            { password }
        );
    },

    rejectRequest(requestId, reason) {
        return httpClient.post(
            `/admin/registration-requests/${requestId}/reject`,
            { reason }
        );
    },
};

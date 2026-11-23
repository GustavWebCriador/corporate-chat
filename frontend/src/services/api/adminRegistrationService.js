import { httpClient } from "./httpClient";

/** Integração FE-08 com as rotas administrativas de cadastro (BE-05). */
export const adminRegistrationService = {
    list({ status = "PENDING", limit = 20, offset = 0 } = {}) {
        return httpClient.get("/admin/registration-requests", {
            params: { status, limit, offset },
        });
    },

    approve(requestId, password) {
        return httpClient.post(
            `/admin/registration-requests/${encodeURIComponent(requestId)}/approve`,
            { password }
        );
    },

    reject(requestId, reason) {
        return httpClient.post(
            `/admin/registration-requests/${encodeURIComponent(requestId)}/reject`,
            { reason }
        );
    },
};
import { httpClient } from "./httpClient";

export const dashboardService = {
    getDashboard(limit = 50) {
        // A identidade é obtida pelo backend a partir do JWT.
        // O frontend não deve enviar um userId para esta consulta.
        return httpClient.get("/dashboard", {
            params: { limit },
        });
    },
};

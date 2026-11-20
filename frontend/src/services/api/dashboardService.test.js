
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import { dashboardService } from "./dashboardService";
import { httpClient } from "./httpClient";

vi.mock("./httpClient", () => ({
    httpClient: {
        get: vi.fn(),
    },
}));

describe("dashboardService", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("deve consultar o dashboard com limite padrão", async () => {
        const dashboard = {
            contacts: [],
            conversations: [],
        };

        httpClient.get.mockResolvedValue(dashboard);

        const result = await dashboardService.getDashboard();

        expect(httpClient.get).toHaveBeenCalledWith(
            "/dashboard",
            {
                params: { limit: 50 },
            }
        );

        expect(result).toEqual(dashboard);
    });

    it("deve permitir definir o limite de conversas", async () => {
        httpClient.get.mockResolvedValue({
            contacts: [],
            conversations: [],
        });

        await dashboardService.getDashboard(25);

        expect(httpClient.get).toHaveBeenCalledWith(
            "/dashboard",
            {
                params: { limit: 25 },
            }
        );
    });

    it("deve propagar erros da API", async () => {
        const apiError = new Error("Sessão expirada.");
        apiError.status = 401;

        httpClient.get.mockRejectedValue(apiError);

        await expect(
            dashboardService.getDashboard()
        ).rejects.toMatchObject({
            message: "Sessão expirada.",
            status: 401,
        });
    });
});

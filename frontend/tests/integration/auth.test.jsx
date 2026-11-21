import { describe, expect, test, vi } from "vitest";

import { authService } from "../../src/services/api/authService";
import { dashboardService } from "../../src/services/api/dashboardService";
import {
    setAuthToken,
    setUnauthorizedHandler,
} from "../../src/services/api/httpClient";

import { SEED, loginAs, tryLogin } from "./helpers";

describe("Autenticação e sessão (RF01, RF02, RF14)", () => {
    test("credenciais válidas autenticam e inválidas são recusadas", async () => {
        const session = await loginAs(SEED.alexandre);

        expect(session.token).toBeTruthy();
        expect(session.user).toMatchObject({
            email: SEED.alexandre,
            status: "ACTIVE",
        });
        expect(session.user).not.toHaveProperty("password_hash");

        expect(await tryLogin(SEED.alexandre, "SenhaErrada123")).toBe(401);
    });

    test("dashboard exige autenticação (CA05.1)", async () => {
        setAuthToken(null);

        await expect(dashboardService.getDashboard()).rejects.toMatchObject({
            status: 401,
        });
    });

    test("logout revoga o token e o 401 seguinte encerra a sessão local (CA02.2/CA14.2)", async () => {
        const handler = vi.fn();
        setUnauthorizedHandler(handler);

        await loginAs(SEED.alexandre);

        const dashboard = await dashboardService.getDashboard();
        expect(Array.isArray(dashboard.contacts)).toBe(true);

        await authService.logout();
        expect(handler).not.toHaveBeenCalled();

        await expect(dashboardService.getDashboard()).rejects.toMatchObject({
            status: 401,
            code: "TOKEN_REVOKED",
        });

        expect(handler).toHaveBeenCalledTimes(1);
        setUnauthorizedHandler(null);
    });

    test("senha incorreta no login não dispara o encerramento de sessão", async () => {
        const handler = vi.fn();
        setUnauthorizedHandler(handler);

        await expect(
            authService.login(SEED.alexandre, "SenhaErrada123")
        ).rejects.toMatchObject({ status: 401 });

        expect(handler).not.toHaveBeenCalled();
        setUnauthorizedHandler(null);
    });
});

import {
    afterEach,
    beforeEach,
    expect,
    test,
    vi,
} from "vitest";

import {
    httpClient,
    setAuthToken,
    setUnauthorizedHandler,
} from "./httpClient";

/**
 * Adaptador que simula a resposta do backend
 * sem realizar requisições reais.
 */
function respondWith(status, body) {
    httpClient.defaults.adapter = (config) => {
        const response = {
            data: body,
            status,
            statusText: String(status),
            headers: {},
            config,
        };

        if (status >= 400) {
            const error = new Error(`HTTP ${status}`);
            error.config = config;
            error.response = response;
            return Promise.reject(error);
        }

        return Promise.resolve(response);
    };
}

const unauthorizedBody = {
    error: {
        code: "TOKEN_EXPIRED",
        message: "Token expirado.",
    },
};

let handler;

beforeEach(() => {
    handler = vi.fn();
    setUnauthorizedHandler(handler);
});

afterEach(() => {
    setAuthToken(null);
    setUnauthorizedHandler(null);
});

test("notifica sessão encerrada quando requisição autenticada recebe 401", async () => {
    setAuthToken("jwt-teste");
    respondWith(401, unauthorizedBody);

    await expect(
        httpClient.get("/dashboard")
    ).rejects.toMatchObject({
        status: 401,
        code: "TOKEN_EXPIRED",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
        code: "TOKEN_EXPIRED",
    });
});

test("não notifica 401 de credenciais inválidas no login", async () => {
    setAuthToken("jwt-antigo");
    respondWith(401, {
        error: {
            code: "INVALID_CREDENTIALS",
            message: "E-mail ou senha inválidos.",
        },
    });

    await expect(
        httpClient.post("/auth/login", {})
    ).rejects.toMatchObject({ status: 401 });

    expect(handler).not.toHaveBeenCalled();
});

test("não notifica 401 de requisição sem token", async () => {
    respondWith(401, unauthorizedBody);

    await expect(
        httpClient.get("/dashboard")
    ).rejects.toMatchObject({ status: 401 });

    expect(handler).not.toHaveBeenCalled();
});

test("não notifica outros erros HTTP", async () => {
    setAuthToken("jwt-teste");
    respondWith(403, {
        error: {
            code: "ADMIN_REQUIRED",
            message: "Acesso restrito.",
        },
    });

    await expect(
        httpClient.get("/admin/users")
    ).rejects.toMatchObject({ status: 403 });

    expect(handler).not.toHaveBeenCalled();
});

test("mantém o retorno de data em respostas de sucesso", async () => {
    setAuthToken("jwt-teste");
    respondWith(200, { data: { ok: true } });

    await expect(
        httpClient.get("/health")
    ).resolves.toEqual({ ok: true });

    expect(handler).not.toHaveBeenCalled();
});

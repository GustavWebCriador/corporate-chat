import { authService } from "../../src/services/api/authService";
import { setAuthToken } from "../../src/services/api/httpClient";

export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/+$/, "");
export const PASSWORD = process.env.INTEGRATION_PASSWORD;
export const ORIGIN = "http://localhost:5173";

// Usuários criados pelo seed de desenvolvimento (npm run seed:dev).
export const SEED = Object.freeze({
    alexandre: "alexandre@corporatechat.local",
    eduardo: "eduardo@corporatechat.local",
    mauricio: "mauricio@corporatechat.local",
    gustavo: "gustavo@corporatechat.local", // administrador
});

// Sufixo único por execução para não colidir com dados anteriores.
export const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Autentica pelo serviço real do frontend e configura o JWT
 * no cliente HTTP compartilhado.
 */
export async function loginAs(email, password = PASSWORD) {
    setAuthToken(null);
    const session = await authService.login(email, password);
    setAuthToken(session.token);
    return session;
}

/**
 * Retorna true se o login for aceito ou o status HTTP da recusa.
 */
export async function tryLogin(email, password) {
    try {
        await authService.login(email, password);
        return true;
    } catch (error) {
        return error.status ?? error.code ?? "ERRO";
    }
}

/**
 * Requisição direta à API, sem o cliente do frontend.
 * Usada para simular um segundo usuário.
 */
export async function api(path, { token, body, method } = {}) {
    const response = await fetch(`${BACKEND_URL}/api/v1${path}`, {
        method: method ?? (body ? "POST" : "GET"),
        headers: {
            Origin: ORIGIN,
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const json = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
        const error = new Error(json?.error?.message ?? `HTTP ${response.status}`);
        error.status = response.status;
        error.code = json?.error?.code;
        throw error;
    }

    return json?.data ?? null;
}

export async function apiLogin(email, password = PASSWORD) {
    return api("/auth/login", { body: { email, password } });
}

/**
 * Senha temporária válida pela política (maiúscula + número),
 * diferente a cada execução. Usada só para contas criadas nos testes.
 */
export function tempPassword(tag) {
    return `Teste${tag}${RUN_ID}A1`;
}

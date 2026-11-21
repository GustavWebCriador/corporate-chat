import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

if (!backendUrl) {
    throw new Error(
        "VITE_BACKEND_URL não configurada."
    );
}

const httpClient = axios.create({
    baseURL: `${backendUrl.replace(/\/+$/, "")}/api/v1`,
    timeout: 10000,
    withCredentials: false,
    headers: {
        Accept: "application/json",
    },
});

let authToken = null;
let unauthorizedHandler = null;

function setAuthToken(token) {
    authToken = token || null;
}

/**
 * Registra a ação executada quando uma requisição autenticada
 * recebe 401 (sessão expirada, revogada ou inválida — RF02).
 */
function setUnauthorizedHandler(handler) {
    unauthorizedHandler =
        typeof handler === "function" ? handler : null;
}

// Rotas cuja resposta 401 não indica perda de sessão.
const SESSION_EXEMPT_PATHS = ["/auth/login", "/auth/logout"];

function isSessionExempt(url = "") {
    return SESSION_EXEMPT_PATHS.some((path) => url.endsWith(path));
}

/**
 * Interceptor de requisições.
 *
 * Adiciona o JWT automaticamente nas
 * requisições quando houver autenticação.
 */
httpClient.interceptors.request.use((config) => {
    if (authToken) {
        config.headers.Authorization =
            `Bearer ${authToken}`;
    }

    return config;
});


httpClient.interceptors.response.use(
    (response) => {
        if (response.status === 204) {
            return null;
        }

        return response.data?.data;
    },

    (error) => {
        if (error.response) {
            const apiError = new Error(
                error.response.data?.error?.message ??
                "Não foi possível concluir a requisição."
            );

            apiError.status = error.response.status;
            apiError.code =
                error.response.data?.error?.code;

            apiError.details =
                error.response.data?.error?.details;

            const headers = error.config?.headers;
            const sentWithToken = Boolean(
                headers?.get?.("Authorization") ??
                headers?.Authorization
            );

            if (
                apiError.status === 401 &&
                sentWithToken &&
                !isSessionExempt(error.config?.url) &&
                unauthorizedHandler
            ) {
                unauthorizedHandler(apiError);
            }

            return Promise.reject(apiError);
        }

        return Promise.reject(error);
    }
);


export { httpClient, setAuthToken, setUnauthorizedHandler };

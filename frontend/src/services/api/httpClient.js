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

function setAuthToken(token) {
    authToken = token || null;
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

            return Promise.reject(apiError);
        }

        return Promise.reject(error);
    }
);


export { httpClient, setAuthToken };

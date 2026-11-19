
import { httpClient } from "./httpClient";

/**
 * Serviço responsável pela autenticação
 * dos usuários do Corporate Chat.
 *
 * A comunicação utiliza a API REST
 * implementada no backend.
 */

export const authService = {
    // Realiza o login com e-mail e senha.
    login(email, password) {
        return httpClient.post("/auth/login", {
            email,
            password,
        });
    },

    // Consulta o usuário da sessão atual.
    me() {
        return httpClient.get("/auth/me");
    },

    // Encerra a sessão no backend.
    logout() {
        return httpClient.post("/auth/logout");
    },
};

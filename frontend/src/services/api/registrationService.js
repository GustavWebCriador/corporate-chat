
import { httpClient } from "./httpClient";

/**
 * Serviço responsável pelas solicitações
 * públicas de cadastro do Corporate Chat.
 *
 * Integração com a API implementada
 * na BE-05 do backend.
 */

export const registrationService = {
    /**
     * Envia uma solicitação de cadastro.
     *
     * @param {string} name - Nome do solicitante
     * @param {string} email - E-mail do solicitante
     *
     * @returns {Promise<object>}
     */
    requestAccess(name, email) {
        return httpClient.post("/registration-requests", {
            name,
            email,
        });
    },
};

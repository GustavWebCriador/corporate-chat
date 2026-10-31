const ALLOWED_PROTOCOLS =
    new Set([
        "http:",
        "https:",
    ]);


/*
 *
 * NORMALIZAÇÃO DE ORIGEM
 *
 *
 * Uma Origin válida contém somente:
 *
 * protocolo + host + porta opcional
 *
 * Exemplos:
 *
 * https://app.exemplo.com
 * http://localhost:5173
 *
 * Não aceitamos:
 *
 * https://site.com/path
 * https://site.com?query=1
 * https://site.com#fragment
 */
function normalizeCorsOrigin(
    value
) {
    if (
        typeof value !==
            "string" ||
        value.trim()
            .length === 0
    ) {
        throw new Error(
            "CORS_ORIGIN contém uma origem inválida."
        );
    }


    const origin =
        value.trim();


    /*
     * Wildcard é tratado separadamente.
     */
    if (
        origin ===
        "*"
    ) {
        return "*";
    }


    let parsed;


    try {
        parsed =
            new URL(
                origin
            );

    } catch {
        throw new Error(
            `CORS_ORIGIN contém uma origem inválida: ${origin}`
        );
    }


    if (
        !ALLOWED_PROTOCOLS
            .has(
                parsed.protocol
            )
    ) {
        throw new Error(
            `CORS_ORIGIN utiliza protocolo inválido: ${origin}`
        );
    }


    if (
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash ||
        (
            parsed.pathname &&
            parsed.pathname !==
                "/"
        )
    ) {
        throw new Error(
            `CORS_ORIGIN deve conter somente protocolo, host e porta: ${origin}`
        );
    }


    /*
     * URL.origin também remove
     * uma barra final desnecessária.
     */
    return parsed.origin;
}


/*
 *
 * ORIGENS CONFIGURADAS
 *
 */

function getConfiguredCorsOrigins() {
    const raw =
        process.env
            .CORS_ORIGIN;


    if (
        typeof raw !==
            "string" ||
        raw.trim()
            .length === 0
    ) {
        return [];
    }


    const origins =
        raw
            .split(",")
            .map(
                value =>
                    value.trim()
            )
            .filter(Boolean)
            .map(
                normalizeCorsOrigin
            );


    /*
     * Remove duplicidades preservando
     * a ordem configurada.
     */
    return [
        ...new Set(
            origins
        ),
    ];
}


/*
 *
 * ORIGENS PERMITIDAS
 *
 */

function getAllowedCorsOrigins() {
    const origins =
        getConfiguredCorsOrigins();


    const isProduction =
        process.env
            .NODE_ENV ===
        "production";


    /*
     * Produção deve possuir allowlist
     * explícita.
     */
    if (
        isProduction &&
        origins.length ===
            0
    ) {
        throw new Error(
            "CORS_ORIGIN é obrigatório em produção."
        );
    }


    /*
     * Wildcard elimina a proteção
     * oferecida por uma allowlist.
     */
    if (
        isProduction &&
        origins.includes(
            "*"
        )
    ) {
        throw new Error(
            "CORS_ORIGIN não pode utilizar '*' em produção."
        );
    }


    return origins;
}


/*
 *
 * VALIDAÇÃO DE ORIGEM
 *
 *
 * Também será reutilizada posteriormente
 * pelo Socket.IO.
 */
function isOriginAllowed(
    origin
) {
    /*
     * Clientes não-browser podem não
     * enviar Origin.
     *
     * Autenticação/autorização continuam
     * sendo a proteção real da API.
     */
    if (
        origin ===
            undefined ||
        origin ===
            null ||
        origin ===
            ""
    ) {
        return true;
    }


    const allowedOrigins =
        getAllowedCorsOrigins();


    /*
     * development/test sem configuração
     * explícita preserva o comportamento
     * flexível atual.
     */
    if (
        allowedOrigins.length ===
            0
    ) {
        return (
            process.env.NODE_ENV !==
            "production"
        );
    }


    if (
        allowedOrigins.includes(
            "*"
        )
    ) {
        return true;
    }


    let normalized;


    try {
        normalized =
            normalizeCorsOrigin(
                origin
            );

    } catch {
        return false;
    }


    return allowedOrigins
        .includes(
            normalized
        );
}


/*
 *
 * EXPRESS / SOCKET.IO CORS OPTIONS
 *
 */

function buildCorsOptions() {
    const allowedOrigins =
        getAllowedCorsOrigins();


    /*
     * Desenvolvimento e testes:
     *
     * sem configuração explícita,
     * reflete a Origin recebida.
     */
    if (
        allowedOrigins.length ===
            0
    ) {
        return {
            origin:
                true,

            credentials:
                false,
        };
    }


    /*
     * Wildcard só pode existir fora
     * de produção.
     */
    if (
        allowedOrigins.includes(
            "*"
        )
    ) {
        return {
            origin:
                "*",

            credentials:
                false,
        };
    }


    return {
        origin:
            allowedOrigins,

        /*
         * A aplicação utiliza Bearer JWT
         * e não autenticação baseada em
         * cookies cross-origin.
         */
        credentials:
            false,
    };
}
/*
 * SOCKET.IO ORIGIN VALIDATION
 *
 * O CORS tradicional protege requisições HTTP
 * realizadas pelo navegador.
 *
 * Para o handshake do Socket.IO também aplicamos
 * explicitamente a allowlist através de allowRequest.
 *
 * A autenticação JWT continua sendo obrigatória.
 * A validação de Origin é uma camada adicional.
 */
function buildSocketAllowRequest() {
    return function allowSocketRequest(
        request,
        callback
    ) {
        const origin =
            request
                ?.headers
                ?.origin;


        const allowed =
            isOriginAllowed(
                origin
            );


        return callback(
            null,
            allowed
        );
    };
}


module.exports = {
    buildCorsOptions,
    buildSocketAllowRequest,

    getConfiguredCorsOrigins,
    getAllowedCorsOrigins,
    isOriginAllowed,
    normalizeCorsOrigin,

};

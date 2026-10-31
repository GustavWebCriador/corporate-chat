const {
    rateLimit,
} = require(
    "express-rate-limit"
);


/*
 * CONFIGURAÇÃO
 */

const LOGIN_WINDOW_MS =
    15 * 60 * 1000;

const LOGIN_LIMIT =
    10;


const REGISTRATION_REQUEST_WINDOW_MS =
    60 * 60 * 1000;

const REGISTRATION_REQUEST_LIMIT =
    5;


/*
 *
 * RESPONSE HANDLER
 *
 */

function createRateLimitHandler(
    message
) {
    return function rateLimitHandler(
        req,
        res
    ) {
        return res
            .status(429)
            .json({
                error: {
                    code:
                        "RATE_LIMITED",

                    message,
                },
            });
    };
}


/*
 *
 * LOGIN RATE LIMITER
 *
 *
 * POST /api/v1/auth/login
 *
 * - 10 tentativas falhas;
 * - janela de 15 minutos;
 * - chave padrão baseada no IP;
 * - requisições bem-sucedidas são removidas
 *   da contagem;
 * - falhas permanecem contabilizadas.
 */
function createLoginRateLimiter(
    {
        windowMs =
            LOGIN_WINDOW_MS,

        limit =
            LOGIN_LIMIT,

    } = {}
) {
    return rateLimit({
        windowMs,

        limit,

        standardHeaders:
            "draft-8",

        legacyHeaders:
            false,

        skipSuccessfulRequests:
            true,

        skipFailedRequests:
            false,

        handler:
            createRateLimitHandler(
                "Muitas tentativas. Tente novamente mais tarde."
            ),
    });
}


/*
 *
 * REGISTRATION REQUEST RATE LIMITER
 *
 *
 * POST /api/v1/registration-requests
 *
 * Essa é uma rota pública e pode ser utilizada
 * sem autenticação.
 *
 * Diferentemente do login, tanto requisições
 * bem-sucedidas quanto rejeitadas contam para
 * o limite.
 *
 * Isso reduz:
 *
 * - spam;
 * - enumeração automatizada;
 * - geração excessiva de solicitações;
 * - abuso do endpoint público.
 */
function createRegistrationRequestRateLimiter(
    {
        windowMs =
            REGISTRATION_REQUEST_WINDOW_MS,

        limit =
            REGISTRATION_REQUEST_LIMIT,

    } = {}
) {
    return rateLimit({
        windowMs,

        limit,

        standardHeaders:
            "draft-8",

        legacyHeaders:
            false,

        skipSuccessfulRequests:
            false,

        skipFailedRequests:
            false,

        handler:
            createRateLimitHandler(
                "Muitas solicitações. Tente novamente mais tarde."
            ),
    });
}


module.exports = {
    createLoginRateLimiter,
    createRegistrationRequestRateLimiter,

    LOGIN_WINDOW_MS,
    LOGIN_LIMIT,

    REGISTRATION_REQUEST_WINDOW_MS,
    REGISTRATION_REQUEST_LIMIT,
};
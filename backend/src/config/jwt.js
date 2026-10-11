const jwt = require("jsonwebtoken");

const ALGORITHM = "HS256";
const ISSUER = "corporate-chat";
const DEFAULT_EXPIRES_IN = "1h";
const MIN_SECRET_LENGTH_PRODUCTION = 32;

/**
 * Lê a configuração do JWT no momento do uso (não na importação), para que
 * módulos que só importam este arquivo não exijam o .env.
 */
function getJwtConfig() {
    const secret = process.env.JWT_SECRET;

    if (!secret || !secret.trim()) {
        throw new Error("JWT_SECRET não configurado.");
    }

    if (
        process.env.NODE_ENV === "production" &&
        secret.length < MIN_SECRET_LENGTH_PRODUCTION
    ) {
        throw new Error(
            `JWT_SECRET deve ter pelo menos ${MIN_SECRET_LENGTH_PRODUCTION} caracteres em produção.`
        );
    }

    return {
        secret,
        expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
        algorithm: ALGORITHM,
        issuer: ISSUER,
    };
}

/**
 * Gera o token de acesso. O payload carrega apenas o necessário:
 * `sub` (user_id) e `is_admin`. Dados sensíveis nunca entram no token.
 */

/**
 * Gera o token de acesso JWT.
 *
 * sub: identificador do usuário
 * jti: identificador único da sessão
 * is_admin: indicador de permissão administrativa
 */
function signAccessToken({
    userId,
    isAdmin,
    sessionId,
}) {
    const UUID_REGEX =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
        typeof sessionId !== "string" ||
        !UUID_REGEX.test(sessionId)
    ) {
        throw new Error(
            "sessionId inválido para emissão do JWT."
        );
    }

    const {
        secret,
        expiresIn,
        algorithm,
        issuer,
    } = getJwtConfig();

    return jwt.sign(
        {
            is_admin: Boolean(isAdmin),
        },
        secret,
        {
            subject: String(userId),
            jwtid: sessionId,
            expiresIn,
            algorithm,
            issuer,
        }
    );
}


/**
 * Valida assinatura, algoritmo, emissor e expiração.
 * Lança o erro original do jsonwebtoken (TokenExpiredError, JsonWebTokenError...).
 */
function verifyAccessToken(token) {
    const { secret, algorithm, issuer } = getJwtConfig();

    return jwt.verify(token, secret, {
        algorithms: [algorithm],
        issuer,
    });
}

module.exports = {
    getJwtConfig,
    signAccessToken,
    verifyAccessToken,
};

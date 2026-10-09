const AppError = require("../errors/AppError");

function extractBearerToken(header) {
    if (typeof header !== "string") {
        return null;
    }

    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());

    return match ? match[1] : null;
}

/**
 * Middleware JWT (RF02). Lê "Authorization: Bearer <token>", valida o token e
 * preenche `req.user` com o usuário atual.
 *   401: token ausente, inválido ou expirado
 *   403: usuário inativo
 */
function createAuthenticate({ authService }) {
    return async function authenticate(req, res, next) {
        try {
            const token = extractBearerToken(req.headers.authorization);

            if (!token) {
                throw AppError.unauthorized(
                    "Token de autenticação ausente ou mal formatado.",
                    "TOKEN_MISSING"
                );
            }

            req.user = await authService.authenticateToken(token);

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Autorização administrativa. Deve vir depois do authenticate.
 *   401: sem usuário autenticado
 *   403: usuário autenticado, mas não administrador
 */
function requireAdmin(req, res, next) {
    if (!req.user) {
        return next(
            AppError.unauthorized("Autenticação necessária.", "AUTH_REQUIRED")
        );
    }

    if (!req.user.is_admin) {
        return next(
            AppError.forbidden(
                "Acesso restrito a administradores.",
                "ADMIN_REQUIRED"
            )
        );
    }

    return next();
}

module.exports = { createAuthenticate, requireAdmin, extractBearerToken };

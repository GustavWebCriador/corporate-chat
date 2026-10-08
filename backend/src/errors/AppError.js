/**
 * Erro operacional da aplicação.
 *
 * Qualquer erro esperado (validação, autenticação, recurso não encontrado...)
 * deve ser lançado como AppError. O errorHandler converte para o formato
 * padrão da API:
 *
 *   { "error": { "code": "...", "message": "...", "details": ... } }
 */
class AppError extends Error {
    constructor(message, { statusCode = 500, code = "INTERNAL_ERROR", details } = {}) {
        super(message);

        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }

    static badRequest(message = "Requisição inválida.", code = "BAD_REQUEST", details) {
        return new AppError(message, { statusCode: 400, code, details });
    }

    static unauthorized(message = "Autenticação necessária.", code = "UNAUTHORIZED") {
        return new AppError(message, { statusCode: 401, code });
    }

    static forbidden(message = "Acesso negado.", code = "FORBIDDEN") {
        return new AppError(message, { statusCode: 403, code });
    }

    static notFound(message = "Recurso não encontrado.", code = "NOT_FOUND") {
        return new AppError(message, { statusCode: 404, code });
    }

    static conflict(message = "Conflito de dados.", code = "CONFLICT", details) {
        return new AppError(message, { statusCode: 409, code, details });
    }
}

module.exports = AppError;
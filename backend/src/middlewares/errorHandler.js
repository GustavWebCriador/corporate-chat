const AppError = require("../errors/AppError");

/**
 * Converte qualquer erro no formato padrão:
 *
 *   { "error": { "code": "...", "message": "...", "details": ... } }
 *
 * Erros desconhecidos viram 500 INTERNAL_ERROR e nunca expõem a mensagem
 * original ao cliente (ela vai apenas para o log).
 */
function normalizeError(err) {
    if (err instanceof AppError) {
        return err;
    }

    // Erros do body parser do Express (JSON malformado, corpo grande demais).
    if (err && err.type === "entity.parse.failed") {
        return new AppError("O corpo da requisição não é um JSON válido.", {
            statusCode: 400,
            code: "INVALID_JSON",
        });
    }

    if (err && err.type === "entity.too.large") {
        return new AppError("O corpo da requisição excede o tamanho máximo permitido.", {
            statusCode: 413,
            code: "PAYLOAD_TOO_LARGE",
        });
    }

    return null;
}

// O Express identifica middleware de erro pela assinatura de 4 parâmetros.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    const known = normalizeError(err);

    if (!known) {
        if (process.env.NODE_ENV !== "test") {
            console.error("[API] Unexpected error:", err);
        }

        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Erro interno do servidor.",
            },
        });
    }

    const body = {
        code: known.code,
        message: known.message,
    };

    if (known.details !== undefined) {
        body.details = known.details;
    }

    return res.status(known.statusCode).json({ error: body });
}

module.exports = errorHandler;
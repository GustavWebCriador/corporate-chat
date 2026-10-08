const AppError = require("../errors/AppError");

/**
 * Última rota registrada: qualquer requisição que não casou com nenhuma rota
 * vira um 404 no formato padrão da API.
 */
function notFound(req, res, next) {
    next(
        new AppError(`Rota não encontrada: ${req.method} ${req.path}`, {
            statusCode: 404,
            code: "ROUTE_NOT_FOUND",
        })
    );
}

module.exports = notFound;
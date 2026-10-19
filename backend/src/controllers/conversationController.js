const AppError = require("../errors/AppError");

function createConversationController({ conversationService }) {
    async function createPrivate(req, res) {
        const otherUserId = req.body.otherUserId;

        if (!otherUserId) {
            return res.status(400).json({
                error: {
                    code: "OTHER_USER_ID_REQUIRED",
                    message: "Informe o ID do outro usuário.",
                },
            });
        }

        try {
            const conversation = await conversationService.createPrivateForUser({
                requesterId: req.user.user_id,
                otherUserId,
            });

            return res.status(201).json({
                data: { conversation },
            });
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({
                    error: {
                        code: error.code,
                        message: error.message,
                        ...(error.details && { details: error.details }),
                    },
                });
            }

            if (
                error &&
                error.name === "PersistenceIntegrationError"
            ) {
                const code = error.code;

                if (
                    code === "INVALID_CONVERSATION_ID" ||
                    code === "INVALID_QUERY_CURSOR"
                ) {
                    return res.status(400).json({
                        error: {
                            code,
                            message: error.message,
                            ...(error.details && { details: error.details }),
                        },
                    });
                }

                if (code === "CONVERSATION_NOT_FOUND") {
                    return res.status(404).json({
                        error: {
                            code,
                            message: error.message,
                            ...(error.details && { details: error.details }),
                        },
                    });
                }

                if (code === "USER_INACTIVE" || code === "SENDER_NOT_ACTIVE_MEMBER") {
                    return res.status(403).json({
                        error: {
                            code,
                            message: error.message,
                            ...(error.details && { details: error.details }),
                        },
                    });
                }

                if (code === "PRIVATE_CONVERSATION_SAME_USER") {
                    return res.status(400).json({
                        error: {
                            code,
                            message: error.message,
                            ...(error.details && { details: error.details }),
                        },
                    });
                }
            }

            // Erros inesperados ficam com 500
            return res.status(500).json({
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Erro interno do servidor.",
                },
            });
        }
    }

    async function list(req, res) {
        try {
            const conversations = await conversationService.listForUser({
                userId: req.user.user_id,
            });

            return res.status(200).json({
                data: { conversations },
            });
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({
                    error: {
                        code: error.code,
                        message: error.message,
                        ...(error.details && { details: error.details }),
                    },
                });
            }

            if (
                error &&
                error.name === "PersistenceIntegrationError"
            ) {
                return res.status(400).json({
                    error: {
                        code: error.code,
                        message: error.message,
                        ...(error.details && { details: error.details }),
                    },
                });
            }

            // Erros inesperados ficam com 500
            return res.status(500).json({
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Erro interno do servidor.",
                },
            });
        }
    }

    async function history(req, res) {
        try {
            const result = await conversationService.getHistory({
                conversationId: req.params.conversationId,
                userId: req.user.user_id,
                limit: req.query.limit,
                before: req.query.before || null,
            });

            return res.status(200).json({
                data: result,
            });
        } catch (error) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({
                    error: {
                        code: error.code,
                        message: error.message,
                        ...(error.details && { details: error.details }),
                    },
                });
            }

            // Tratar PersistenceIntegrationError pelo código
            if (
                error &&
                error.code &&
                (
                    error.code === "INVALID_CONVERSATION_ID" ||
                    error.code === "INVALID_QUERY_CURSOR" ||
                    error.code === "CONVERSATION_NOT_FOUND" ||
                    error.code === "USER_INACTIVE" ||
                    error.code === "SENDER_NOT_ACTIVE_MEMBER" ||
                    error.code === "USER_NOT_ACTIVE_MEMBER"
                )
            ) {
                if (
                    error.code === "INVALID_CONVERSATION_ID" ||
                    error.code === "INVALID_QUERY_CURSOR"
                ) {
                    return res.status(400).json({
                        error: {
                            code: error.code,
                            message: error.message,
                            ...(error.details && { details: error.details }),
                        },
                    });
                }

                if (error.code === "CONVERSATION_NOT_FOUND") {
                    return res.status(404).json({
                        error: {
                            code: error.code,
                            message: error.message,
                            ...(error.details && { details: error.details }),
                        },
                    });
                }

                if (error.code === "USER_INACTIVE" || error.code === "SENDER_NOT_ACTIVE_MEMBER" || error.code === "USER_NOT_ACTIVE_MEMBER") {
                    return res.status(403).json({
                        error: {
                            code: error.code,
                            message: error.message,
                            ...(error.details && { details: error.details }),
                        },
                    });
                }
            }

            // Erros inesperados ficam com 500
            return res.status(500).json({
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Erro interno do servidor.",
                },
            });
        }
    }

    return {
        createPrivate,
        list,
        history,
    };
}

module.exports = {
    createConversationController,
};
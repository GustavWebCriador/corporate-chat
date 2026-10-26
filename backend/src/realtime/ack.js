const AppError =
    require(
        "../errors/AppError"
    );


function toAckError(
    error
) {
    if (
        error instanceof
        AppError
    ) {
        return {
            code:
                error.code,

            message:
                error.message,

            ...(
                error.details !==
                undefined
                    ? {
                        details:
                            error.details,
                    }
                    : {}
            ),
        };
    }


    return {
        code:
            "INTERNAL_ERROR",

        message:
            "Erro interno do servidor.",
    };
}


function resolveAck(
    acknowledgement
) {
    return (
        typeof acknowledgement ===
            "function"
            ? acknowledgement
            : () => {}
    );
}


module.exports = {
    toAckError,
    resolveAck,
};
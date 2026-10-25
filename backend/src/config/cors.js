function buildCorsOptions() {
    const raw =
        process.env.CORS_ORIGIN;


    if (raw) {
        return {
            origin:
                raw
                    .split(",")
                    .map(
                        origin =>
                            origin.trim()
                    )
                    .filter(Boolean),
        };
    }


    /*
     * Sem CORS_ORIGIN:
     *
     * development/test -> permitido
     * production       -> bloqueado
     */
    return {
        origin:
            process.env.NODE_ENV !==
            "production",
    };
}


module.exports = {
    buildCorsOptions,
};
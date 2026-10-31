const helmet =
    require(
        "helmet"
    );


/*
 * =====================================================
 * SECURITY HEADERS
 * =====================================================
 *
 * Centraliza os headers HTTP de segurança.
 *
 * O backend não deve depender das configurações
 * padrão do navegador para proteção básica.
 *
 * Em desenvolvimento/teste não habilitamos HSTS,
 * evitando que localhost seja memorizado como HTTPS.
 */
function createSecurityHeaders() {
    const isProduction =
        process.env.NODE_ENV ===
        "production";


    const options = {
        /*
         * O Corporate Chat não possui motivo
         * para ser carregado dentro de iframe.
         */
        xFrameOptions: {
            action:
                "deny",
        },


        /*
         * Não envia informações da URL anterior
         * através do header Referer.
         */
        referrerPolicy: {
            policy:
                "no-referrer",
        },
    };


    /*
     * HSTS faz sentido no ambiente publicado
     * utilizando HTTPS.
     *
     * Em localhost pode causar comportamento
     * indesejado durante desenvolvimento.
     */
    if (!isProduction) {
        options
            .strictTransportSecurity =
            false;


        /*
         * Mantém a política CSP padrão do Helmet,
         * removendo somente upgrade-insecure-requests
         * no ambiente local.
         */
        options
            .contentSecurityPolicy = {
                directives: {
                    "upgrade-insecure-requests":
                        null,
                },
            };
    }


    return helmet(
        options
    );
}


module.exports = {
    createSecurityHeaders,
};
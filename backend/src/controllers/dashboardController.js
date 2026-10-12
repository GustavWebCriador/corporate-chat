function createDashboardController({
    dashboardService,
}) {

    /**
     * GET /api/v1/dashboard
     *
     * Retorna os dados necessários
     * para montagem do dashboard
     * do usuário autenticado.
     */
    async function getDashboard(
        req,
        res
    ) {

        const dashboard =
            await dashboardService
                .getDashboard({

                    /*
                     * A identidade sempre vem
                     * da autenticação.
                     *
                     * Nunca aceitamos userId
                     * enviado pelo cliente.
                     */
                    userId:
                        req.user.user_id,

                    query:
                        req.query,
                });


        return res
            .status(200)
            .json({

                data:
                    dashboard,
            });
    }


    return {

        getDashboard,
    };
}


module.exports = {

    createDashboardController,
};
/**
 * Repository PostgreSQL responsável pelo acesso
 * aos dados de usuários.
 *
 * Esta camada não deve conter regras de negócio.
 * Sua responsabilidade é exclusivamente acessar
 * e persistir dados.
 */
function createUserRepository() {

    /*
     * Models carregados sob demanda.
     *
     * Isso evita inicialização desnecessária
     * durante testes que utilizam repositories
     * in-memory.
     */
    function models() {

        return require(
            "../../models/postgres"
        );
    }


    /**
     * Busca usuário pelo e-mail normalizado.
     */
    async function findByEmail(
        email,
        options = {}
    ) {

        const {
            User,
            sequelize,
        } = models();


        const user =
            await User.findOne({
                where:
                    sequelize.where(
                        sequelize.fn(
                            "lower",
                            sequelize.col("email")
                        ),
                        email
                    ),

                transaction:
                    options.transaction,
            });


        return user
            ? user.get({
                plain: true,
            })
            : null;
    }


    /**
     * Busca usuário pelo UUID.
     */
    async function findById(
        userId,
        options = {}
    ) {

        const {
            User,
        } = models();


        const user =
            await User.findByPk(
                userId,
                {
                    transaction:
                        options.transaction,
                }
            );


        return user
            ? user.get({
                plain: true,
            })
            : null;
    }


    /**
     * Atualiza metadado do último login.
     */
    async function touchLastLogin(
        userId,
        date,
        options = {}
    ) {

        const {
            User,
        } = models();


        await User.update(
            {
                last_login_at:
                    date,
            },
            {
                where: {
                    user_id:
                        userId,
                },

                transaction:
                    options.transaction,

                /*
                 * Login não representa
                 * alteração cadastral.
                 */
                silent:
                    true,
            }
        );
    }


    return {

        findByEmail,

        findById,

        touchLastLogin,
    };
}


module.exports = {

    createUserRepository,
};
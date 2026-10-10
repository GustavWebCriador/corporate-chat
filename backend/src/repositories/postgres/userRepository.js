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
    /**
 * Lista todos os usuários.
 */
async function findAll(
    options = {}
) {

    const {
        User,
    } = models();


    const users =
        await User.findAll({

            order: [
                [
                    "name",
                    "ASC",
                ],
                [
                    "user_id",
                    "ASC",
                ],
            ],

            transaction:
                options.transaction,
        });


    return users.map(
        user =>
            user.get({
                plain: true,
            })
    );
}


/**
 * Cria usuário.
 */
async function create(
    data,
    options = {}
) {

    const {
        User,
    } = models();


    const user =
        await User.create(
            data,
            {
                transaction:
                    options.transaction,
            }
        );


    return user.get({
        plain: true,
    });
}


/**
 * Atualiza status do usuário.
 */
async function updateStatus(
    userId,
    status,
    options = {}
) {

    const {
        User,
    } = models();


    const [
        affectedRows,
    ] =
        await User.update(

            {
                status,
            },

            {
                where: {
                    user_id:
                        userId,
                },

                transaction:
                    options.transaction,
            }
        );


    return affectedRows;
}
/**
 * Atualiza o hash de senha.
 */
async function updatePasswordHash(
    userId,
    passwordHash,
    options = {}
) {

    const {
        User,
    } = models();


    const [
        affectedRows,
    ] =
        await User.update(

            {
                password_hash:
                    passwordHash,
            },

            {
                where: {
                    user_id:
                        userId,
                },

                transaction:
                    options.transaction,
            }
        );


    return affectedRows;
}


    return {

        findByEmail,

        findById,

        findAll,

        create,

        updateStatus,

        updatePasswordHash,

        touchLastLogin,
    };
}


module.exports = {

    createUserRepository,
};
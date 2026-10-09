/**
 * Repository PostgreSQL das solicitações de cadastro.
 *
 * Esta camada só acessa e persiste dados; as regras de negócio ficam no
 * registrationRequestService.
 */
function createRegistrationRequestRepository() {
    // Models carregados sob demanda (testes usam repositories em memória).
    function models() {
        return require("../../models/postgres");
    }

    function plain(row) {
        return row ? row.get({ plain: true }) : null;
    }

    /**
     * Executa `work(transaction)` em uma transação gerenciada:
     * confirma se terminar bem e desfaz tudo se lançar erro.
     */
    async function runInTransaction(work) {
        const { sequelize } = models();

        return sequelize.transaction(work);
    }

    async function findPendingByEmail(email, options = {}) {
        const { RegistrationRequest, sequelize } = models();
        const { Op } = require("sequelize");

        const row = await RegistrationRequest.findOne({
            where: {
                [Op.and]: [
                    { status: "PENDING" },
                    sequelize.where(
                        sequelize.fn("lower", sequelize.col("email")),
                        email
                    ),
                ],
            },
            transaction: options.transaction,
        });

        return plain(row);
    }

    async function create(data, options = {}) {
        const { RegistrationRequest } = models();

        const row = await RegistrationRequest.create(data, {
            transaction: options.transaction,
        });

        return plain(row);
    }

    /** Busca a solicitação travando a linha (SELECT ... FOR UPDATE). */
    async function findByIdForUpdate(requestId, options = {}) {
        const { RegistrationRequest } = models();
        const { transaction } = options;

        const row = await RegistrationRequest.findByPk(requestId, {
            transaction,
            lock: transaction ? transaction.LOCK.UPDATE : undefined,
        });

        return plain(row);
    }

    /** Lista por ordem de chegada (mais antiga primeiro), com paginação. */
    async function list({ status, limit, offset }) {
        const { RegistrationRequest } = models();

        const { rows, count } = await RegistrationRequest.findAndCountAll({
            where: status ? { status } : {},
            order: [
                ["requested_at", "ASC"],
                ["request_id", "ASC"],
            ],
            limit,
            offset,
        });

        return { rows: rows.map(plain), count };
    }

    /**
     * Marca como APPROVED somente se ainda estiver PENDING.
     * Retorna a linha atualizada ou null se nada foi alterado.
     */
    async function markApproved(
        requestId,
        { reviewedBy, reviewedAt, createdUserId },
        options = {}
    ) {
        const { RegistrationRequest } = models();

        const [affected] = await RegistrationRequest.update(
            {
                status: "APPROVED",
                reviewed_by: reviewedBy,
                reviewed_at: reviewedAt,
                created_user_id: createdUserId,
                rejection_reason: null,
            },
            {
                where: { request_id: requestId, status: "PENDING" },
                transaction: options.transaction,
            }
        );

        if (affected === 0) {
            return null;
        }

        return plain(
            await RegistrationRequest.findByPk(requestId, {
                transaction: options.transaction,
            })
        );
    }

    /**
     * Marca como REJECTED somente se ainda estiver PENDING.
     * Retorna a linha atualizada ou null se nada foi alterado.
     */
    async function markRejected(
        requestId,
        { reviewedBy, reviewedAt, reason },
        options = {}
    ) {
        const { RegistrationRequest } = models();

        const [affected] = await RegistrationRequest.update(
            {
                status: "REJECTED",
                reviewed_by: reviewedBy,
                reviewed_at: reviewedAt,
                rejection_reason: reason,
            },
            {
                where: { request_id: requestId, status: "PENDING" },
                transaction: options.transaction,
            }
        );

        if (affected === 0) {
            return null;
        }

        return plain(
            await RegistrationRequest.findByPk(requestId, {
                transaction: options.transaction,
            })
        );
    }

    return {
        runInTransaction,
        findPendingByEmail,
        create,
        findByIdForUpdate,
        list,
        markApproved,
        markRejected,
    };
}

module.exports = {
    createRegistrationRequestRepository,
};

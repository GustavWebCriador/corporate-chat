require("dotenv").config();

const {
    test,
    before,
    after,
    afterEach,
} = require("node:test");

const assert =
    require("node:assert/strict");

const {
    randomUUID,
} = require("node:crypto");

const bcrypt =
    require("bcryptjs");

const {
    Op,
} = require("sequelize");

const {
    sequelize,
    User,
    RegistrationRequest,
} = require(
    "../../../src/models/postgres"
);

const {
    createRegistrationRequestRepository,
} = require(
    "../../../src/repositories/postgres/registrationRequestRepository"
);

const {
    createRegistrationRequestService,
} = require(
    "../../../src/services/registrationRequests/registrationRequestService"
);


const TEST_EMAIL_PREFIX =
    "be05-int-";

let adminUserId;


/*
 * Gera e-mails únicos para que os testes
 * não dependam de dados previamente existentes.
 */
function createTestEmail(
    label
) {

    return (
        `${TEST_EMAIL_PREFIX}` +
        `${label}-` +
        `${randomUUID()}@test.local`
    );
}


/*
 * Remove somente os dados criados por esta suíte.
 *
 * RegistrationRequest deve ser apagada antes
 * de User por causa das FKs.
 */
async function cleanupTestData() {

    await RegistrationRequest.destroy({

        where: {

            email: {
                [Op.like]:
                    `${TEST_EMAIL_PREFIX}%@test.local`,
            },
        },
    });


    await User.destroy({

        where: {

            email: {
                [Op.like]:
                    `${TEST_EMAIL_PREFIX}%@test.local`,
            },
        },
    });
}


before(
    async () => {

        if (
            process.env.NODE_ENV !==
            "development"
        ) {

            throw new Error(
                "Este teste deve executar somente no ambiente development."
            );
        }


        await sequelize.authenticate();


        adminUserId =
            randomUUID();


        await User.create({

            user_id:
                adminUserId,

            name:
                "BE05 Integration Admin",

            email:
                `be05-reviewer-${adminUserId}@test.local`,

            password_hash:
                "BE05_TEST_ADMIN_HASH",

            status:
                "ACTIVE",

            is_admin:
                true,
        });
    }
);


afterEach(
    async () => {

        await cleanupTestData();
    }
);


after(
    async () => {

        try {

            await cleanupTestData();


            await User.destroy({

                where: {
                    user_id:
                        adminUserId,
                },
            });

        } finally {

            await sequelize.close();
        }
    }
);


/*
 * =====================================================
 * APPROVAL
 * =====================================================
 */

test(
    "BE-05 INTEGRATION: aprovação cria usuário e atualiza a solicitação atomicamente",

    async () => {

        const service =
            createRegistrationRequestService();


        const email =
            createTestEmail(
                "approve"
            );


        const request =
            await service.createRequest({

                name:
                    "Usuário Aprovação",

                email,
            });


        const result =
            await service.approveRequest({

                requestId:
                    request.request_id,

                reviewerId:
                    adminUserId,

                input: {
                    password:
                        "SenhaTeste1",
                },
            });


        assert.equal(
            result.request.status,
            "APPROVED"
        );


        assert.equal(
            result.request.reviewed_by,
            adminUserId
        );


        assert.ok(
            result.request.reviewed_at
        );


        assert.ok(
            result.request.created_user_id
        );


        assert.equal(
            result.user.status,
            "ACTIVE"
        );


        assert.equal(
            result.user.is_admin,
            false
        );


        const persistedRequest =
            await RegistrationRequest.findByPk(
                request.request_id
            );


        assert.ok(
            persistedRequest
        );


        assert.equal(
            persistedRequest.status,
            "APPROVED"
        );


        assert.equal(
            persistedRequest.reviewed_by,
            adminUserId
        );


        assert.ok(
            persistedRequest.reviewed_at
        );


        assert.ok(
            persistedRequest.created_user_id
        );


        const persistedUser =
            await User.findOne({

                where: {
                    email,
                },
            });


        assert.ok(
            persistedUser
        );


        assert.equal(
            persistedUser.user_id,
            persistedRequest.created_user_id
        );


        assert.equal(
            persistedUser.status,
            "ACTIVE"
        );


        assert.equal(
            persistedUser.is_admin,
            false
        );


        assert.notEqual(
            persistedUser.password_hash,
            "SenhaTeste1"
        );


        assert.equal(
            await bcrypt.compare(
                "SenhaTeste1",
                persistedUser.password_hash
            ),
            true
        );
    }
);


/*
 * =====================================================
 * REJECTION
 * =====================================================
 */

test(
    "BE-05 INTEGRATION: rejeição persiste análise e não cria usuário",

    async () => {

        const service =
            createRegistrationRequestService();


        const email =
            createTestEmail(
                "reject"
            );


        const request =
            await service.createRequest({

                name:
                    "Usuário Rejeição",

                email,
            });


        await service.rejectRequest({

            requestId:
                request.request_id,

            reviewerId:
                adminUserId,

            input: {
                reason:
                    "Dados insuficientes.",
            },
        });


        const persistedRequest =
            await RegistrationRequest.findByPk(
                request.request_id
            );


        assert.equal(
            persistedRequest.status,
            "REJECTED"
        );


        assert.equal(
            persistedRequest.reviewed_by,
            adminUserId
        );


        assert.ok(
            persistedRequest.reviewed_at
        );


        assert.equal(
            persistedRequest.rejection_reason,
            "Dados insuficientes."
        );


        assert.equal(
            persistedRequest.created_user_id,
            null
        );


        const user =
            await User.findOne({

                where: {
                    email,
                },
            });


        assert.equal(
            user,
            null
        );
    }
);


/*
 * =====================================================
 * ROLLBACK
 * =====================================================
 */

test(
    "BE-05 INTEGRATION: falha após criar usuário executa rollback completo",

    async () => {

        const baseRepository =
            createRegistrationRequestRepository();


        /*
         * Usamos o repository PostgreSQL real,
         * mas forçamos uma falha depois da criação
         * do usuário e antes da conclusão da aprovação.
         */
        const failingRepository = {

            ...baseRepository,

            async markApproved() {

                throw new Error(
                    "FORCED_APPROVAL_FAILURE"
                );
            },
        };


        const service =
            createRegistrationRequestService({

                registrationRequestRepository:
                    failingRepository,
            });


        const email =
            createTestEmail(
                "rollback"
            );


        const request =
            await service.createRequest({

                name:
                    "Usuário Rollback",

                email,
            });


        await assert.rejects(

            () =>
                service.approveRequest({

                    requestId:
                        request.request_id,

                    reviewerId:
                        adminUserId,

                    input: {
                        password:
                            "SenhaTeste1",
                    },
                }),

            /FORCED_APPROVAL_FAILURE/
        );


        /*
         * A solicitação precisa continuar PENDING.
         */
        const persistedRequest =
            await RegistrationRequest.findByPk(
                request.request_id
            );


        assert.ok(
            persistedRequest
        );


        assert.equal(
            persistedRequest.status,
            "PENDING"
        );


        assert.equal(
            persistedRequest.reviewed_at,
            null
        );


        assert.equal(
            persistedRequest.reviewed_by,
            null
        );


        assert.equal(
            persistedRequest.created_user_id,
            null
        );


        /*
         * O User chegou a ser criado dentro da
         * transaction, mas deve ter desaparecido
         * com o ROLLBACK.
         */
        const user =
            await User.findOne({

                where: {
                    email,
                },
            });


        assert.equal(
            user,
            null
        );
    }
);


/*
 * =====================================================
 * CONCURRENT APPROVAL
 * =====================================================
 */

test(
    "BE-05 INTEGRATION: duas aprovações concorrentes criam somente um usuário",

    async () => {

        const service =
            createRegistrationRequestService();


        const email =
            createTestEmail(
                "concurrent-approve"
            );


        const request =
            await service.createRequest({

                name:
                    "Usuário Concorrência",

                email,
            });


        const results =
            await Promise.allSettled([

                service.approveRequest({

                    requestId:
                        request.request_id,

                    reviewerId:
                        adminUserId,

                    input: {
                        password:
                            "SenhaTeste1",
                    },
                }),

                service.approveRequest({

                    requestId:
                        request.request_id,

                    reviewerId:
                        adminUserId,

                    input: {
                        password:
                            "SenhaTeste1",
                    },
                }),
            ]);


        const fulfilled =
            results.filter(
                result =>
                    result.status ===
                    "fulfilled"
            );


        const rejected =
            results.filter(
                result =>
                    result.status ===
                    "rejected"
            );


        assert.equal(
            fulfilled.length,
            1
        );


        assert.equal(
            rejected.length,
            1
        );


        assert.equal(
            rejected[0].reason.code,
            "REGISTRATION_REQUEST_ALREADY_REVIEWED"
        );


        const usersCount =
            await User.count({

                where: {
                    email,
                },
            });


        assert.equal(
            usersCount,
            1
        );


        const persistedRequest =
            await RegistrationRequest.findByPk(
                request.request_id
            );


        assert.equal(
            persistedRequest.status,
            "APPROVED"
        );


        assert.ok(
            persistedRequest.created_user_id
        );
    }
);


/*
 * =====================================================
 * CONCURRENT PUBLIC REQUEST
 * =====================================================
 */

test(
    "BE-05 INTEGRATION: duas solicitações simultâneas mantêm somente uma PENDING",

    async () => {

        const service =
            createRegistrationRequestService();


        const email =
            createTestEmail(
                "concurrent-request"
            );


        const payload = {

            name:
                "Usuário Duplicado",

            email,
        };


        const results =
            await Promise.allSettled([

                service.createRequest(
                    payload
                ),

                service.createRequest(
                    payload
                ),
            ]);


        const fulfilled =
            results.filter(
                result =>
                    result.status ===
                    "fulfilled"
            );


        const rejected =
            results.filter(
                result =>
                    result.status ===
                    "rejected"
            );


        assert.equal(
            fulfilled.length,
            1
        );


        assert.equal(
            rejected.length,
            1
        );


        assert.equal(
            rejected[0].reason.code,
            "REGISTRATION_REQUEST_ALREADY_PENDING"
        );


        const pendingCount =
            await RegistrationRequest.count({

                where: {
                    email,
                    status:
                        "PENDING",
                },
            });


        assert.equal(
            pendingCount,
            1
        );
    }
);
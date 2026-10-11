 
require("dotenv").config();

const {
    test,
    before,
    after,
} = require("node:test");

const assert = require("node:assert/strict");

const {
    randomUUID,
} = require("node:crypto");

const {
    sequelize,
    User,
    AuthSession,
} = require("../../../src/models/postgres");

const {
    createAuthSessionRepository,
} = require("../../../src/repositories/postgres/authSessionRepository");

const TEST_USER_ID =
    "22222222-2222-4222-8222-222222222222";

const sessionRepository =
    createAuthSessionRepository();

const createdSessionIds = new Set();

before(async () => {
    if (process.env.NODE_ENV !== "development") {
        throw new Error(
            "Este teste deve executar somente no ambiente development."
        );
    }

    await sequelize.authenticate();

    const user = await User.findByPk(TEST_USER_ID);

    if (!user) {
        throw new Error(
            "Usuário de desenvolvimento não encontrado. Verifique o seed DEV."
        );
    }
});

after(async () => {
    try {
        if (createdSessionIds.size > 0) {
            await AuthSession.destroy({
                where: {
                    session_id: [...createdSessionIds],
                },
            });
        }
    } finally {
        await sequelize.close();
    }
});

async function createTestSession(userId = TEST_USER_ID) {
    const sessionId = randomUUID();

    const expiresAt = new Date(
        Date.now() + 60 * 60 * 1000
    );

    // Registra o ID antes da criação, garantindo
    // que o cleanup possa removê-lo se necessário.
    createdSessionIds.add(sessionId);

    const session = await sessionRepository.createSession({
        sessionId,
        userId,
        expiresAt,
    });

    return {
        sessionId,
        expiresAt,
        session,
    };
}

test(
    "BE-12 INTEGRATION: criar sessão no PostgreSQL",
    async () => {
        const { sessionId, session } =
            await createTestSession();

        assert.equal(session.session_id, sessionId);
        assert.equal(session.user_id, TEST_USER_ID);
        assert.equal(session.revoked_at, null);

        const persisted =
            await AuthSession.findByPk(sessionId);

        assert.ok(persisted);
        assert.equal(persisted.user_id, TEST_USER_ID);
    }
);

test(
    "BE-12 INTEGRATION: consultar sessão pelo repository",
    async () => {
        const { sessionId } =
            await createTestSession();

        const found =
            await sessionRepository.findSessionById(
                sessionId
            );

        assert.ok(found);
        assert.equal(found.session_id, sessionId);
        assert.equal(found.user_id, TEST_USER_ID);
    }
);

test(
    "BE-12 INTEGRATION: revogar sessão atual",
    async () => {
        const { sessionId } =
            await createTestSession();

        const revoked =
            await sessionRepository.revokeSession({
                sessionId,
                userId: TEST_USER_ID,
            });

        assert.equal(revoked, true);

        const persisted =
            await AuthSession.findByPk(sessionId);

        assert.ok(persisted.revoked_at instanceof Date);
    }
);

test(
    "BE-12 INTEGRATION: não revogar sessão duas vezes",
    async () => {
        const { sessionId } =
            await createTestSession();

        const first =
            await sessionRepository.revokeSession({
                sessionId,
                userId: TEST_USER_ID,
            });

        const second =
            await sessionRepository.revokeSession({
                sessionId,
                userId: TEST_USER_ID,
            });

        assert.equal(first, true);
        assert.equal(second, false);
    }
);

test(
    "BE-12 INTEGRATION: revogação de uma sessão não afeta outra",
    async () => {
        const sessionA = await createTestSession();
        const sessionB = await createTestSession();

        await sessionRepository.revokeSession({
            sessionId: sessionA.sessionId,
            userId: TEST_USER_ID,
        });

        const persistedA =
            await sessionRepository.findSessionById(
                sessionA.sessionId
            );

        const persistedB =
            await sessionRepository.findSessionById(
                sessionB.sessionId
            );

        assert.ok(persistedA.revoked_at instanceof Date);
        assert.equal(persistedB.revoked_at, null);
    }
);

test(
    "BE-12 INTEGRATION: não revogar sessão pertencente a outro usuário",
    async () => {
        const { sessionId } =
            await createTestSession();

        const revoked =
            await sessionRepository.revokeSession({
                sessionId,
                userId: randomUUID(),
            });

        assert.equal(revoked, false);

        const persisted =
            await sessionRepository.findSessionById(
                sessionId
            );

        assert.equal(persisted.revoked_at, null);
    }
);

test(
    "BE-12 INTEGRATION: rejeitar sessão para usuário inexistente",
    async () => {
        const sessionId = randomUUID();

        createdSessionIds.add(sessionId);

        await assert.rejects(
            () => sessionRepository.createSession({
                sessionId,
                userId: randomUUID(),
                expiresAt: new Date(
                    Date.now() + 60 * 60 * 1000
                ),
            }),
            (error) => {
                assert.equal(
                    error.name,
                    "SequelizeForeignKeyConstraintError"
                );

                return true;
            }
        );
    }
);

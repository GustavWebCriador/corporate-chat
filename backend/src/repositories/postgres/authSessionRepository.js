
const {
    AuthSession,
} = require("../../models/postgres");

function createAuthSessionRepository({
    AuthSessionModel = AuthSession,
} = {}) {

    async function createSession({
        sessionId,
        userId,
        expiresAt,
    }) {
        return AuthSessionModel.create({
            session_id: sessionId,
            user_id: userId,
            expires_at: expiresAt,
            revoked_at: null,
        });
    }

    async function findSessionById(sessionId) {
        return AuthSessionModel.findByPk(
            sessionId
        );
    }

    async function revokeSession({
        sessionId,
        userId,
    }) {
        const [affectedRows] =
            await AuthSessionModel.update(
                {
                    revoked_at: new Date(),
                },
                {
                    where: {
                        session_id: sessionId,
                        user_id: userId,
                        revoked_at: null,
                    },
                }
            );

        return affectedRows > 0;
    }

    return {
        createSession,
        findSessionById,
        revokeSession,
    };
}

const authSessionRepository =
    createAuthSessionRepository();

module.exports = {
    createAuthSessionRepository,
    authSessionRepository,
};

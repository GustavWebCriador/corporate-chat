function createMockAuthSessionRepository() {
    const sessions = new Map();

    async function createSession({
        sessionId,
        userId,
        expiresAt,
    }) {
        const session = {
            session_id: sessionId,
            user_id: userId,
            expires_at: expiresAt,
            revoked_at: null,
        };

        sessions.set(sessionId, session);
        return session;
    }

    async function findSessionById(sessionId) {
        return sessions.get(sessionId) ?? null;
    }

    async function revokeSession({
        sessionId,
        userId,
    }) {
        const session = sessions.get(sessionId);

        if (
            !session ||
            session.user_id !== userId ||
            session.revoked_at !== null
        ) {
            return false;
        }

        session.revoked_at = new Date();
        return true;
    }

    return {
        sessions,
        createSession,
        findSessionById,
        revokeSession,
    };
}

module.exports = {
    createMockAuthSessionRepository,
};

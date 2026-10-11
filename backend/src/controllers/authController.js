function createAuthController({ authService }) {
    /**
     * POST /api/v1/auth/login
     * Body: { "email": "...", "password": "..." }
     */
    async function login(req, res) {
        const result = await authService.login(req.body);

        // Resposta com credenciais: nunca deve ser guardada em cache.
        res.set("Cache-Control", "no-store");
        res.status(200).json({ data: result });
    }

    /**
     * GET /api/v1/auth/me  (exige token)
     * Devolve o usuário autenticado (req.user, preenchido pelo middleware).
     */
    async function me(req, res) {
        res.status(200).json({ data: { user: req.user } });
    }

    /**
     * POST /api/v1/auth/logout
     * Encerra somente a sessão autenticada.
     */
    async function logout(req, res) {
        const authorization = req.headers.authorization;

        // O middleware já validou o token Bearer.
        const token = authorization
            .trim()
            .replace(/^Bearer\s+/i, "");

        await authService.logout(token);

        res.set("Cache-Control", "no-store");

        return res.status(204).send();
    }


    return { login, me, logout };
}

module.exports = { createAuthController };

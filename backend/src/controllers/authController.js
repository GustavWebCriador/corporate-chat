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

    return { login, me };
}

module.exports = { createAuthController };

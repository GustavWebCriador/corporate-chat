function createHealthController({ healthService }) {
    /**
     * GET /api/v1/health
     * 200 quando PostgreSQL e MongoDB respondem; 503 quando algum está fora.
     */
    async function getHealth(req, res) {
        const status = await healthService.getStatus();

        res.status(status.status === "ok" ? 200 : 503).json({ data: status });
    }

    return { getHealth };
}

module.exports = { createHealthController };

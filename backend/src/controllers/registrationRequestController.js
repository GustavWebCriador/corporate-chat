function createRegistrationRequestController({ registrationRequestService }) {
    /**
     * POST /api/v1/registration-requests  (pública)
     * Body: { "name": "...", "email": "..." }
     */
    async function create(req, res) {
        const request = await registrationRequestService.createRequest(req.body);

        return res.status(201).json({ data: { request } });
    }

    /**
     * GET /api/v1/admin/registration-requests?status=&limit=&offset=
     */
    async function list(req, res) {
        const result = await registrationRequestService.listRequests(req.query);

        return res.status(200).json({ data: result });
    }

    /**
     * POST /api/v1/admin/registration-requests/:requestId/approve
     * Body: { "password": "senha inicial do usuário" }
     */
    async function approve(req, res) {
        const result = await registrationRequestService.approveRequest({
            requestId: req.params.requestId,
            reviewerId: req.user.user_id,
            input: req.body,
        });

        return res.status(200).json({ data: result });
    }

    /**
     * POST /api/v1/admin/registration-requests/:requestId/reject
     * Body: { "reason": "motivo da rejeição" }
     */
    async function reject(req, res) {
        const result = await registrationRequestService.rejectRequest({
            requestId: req.params.requestId,
            reviewerId: req.user.user_id,
            input: req.body,
        });

        return res.status(200).json({ data: result });
    }

    return { create, list, approve, reject };
}

module.exports = { createRegistrationRequestController };

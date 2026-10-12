function createConversationController({ conversationService }) {
    async function createPrivate(req, res) {
        const otherUserId = req.body.otherUserId;

        if (!otherUserId) {
            return res.status(400).json({
                error: {
                    code: "OTHER_USER_ID_REQUIRED",
                    message: "Informe o ID do outro usuário.",
                },
            });
        }

        const conversation = await conversationService.createPrivateForUser({
            requesterId: req.user.user_id,
            otherUserId,
        });

        return res.status(201).json({
            data: { conversation },
        });
    }

    async function list(req, res) {
        const conversations = await conversationService.listForUser({
            userId: req.user.user_id,
        });

        return res.status(200).json({
            data: { conversations },
        });
    }

    async function history(req, res) {
        const result = await conversationService.getHistory({
            conversationId: req.params.conversationId,
            userId: req.user.user_id,
            limit: req.query.limit,
            before: req.query.before || null,
        });

        return res.status(200).json({
            data: result,
        });
    }

    return {
        createPrivate,
        list,
        history,
    };
}

module.exports = {
    createConversationController,
};
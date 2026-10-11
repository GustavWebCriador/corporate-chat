function createAdminUserController({
    userService,
}) {


    /**
     * POST /api/v1/admin/users
     */
    async function create(
        req,
        res
    ) {

        const user =
            await userService
                .createUser(
                    req.body
                );


        return res
            .status(201)
            .json({

                data: {
                    user,
                },
            });
    }


    /**
     * GET /api/v1/admin/users
     */
    async function list(
        req,
        res
    ) {

        const users =
            await userService
                .listUsers();


        return res
            .status(200)
            .json({

                data: {
                    users,
                },
            });
    }


    /**
     * GET /api/v1/admin/users/:userId
     */
    async function getById(
        req,
        res
    ) {

        const user =
            await userService
                .getUserById(
                    req.params.userId
                );


        return res
            .status(200)
            .json({

                data: {
                    user,
                },
            });
    }


    /**
     * PATCH /api/v1/admin/users/:userId/status
     */
    async function changeStatus(
        req,
        res
    ) {

        const user =
            await userService
                .changeUserStatus(

                    req.params.userId,

                    req.body
                );


        return res
            .status(200)
            .json({

                data: {
                    user,
                },
            });
    }


    /**
     * PATCH /api/v1/admin/users/:userId/password
     */
    async function resetPassword(
        req,
        res
    ) {

        await userService
            .resetUserPassword(

                req.params.userId,

                req.body
            );


        return res
            .status(204)
            .send();
    }


    return {

        create,

        list,

        getById,

        changeStatus,

        resetPassword,
    };
}


module.exports = {

    createAdminUserController,
};


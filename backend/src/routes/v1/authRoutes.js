const express =
    require(
        "express"
    );

const {
    createAuthController,
} = require(
    "../../controllers/authController"
);

const {
    createAuthenticate,
} = require(
    "../../middlewares/authenticate"
);

const {
    createLoginRateLimiter,
} = require(
    "../../middlewares/rateLimiters"
);

const {
    noStore,
} = require(
    "../../middlewares/cacheControl"
);


function createAuthRoutes({
    authService,
}) {
    const router =
        express.Router();


    const controller =
        createAuthController({
            authService,
        });


    const authenticate =
        createAuthenticate({
            authService,
        });


    const loginRateLimiter =
        createLoginRateLimiter();


    router.post(
        "/login",
        noStore,
        loginRateLimiter,
        controller.login
    );


    router.get(
        "/me",
        noStore,
        authenticate,
        controller.me
    );


    router.post(
        "/logout",
        noStore,
        authenticate,
        controller.logout
    );


    return router;
}


module.exports = {
    createAuthRoutes,
};
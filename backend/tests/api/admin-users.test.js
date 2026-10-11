process.env.NODE_ENV = "test";

process.env.JWT_SECRET =
    "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";

const test =
    require(
        "node:test"
    );

const assert =
    require(
        "node:assert/strict"
    );


const {
    randomUUID,
} = require(
    "node:crypto"
);


const {
    createApp,
} = require(
    "../../src/app"
);


const {
    createAuthService,
} = require(
    "../../src/services/auth/authService"
);


const {
    createUserService,
} = require(
    "../../src/services/users/userService"
);


const {
    createHealthService,
} = require(
    "../../src/services/health/healthService"
);

const {
    createMockAuthSessionRepository,
} = require("../helpers/mockAuthSessionRepository");



const passwordHasher = {

    async hash(
        password
    ) {

        return `HASH:${password}`;
    },


    async compare(
        password,
        hash
    ) {

        return (
            hash ===
            `HASH:${password}`
        );
    },
};
function createMemoryUserRepository() {

    const rows =
        new Map();


    const adminId =
        "11111111-1111-4111-8111-111111111111";


    const normalUserId =
        "22222222-2222-4222-8222-222222222222";


    rows.set(
        adminId,
        {
            user_id:
                adminId,

            name:
                "Administrador",

            email:
                "admin@corp.local",

            password_hash:
                "HASH:Senha123",

            status:
                "ACTIVE",

            is_admin:
                true,

            created_at:
                new Date(),

            updated_at:
                new Date(),

            last_login_at:
                null,
        }
    );


    rows.set(
        normalUserId,
        {
            user_id:
                normalUserId,

            name:
                "Usuário Comum",

            email:
                "user@corp.local",

            password_hash:
                "HASH:Senha123",

            status:
                "ACTIVE",

            is_admin:
                false,

            created_at:
                new Date(),

            updated_at:
                new Date(),

            last_login_at:
                null,
        }
    );


    async function findByEmail(
        email
    ) {

        for (
            const user of
            rows.values()
        ) {

            if (
                user.email
                    .toLowerCase() ===
                email.toLowerCase()
            ) {

                return {
                    ...user,
                };
            }
        }


        return null;
    }


    async function findById(
        userId
    ) {

        const user =
            rows.get(
                userId
            );


        return user
            ? {
                ...user,
            }
            : null;
    }


    async function findAll() {

        return Array
            .from(
                rows.values()
            )
            .map(
                user => ({
                    ...user,
                })
            );
    }


    async function create(
        data
    ) {

        const userId =
            randomUUID();


        const now =
            new Date();


        const user = {

            user_id:
                userId,

            ...data,

            created_at:
                now,

            updated_at:
                now,

            last_login_at:
                null,
        };


        rows.set(
            userId,
            user
        );


        return {
            ...user,
        };
    }


    async function updateStatus(
        userId,
        status
    ) {

        const user =
            rows.get(
                userId
            );


        if (
            !user
        ) {

            return 0;
        }


        user.status =
            status;

        user.updated_at =
            new Date();


        return 1;
    }


    async function updatePasswordHash(
        userId,
        passwordHash
    ) {

        const user =
            rows.get(
                userId
            );


        if (
            !user
        ) {

            return 0;
        }


        user.password_hash =
            passwordHash;

        user.updated_at =
            new Date();


        return 1;
    }


    async function touchLastLogin(
        userId,
        date
    ) {

        const user =
            rows.get(
                userId
            );


        if (
            user
        ) {

            user.last_login_at =
                date;
        }
    }


    return {

        rows,

        adminId,

        normalUserId,

        findByEmail,

        findById,

        findAll,

        create,

        updateStatus,

        updatePasswordHash,

        touchLastLogin,
    };
}
function listen(
    app
) {

    return new Promise(
        resolve => {

            const server =
                app.listen(
                    0,
                    "127.0.0.1",
                    () => {

                        resolve({

                            server,

                            baseUrl:
                                `http://127.0.0.1:${server.address().port}`,
                        });
                    }
                );
        }
    );
}


function close(
    server
) {

    return new Promise(
        resolve =>
            server.close(
                resolve
            )
    );
}


async function createTestContext() {

    const repository =
    createMemoryUserRepository();

    const sessionRepository =
    createMockAuthSessionRepository();

    const authService =
    createAuthService({
        userRepository: repository,
        sessionRepository,
        passwordHasher,
    });


    const userService =
        createUserService({

            userRepository:
                repository,

            passwordHasher,
        });


    const healthService =
        createHealthService({

            checks: {

                postgres:
                    async () => { },

                mongodb:
                    async () => { },
            },
        });


    const app =
        createApp({

            authService,

            userService,

            healthService,
        });


    const {
        server,
        baseUrl,
    } =
        await listen(
            app
        );
    return {

        repository,

        server,

        baseUrl,
    };
}
async function login(
    baseUrl,
    email
) {

    const response =
        await fetch(
            `${baseUrl}/api/v1/auth/login`,
            {
                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json",
                },

                body:
                    JSON.stringify({
                        email,
                        password:
                            "Senha123",
                    }),
            }
        );


    const body =
        await response.json();


    return body.data.token;
}


function request(
    baseUrl,
    path,
    {
        method = "GET",
        token,
        body,
    } = {}
) {

    const headers =
        {};


    if (
        token
    ) {

        headers.Authorization =
            `Bearer ${token}`;
    }


    if (
        body !== undefined
    ) {

        headers[
            "Content-Type"
        ] =
            "application/json";
    }


    return fetch(
        `${baseUrl}${path}`,
        {
            method,

            headers,

            body:
                body !== undefined
                    ? JSON.stringify(
                        body
                    )
                    : undefined,
        }
    );
}

test(
    "ADMIN USERS: rota sem autenticação retorna 401",

    async () => {

        const context =
            await createTestContext();


        try {

            const response =
                await request(

                    context.baseUrl,

                    "/api/v1/admin/users"
                );


            assert.equal(
                response.status,
                401
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);

test(
    "ADMIN USERS: usuário comum recebe 403",

    async () => {

        const context =
            await createTestContext();


        try {

            const token =
                await login(

                    context.baseUrl,

                    "user@corp.local"
                );


            const response =
                await request(

                    context.baseUrl,

                    "/api/v1/admin/users",

                    {
                        token,
                    }
                );


            const body =
                await response.json();


            assert.equal(
                response.status,
                403
            );


            assert.equal(
                body.error.code,
                "ADMIN_REQUIRED"
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);
test(
    "ADMIN USERS: administrador cadastra usuário",

    async () => {

        const context =
            await createTestContext();


        try {

            const token =
                await login(

                    context.baseUrl,

                    "admin@corp.local"
                );


            const response =
                await request(

                    context.baseUrl,

                    "/api/v1/admin/users",

                    {
                        method:
                            "POST",

                        token,

                        body: {

                            name:
                                "Maria Silva",

                            email:
                                "maria@corp.local",

                            password:
                                "Senha123",
                        },
                    }
                );


            const body =
                await response.json();


            assert.equal(
                response.status,
                201
            );


            assert.equal(
                body.data.user.email,
                "maria@corp.local"
            );


            assert.equal(
                body.data.user.status,
                "ACTIVE"
            );


            assert.equal(
                body.data.user.is_admin,
                false
            );


            assert.equal(
                "password_hash" in
                body.data.user,
                false
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);

test(
    "ADMIN USERS: e-mail é normalizado antes da persistência",

    async () => {

        const context =
            await createTestContext();


        try {

            const token =
                await login(
                    context.baseUrl,
                    "admin@corp.local"
                );


            const response =
                await request(

                    context.baseUrl,

                    "/api/v1/admin/users",

                    {
                        method:
                            "POST",

                        token,

                        body: {

                            name:
                                "Maria",

                            email:
                                "  MARIA@Corp.Local  ",

                            password:
                                "Senha123",
                        },
                    }
                );


            const body =
                await response.json();


            assert.equal(
                body.data.user.email,
                "maria@corp.local"
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);

test(
    "ADMIN USERS: senha fraca retorna 400",

    async () => {

        const context =
            await createTestContext();


        try {

            const token =
                await login(
                    context.baseUrl,
                    "admin@corp.local"
                );


            const response =
                await request(

                    context.baseUrl,

                    "/api/v1/admin/users",

                    {
                        method:
                            "POST",

                        token,

                        body: {

                            name:
                                "Maria",

                            email:
                                "maria@corp.local",

                            password:
                                "senha",
                        },
                    }
                );


            const body =
                await response.json();


            assert.equal(
                response.status,
                400
            );


            assert.equal(
                body.error.code,
                "VALIDATION_ERROR"
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);

test(
    "ADMIN USERS: administrador lista usuários sem expor senha",

    async () => {

        const context =
            await createTestContext();


        try {

            const token =
                await login(
                    context.baseUrl,
                    "admin@corp.local"
                );


            const response =
                await request(

                    context.baseUrl,

                    "/api/v1/admin/users",

                    {
                        token,
                    }
                );


            const text =
                await response.text();


            const body =
                JSON.parse(
                    text
                );


            assert.equal(
                response.status,
                200
            );


            assert.ok(
                Array.isArray(
                    body.data.users
                )
            );


            assert.ok(
                !text.includes(
                    "password_hash"
                )
            );


            assert.ok(
                !text.includes(
                    "HASH:"
                )
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);

test(
    "ADMIN USERS: administrador desativa usuário e novo acesso é bloqueado",

    async () => {

        const context =
            await createTestContext();


        try {

            const adminToken =
                await login(
                    context.baseUrl,
                    "admin@corp.local"
                );


            const response =
                await request(

                    context.baseUrl,

                    `/api/v1/admin/users/${context.repository.normalUserId}/status`,

                    {
                        method:
                            "PATCH",

                        token:
                            adminToken,

                        body: {
                            status:
                                "INACTIVE",
                        },
                    }
                );


            assert.equal(
                response.status,
                200
            );


            const loginResponse =
                await request(

                    context.baseUrl,

                    "/api/v1/auth/login",

                    {
                        method:
                            "POST",

                        body: {

                            email:
                                "user@corp.local",

                            password:
                                "Senha123",
                        },
                    }
                );


            assert.equal(
                loginResponse.status,
                403
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);
test(
    "ADMIN USERS: redefinição de senha invalida a senha anterior",

    async () => {

        const context =
            await createTestContext();


        try {

            const adminToken =
                await login(
                    context.baseUrl,
                    "admin@corp.local"
                );


            const response =
                await request(

                    context.baseUrl,

                    `/api/v1/admin/users/${context.repository.normalUserId}/password`,

                    {
                        method:
                            "PATCH",

                        token:
                            adminToken,

                        body: {
                            password:
                                "NovaSenha456",
                        },
                    }
                );


            assert.equal(
                response.status,
                204
            );


            const oldPassword =
                await request(

                    context.baseUrl,

                    "/api/v1/auth/login",

                    {
                        method:
                            "POST",

                        body: {

                            email:
                                "user@corp.local",

                            password:
                                "Senha123",
                        },
                    }
                );


            assert.equal(
                oldPassword.status,
                401
            );


            const newPassword =
                await request(

                    context.baseUrl,

                    "/api/v1/auth/login",

                    {
                        method:
                            "POST",

                        body: {

                            email:
                                "user@corp.local",

                            password:
                                "NovaSenha456",
                        },
                    }
                );


            assert.equal(
                newPassword.status,
                200
            );

        } finally {

            await close(
                context.server
            );
        }
    }
);



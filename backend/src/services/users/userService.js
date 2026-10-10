const bcrypt =
    require(
        "bcryptjs"
    );


const AppError =
    require(
        "../../errors/AppError"
    );


const {
    createUserRepository,
} = require(
    "../../repositories/postgres/userRepository"
);


const {
    validatePassword,
} = require(
    "../../validators/passwordPolicy"
);


const EMAIL_MAX_LENGTH =
    150;

const NAME_MAX_LENGTH =
    150;

const BCRYPT_ROUNDS =
    12;

const EMAIL_REGEX =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


function toPublicUser(
    user
) {

    return {

        user_id:
            user.user_id,

        name:
            user.name,

        email:
            user.email,

        status:
            user.status,

        is_admin:
            Boolean(
                user.is_admin
            ),

        created_at:
            user.created_at,

        updated_at:
            user.updated_at,

        last_login_at:
            user.last_login_at,
    };
}


function normalizeName(
    value
) {

    if (
        typeof value !==
        "string"
    ) {

        return "";
    }


    return value
        .trim()
        .replace(
            /\s+/g,
            " "
        );
}


function normalizeEmail(
    value
) {

    if (
        typeof value !==
        "string"
    ) {

        return "";
    }


    return value
        .trim()
        .toLowerCase();
}


function validateCreateUserInput(
    input
) {

    const body =
        input &&
        typeof input === "object" &&
        !Array.isArray(input)
            ? input
            : {};


    const details =
        [];


    const name =
        normalizeName(
            body.name
        );


    const email =
        normalizeEmail(
            body.email
        );


    const password =
        body.password;


    if (
        !name
    ) {

        details.push({

            field:
                "name",

            message:
                "Informe o nome.",
        });

    } else if (
        name.length >
        NAME_MAX_LENGTH
    ) {

        details.push({

            field:
                "name",

            message:
                "O nome excede o tamanho máximo permitido.",
        });
    }


    if (
        !email ||
        email.length >
            EMAIL_MAX_LENGTH ||
        !EMAIL_REGEX.test(
            email
        )
    ) {

        details.push({

            field:
                "email",

            message:
                "Informe um e-mail válido.",
        });
    }


    details.push(
        ...validatePassword(
            password
        )
    );


    if (
        body.is_admin !==
            undefined &&
        typeof body.is_admin !==
            "boolean"
    ) {

        details.push({

            field:
                "is_admin",

            message:
                "is_admin deve ser boolean.",
        });
    }


    if (
        details.length >
        0
    ) {

        throw AppError.badRequest(
            "Dados do usuário inválidos.",
            "VALIDATION_ERROR",
            details
        );
    }


    return {

        name,

        email,

        password,

        is_admin:
            body.is_admin === true,
    };
}


function validateUserId(
    userId
) {

    const UUID_REGEX =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


    if (
        typeof userId !==
            "string" ||
        !UUID_REGEX.test(
            userId
        )
    ) {

        throw AppError.badRequest(
            "Identificador de usuário inválido.",
            "INVALID_USER_ID"
        );
    }
}


function createUserService({
    userRepository =
        createUserRepository(),

    passwordHasher =
        bcrypt,
} = {}) {


    async function createUser(
        input
    ) {

        const data =
            validateCreateUserInput(
                input
            );


        const existing =
            await userRepository
                .findByEmail(
                    data.email
                );


        if (
            existing
        ) {

            throw AppError.conflict(
                "Já existe um usuário cadastrado com este e-mail.",
                "EMAIL_ALREADY_EXISTS"
            );
        }


        const passwordHash =
            await passwordHasher.hash(
                data.password,
                BCRYPT_ROUNDS
            );


        try {

            const user =
                await userRepository
                    .create({

                        name:
                            data.name,

                        email:
                            data.email,

                        password_hash:
                            passwordHash,

                        status:
                            "ACTIVE",

                        is_admin:
                            data.is_admin,
                    });


            return toPublicUser(
                user
            );

        } catch (error) {

            /*
             * PostgreSQL unique_violation.
             *
             * Protege também contra corrida:
             * duas requisições podem passar pelo findByEmail
             * antes de qualquer uma criar o usuário.
             */
            if (
                error &&
                (
                    error.name ===
                        "SequelizeUniqueConstraintError" ||
                    error.original?.code ===
                        "23505"
                )
            ) {

                throw AppError.conflict(
                    "Já existe um usuário cadastrado com este e-mail.",
                    "EMAIL_ALREADY_EXISTS"
                );
            }


            throw error;
        }
    }


    async function listUsers() {

        const users =
            await userRepository
                .findAll();


        return users.map(
            toPublicUser
        );
    }


    async function getUserById(
        userId
    ) {

        validateUserId(
            userId
        );


        const user =
            await userRepository
                .findById(
                    userId
                );


        if (
            !user
        ) {

            throw AppError.notFound(
                "Usuário não encontrado.",
                "USER_NOT_FOUND"
            );
        }


        return toPublicUser(
            user
        );
    }


    async function changeUserStatus(
        userId,
        input
    ) {

        validateUserId(
            userId
        );


        const body =
            input &&
            typeof input === "object" &&
            !Array.isArray(input)
                ? input
                : {};


        if (
            ![
                "ACTIVE",
                "INACTIVE",
            ].includes(
                body.status
            )
        ) {

            throw AppError.badRequest(
                "Status de usuário inválido.",
                "INVALID_USER_STATUS",
                [
                    {
                        field:
                            "status",

                        message:
                            "Use ACTIVE ou INACTIVE.",
                    },
                ]
            );
        }


        const existing =
            await userRepository
                .findById(
                    userId
                );


        if (
            !existing
        ) {

            throw AppError.notFound(
                "Usuário não encontrado.",
                "USER_NOT_FOUND"
            );
        }


        await userRepository
            .updateStatus(
                userId,
                body.status
            );


        return getUserById(
            userId
        );
    }


    async function resetUserPassword(
        userId,
        input
    ) {

        validateUserId(
            userId
        );


        const body =
            input &&
            typeof input === "object" &&
            !Array.isArray(input)
                ? input
                : {};


        const details =
            validatePassword(
                body.password
            );


        if (
            details.length >
            0
        ) {

            throw AppError.badRequest(
                "Senha inválida.",
                "VALIDATION_ERROR",
                details
            );
        }


        const existing =
            await userRepository
                .findById(
                    userId
                );


        if (
            !existing
        ) {

            throw AppError.notFound(
                "Usuário não encontrado.",
                "USER_NOT_FOUND"
            );
        }


        const passwordHash =
            await passwordHasher.hash(
                body.password,
                BCRYPT_ROUNDS
            );


        await userRepository
            .updatePasswordHash(
                userId,
                passwordHash
            );
    }


    return {

        createUser,

        listUsers,

        getUserById,

        changeUserStatus,

        resetUserPassword,
    };
}


module.exports = {

    createUserService,

    userService:
        createUserService(),
};
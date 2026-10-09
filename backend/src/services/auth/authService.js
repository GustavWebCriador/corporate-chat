const bcrypt = require("bcryptjs");

const AppError = require("../../errors/AppError");
const { signAccessToken, verifyAccessToken } = require("../../config/jwt");

const EMAIL_MAX_LENGTH = 150; // RI02 (DER v1.3, PER-02)
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Hash válido de uma senha qualquer. Usado quando o e-mail não existe, para que
// o tempo de resposta seja parecido com o de uma senha errada (evita descobrir
// quais e-mails estão cadastrados).
const DUMMY_HASH =
    "$2b$10$sMr3.Lu2Y1gjFMIOZBIpdec7/0.pbe3V.Yt0qwak4sHwMVqxTIRDG";

/**
 * Acesso a dados do PostgreSQL. Os models são carregados sob demanda para que
 * importar este módulo (por exemplo nos testes) não abra conexão com o banco.
 */
function createUserRepository() {
    function models() {
        return require("../../models/postgres/Index");
    }

    return {
        async findByEmail(email) {
            const { User, sequelize } = models();

            const user = await User.findOne({
                where: sequelize.where(
                    sequelize.fn("lower", sequelize.col("email")),
                    email
                ),
            });

            return user ? user.get({ plain: true }) : null;
        },

        async findById(userId) {
            const { User } = models();

            const user = await User.findByPk(userId);

            return user ? user.get({ plain: true }) : null;
        },

        async touchLastLogin(userId, date) {
            const { User } = models();

            // silent: não altera updated_at só porque o usuário fez login.
            await User.update(
                { last_login_at: date },
                { where: { user_id: userId }, silent: true }
            );
        },
    };
}

function toPublicUser(user) {
    return {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        is_admin: Boolean(user.is_admin),
        status: user.status,
    };
}

function validateCredentials(input) {
    const body = input && typeof input === "object" ? input : {};
    const details = [];

    let email = body.email;
    const password = body.password;

    if (typeof email !== "string" || !email.trim()) {
        details.push({ field: "email", message: "Informe o e-mail." });
    } else {
        email = email.trim().toLowerCase();

        if (email.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(email)) {
            details.push({ field: "email", message: "E-mail inválido." });
        }
    }

    if (typeof password !== "string" || password.length === 0) {
        details.push({ field: "password", message: "Informe a senha." });
    } else if (password.length > PASSWORD_MAX_LENGTH) {
        details.push({ field: "password", message: "Senha inválida." });
    }

    if (details.length > 0) {
        throw AppError.badRequest(
            "Dados de login inválidos.",
            "VALIDATION_ERROR",
            details
        );
    }

    return { email, password };
}

function createAuthService({
    userRepository = createUserRepository(),
    passwordHasher = bcrypt,
} = {}) {
    /**
     * Login por e-mail e senha (RF01).
     * - 400 VALIDATION_ERROR: payload inválido
     * - 401 INVALID_CREDENTIALS: e-mail inexistente OU senha errada (mesma resposta)
     * - 403 USER_INACTIVE: senha correta, mas o usuário não está ACTIVE
     */
    async function login(input) {
        const { email, password } = validateCredentials(input);

        const user = await userRepository.findByEmail(email);

        const passwordMatches = await passwordHasher.compare(
            password,
            user ? user.password_hash : DUMMY_HASH
        );

        if (!user || !passwordMatches) {
            throw AppError.unauthorized(
                "E-mail ou senha inválidos.",
                "INVALID_CREDENTIALS"
            );
        }

        if (user.status !== "ACTIVE") {
            throw AppError.forbidden("Usuário inativo.", "USER_INACTIVE");
        }

        // Assina antes de gravar: se o JWT estiver mal configurado, nada é alterado.
        const token = signAccessToken({
            userId: user.user_id,
            isAdmin: user.is_admin,
        });

        const { exp, iat } = verifyAccessToken(token);

        await userRepository.touchLastLogin(user.user_id, new Date());

        return {
            token,
            tokenType: "Bearer",
            expiresIn: exp - iat,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                is_admin: Boolean(user.is_admin),
            },
        };
    }

    /**
     * Valida o token e devolve o usuário ATUAL do banco (RF02).
     * Os dados vêm do banco, e não do token, para que desativar um usuário
     * ou mudar sua permissão tenha efeito imediato.
     * - 401 TOKEN_EXPIRED / TOKEN_INVALID
     * - 403 USER_INACTIVE
     */
    async function authenticateToken(token) {
        let payload;

        try {
            payload = verifyAccessToken(token);
        } catch (error) {
            if (error && error.name === "TokenExpiredError") {
                throw AppError.unauthorized("Token expirado.", "TOKEN_EXPIRED");
            }

            if (
                error &&
                (error.name === "JsonWebTokenError" ||
                    error.name === "NotBeforeError")
            ) {
                throw AppError.unauthorized("Token inválido.", "TOKEN_INVALID");
            }

            // Erro de configuração (ex.: JWT_SECRET ausente): vira 500 no errorHandler.
            throw error;
        }

        if (typeof payload.sub !== "string" || !UUID_REGEX.test(payload.sub)) {
            throw AppError.unauthorized("Token inválido.", "TOKEN_INVALID");
        }

        const user = await userRepository.findById(payload.sub);

        if (!user) {
            throw AppError.unauthorized("Token inválido.", "TOKEN_INVALID");
        }

        if (user.status !== "ACTIVE") {
            throw AppError.forbidden("Usuário inativo.", "USER_INACTIVE");
        }

        return toPublicUser(user);
    }

    return { login, authenticateToken };
}

module.exports = {
    createAuthService,
    createUserRepository,
    authService: createAuthService(),
};

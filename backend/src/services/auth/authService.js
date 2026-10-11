const bcrypt = require("bcryptjs");

const AppError = require("../../errors/AppError");
const { signAccessToken, verifyAccessToken } = require("../../config/jwt");
const { createUserRepository, } = require("../../repositories/postgres/userRepository");
const { randomUUID } = require("node:crypto");
const { createAuthSessionRepository, } = require("../../repositories/postgres/authSessionRepository");

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
    sessionRepository = createAuthSessionRepository(),
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
        const sessionId = randomUUID();

        const token = signAccessToken({
            userId: user.user_id,
            isAdmin: user.is_admin,
            sessionId,
        });

        const { exp, iat } = verifyAccessToken(token);

        await sessionRepository.createSession({
            sessionId,
            userId: user.user_id,
            expiresAt: new Date(exp * 1000),
        });

        await userRepository.touchLastLogin(
            user.user_id,
            new Date()
        );
        return {
            token,
            tokenType: "Bearer",
            expiresIn: exp - iat,
            user: toPublicUser(user),
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
        if (
            typeof payload.jti !== "string" ||
            !UUID_REGEX.test(payload.jti)
        ) {
            throw AppError.unauthorized(
                "Token inválido.",
                "TOKEN_INVALID"
            );
        }

        const session =
            await sessionRepository.findSessionById(
                payload.jti
            );

        if (
            !session ||
            session.user_id !== payload.sub
        ) {
            throw AppError.unauthorized(
                "Sessão inválida.",
                "TOKEN_INVALID"
            );
        }

        if (session.revoked_at !== null) {
            throw AppError.unauthorized(
                "Sessão encerrada.",
                "TOKEN_REVOKED"
            );
        }

        if (new Date(session.expires_at).getTime() <= Date.now()) {
            throw AppError.unauthorized(
                "Token expirado.",
                "TOKEN_EXPIRED"
            );
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
async function logout(token) {
    // Valida assinatura, expiração, usuário e sessão atual.
    await authenticateToken(token);

    // Só extraímos o jti após a validação completa.
    const payload = verifyAccessToken(token);

    const revoked = await sessionRepository.revokeSession({
        sessionId: payload.jti,
        userId: payload.sub,
    });

    if (!revoked) {
        throw AppError.unauthorized(
            "Sessão encerrada ou inválida.",
            "TOKEN_REVOKED"
        );
    }
}


    return {
        login,
        authenticateToken,
        logout,
    };
}

module.exports = {
    createAuthService,
    authService: createAuthService(),
};
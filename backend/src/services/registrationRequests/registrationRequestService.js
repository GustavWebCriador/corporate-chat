const bcrypt = require("bcryptjs");

const AppError = require("../../errors/AppError");

const {
    createUserRepository,
} = require("../../repositories/postgres/userRepository");

const {
    createRegistrationRequestRepository,
} = require("../../repositories/postgres/registrationRequestRepository");

const { validatePassword } = require("../../validators/passwordPolicy");

const NAME_MAX_LENGTH = 150;
const EMAIL_MAX_LENGTH = 150; // RI02 (DER v1.3)
const REASON_MAX_LENGTH = 500;
const BCRYPT_ROUNDS = 12;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const LIST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "ALL"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- apresentação ----------

/** Visão devolvida a quem solicitou: só o necessário, sem dados de revisão. */
function toRequesterView(request) {
    return {
        request_id: request.request_id,
        name: request.name,
        email: request.email,
        status: request.status,
        requested_at: request.requested_at,
    };
}

/** Visão do administrador: inclui os dados da análise. */
function toAdminView(request) {
    return {
        request_id: request.request_id,
        name: request.name,
        email: request.email,
        status: request.status,
        requested_at: request.requested_at,
        reviewed_at: request.reviewed_at ?? null,
        reviewed_by: request.reviewed_by ?? null,
        rejection_reason: request.rejection_reason ?? null,
        created_user_id: request.created_user_id ?? null,
    };
}

function toPublicUser(user) {
    return {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        status: user.status,
        is_admin: Boolean(user.is_admin),
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login_at: user.last_login_at ?? null,
    };
}

// ---------- validação ----------

function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}

function normalizeName(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validationError(message, details) {
    return AppError.badRequest(message, "VALIDATION_ERROR", details);
}

function validateCreateInput(input) {
    const body = asObject(input);
    const details = [];

    const name = normalizeName(body.name);
    const email = normalizeEmail(body.email);

    if (!name) {
        details.push({ field: "name", message: "Informe o nome." });
    } else if (name.length > NAME_MAX_LENGTH) {
        details.push({
            field: "name",
            message: "O nome excede o tamanho máximo permitido.",
        });
    }

    if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(email)) {
        details.push({ field: "email", message: "Informe um e-mail válido." });
    }

    if (details.length > 0) {
        throw validationError("Dados da solicitação inválidos.", details);
    }

    // Só name e email são usados. Qualquer outro campo enviado (status,
    // is_admin, password...) é ignorado.
    return { name, email };
}

function validateRequestId(requestId) {
    if (typeof requestId !== "string" || !UUID_REGEX.test(requestId)) {
        throw AppError.badRequest(
            "Identificador de solicitação inválido.",
            "INVALID_REQUEST_ID"
        );
    }
}

function validateApproveInput(input) {
    const body = asObject(input);
    const details = validatePassword(body.password);

    if (details.length > 0) {
        throw validationError("Dados da aprovação inválidos.", details);
    }

    return { password: body.password };
}

function validateRejectInput(input) {
    const body = asObject(input);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!reason) {
        throw validationError("Dados da rejeição inválidos.", [
            { field: "reason", message: "Informe o motivo da rejeição." },
        ]);
    }

    if (reason.length > REASON_MAX_LENGTH) {
        throw validationError("Dados da rejeição inválidos.", [
            {
                field: "reason",
                message: `O motivo deve ter no máximo ${REASON_MAX_LENGTH} caracteres.`,
            },
        ]);
    }

    return { reason };
}

function parseIntegerParam(value, field, { min, max, fallback }) {
    if (value === undefined) {
        return fallback;
    }

    const valid =
        typeof value === "string" &&
        /^\d+$/.test(value) &&
        Number(value) >= min &&
        Number(value) <= max;

    if (!valid) {
        throw validationError("Parâmetros de listagem inválidos.", [
            {
                field,
                message: `Informe um número inteiro entre ${min} e ${max}.`,
            },
        ]);
    }

    return Number(value);
}

function validateListQuery(query) {
    const params = asObject(query);

    let status = "PENDING";

    if (params.status !== undefined) {
        status = typeof params.status === "string"
            ? params.status.toUpperCase()
            : "";

        if (!LIST_STATUSES.includes(status)) {
            throw validationError("Parâmetros de listagem inválidos.", [
                {
                    field: "status",
                    message: `Use um dos valores: ${LIST_STATUSES.join(", ")}.`,
                },
            ]);
        }
    }

    const limit = parseIntegerParam(params.limit, "limit", {
        min: 1,
        max: MAX_LIMIT,
        fallback: DEFAULT_LIMIT,
    });

    const offset = parseIntegerParam(params.offset, "offset", {
        min: 0,
        max: 1000000,
        fallback: 0,
    });

    return { status, limit, offset };
}

// ---------- erros de negócio ----------

function isUniqueViolation(error) {
    return Boolean(
        error &&
            (error.name === "SequelizeUniqueConstraintError" ||
                (error.original && error.original.code === "23505"))
    );
}

function emailAlreadyExists() {
    return AppError.conflict(
        "Já existe um usuário cadastrado com este e-mail.",
        "EMAIL_ALREADY_EXISTS"
    );
}

function alreadyPending() {
    return AppError.conflict(
        "Já existe uma solicitação pendente para este e-mail.",
        "REGISTRATION_REQUEST_ALREADY_PENDING"
    );
}

function notFound() {
    return AppError.notFound(
        "Solicitação de cadastro não encontrada.",
        "REGISTRATION_REQUEST_NOT_FOUND"
    );
}

function alreadyReviewed() {
    return AppError.conflict(
        "Esta solicitação já foi analisada.",
        "REGISTRATION_REQUEST_ALREADY_REVIEWED"
    );
}

// ---------- serviço ----------

function createRegistrationRequestService({
    registrationRequestRepository = createRegistrationRequestRepository(),
    userRepository = createUserRepository(),
    passwordHasher = bcrypt,
    now = () => new Date(),
} = {}) {
    /**
     * Solicitação pública de cadastro (RF04). Não exige login.
     * - 400 VALIDATION_ERROR
     * - 409 EMAIL_ALREADY_EXISTS: já existe usuário com este e-mail
     * - 409 REGISTRATION_REQUEST_ALREADY_PENDING: já há solicitação pendente
     */
    async function createRequest(input) {
        const data = validateCreateInput(input);

        if (await userRepository.findByEmail(data.email)) {
            throw emailAlreadyExists();
        }

        if (await registrationRequestRepository.findPendingByEmail(data.email)) {
            throw alreadyPending();
        }

        try {
            const request = await registrationRequestRepository.create({
                name: data.name,
                email: data.email,
                status: "PENDING",
                requested_at: now(),
            });

            return toRequesterView(request);
        } catch (error) {
            // Duas solicitações simultâneas: o índice único parcial do banco
            // barra a segunda.
            if (isUniqueViolation(error)) {
                throw alreadyPending();
            }

            throw error;
        }
    }

    /** Lista solicitações (padrão: pendentes), da mais antiga para a mais nova. */
    async function listRequests(query) {
        const { status, limit, offset } = validateListQuery(query);

        const { rows, count } = await registrationRequestRepository.list({
            status: status === "ALL" ? null : status,
            limit,
            offset,
        });

        return {
            requests: rows.map(toAdminView),
            pagination: { limit, offset, total: count },
        };
    }

    /**
     * Aprova a solicitação e cria o usuário, na MESMA transação: ou as duas
     * coisas acontecem, ou nenhuma. O administrador informa a senha inicial.
     * - 404 REGISTRATION_REQUEST_NOT_FOUND
     * - 409 REGISTRATION_REQUEST_ALREADY_REVIEWED
     * - 409 EMAIL_ALREADY_EXISTS (a solicitação continua PENDING)
     */
    async function approveRequest({ requestId, reviewerId, input }) {
        validateRequestId(requestId);

        const { password } = validateApproveInput(input);

        // Fora da transação: o bcrypt é lento e não deve segurar o lock.
        const passwordHash = await passwordHasher.hash(password, BCRYPT_ROUNDS);

        return registrationRequestRepository.runInTransaction(
            async (transaction) => {
                const request =
                    await registrationRequestRepository.findByIdForUpdate(
                        requestId,
                        { transaction }
                    );

                if (!request) {
                    throw notFound();
                }

                if (request.status !== "PENDING") {
                    throw alreadyReviewed();
                }

                const email = normalizeEmail(request.email);

                if (await userRepository.findByEmail(email, { transaction })) {
                    throw emailAlreadyExists();
                }

                let user;

                try {
                    user = await userRepository.create(
                        {
                            name: request.name,
                            email,
                            password_hash: passwordHash,
                            status: "ACTIVE",
                            is_admin: false,
                        },
                        { transaction }
                    );
                } catch (error) {
                    if (isUniqueViolation(error)) {
                        throw emailAlreadyExists();
                    }

                    throw error;
                }

                const updated = await registrationRequestRepository.markApproved(
                    requestId,
                    {
                        reviewedBy: reviewerId,
                        reviewedAt: now(),
                        createdUserId: user.user_id,
                    },
                    { transaction }
                );

                if (!updated) {
                    throw alreadyReviewed();
                }

                return {
                    request: toAdminView(updated),
                    user: toPublicUser(user),
                };
            }
        );
    }

    /**
     * Rejeita a solicitação. O motivo é obrigatório.
     * - 404 REGISTRATION_REQUEST_NOT_FOUND
     * - 409 REGISTRATION_REQUEST_ALREADY_REVIEWED
     */
    async function rejectRequest({ requestId, reviewerId, input }) {
        validateRequestId(requestId);

        const { reason } = validateRejectInput(input);

        return registrationRequestRepository.runInTransaction(
            async (transaction) => {
                const request =
                    await registrationRequestRepository.findByIdForUpdate(
                        requestId,
                        { transaction }
                    );

                if (!request) {
                    throw notFound();
                }

                if (request.status !== "PENDING") {
                    throw alreadyReviewed();
                }

                const updated = await registrationRequestRepository.markRejected(
                    requestId,
                    { reviewedBy: reviewerId, reviewedAt: now(), reason },
                    { transaction }
                );

                if (!updated) {
                    throw alreadyReviewed();
                }

                return { request: toAdminView(updated) };
            }
        );
    }

    return { createRequest, listRequests, approveRequest, rejectRequest };
}

module.exports = {
    createRegistrationRequestService,
    registrationRequestService: createRegistrationRequestService(),
};

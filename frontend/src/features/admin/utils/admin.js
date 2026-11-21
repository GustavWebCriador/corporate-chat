// Mesma política de senha do backend (RF01 / USER-R03).
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 150;
export const EMAIL_MAX_LENGTH = 150;
export const REJECTION_REASON_MAX_LENGTH = 500;

export const PASSWORD_HINT =
    "Mínimo de 8 caracteres, com pelo menos uma letra maiúscula e um número.";

/**
 * Retorna a mensagem de erro da senha ou string vazia se válida.
 */
export function validatePassword(password = "") {
    if (password.length < PASSWORD_MIN_LENGTH) {
        return "A senha deve ter no mínimo 8 caracteres.";
    }

    if (password.length > PASSWORD_MAX_LENGTH) {
        return "A senha deve ter no máximo 128 caracteres.";
    }

    if (!/[A-Z]/.test(password)) {
        return "A senha deve conter pelo menos uma letra maiúscula.";
    }

    if (!/[0-9]/.test(password)) {
        return "A senha deve conter pelo menos um número.";
    }

    return "";
}

const ERROR_MESSAGES = {
    EMAIL_ALREADY_EXISTS: "Já existe um usuário com este e-mail.",
    REGISTRATION_REQUEST_ALREADY_REVIEWED: "Esta solicitação já foi analisada.",
    REGISTRATION_REQUEST_NOT_FOUND: "Solicitação não encontrada.",
    USER_NOT_FOUND: "Usuário não encontrado.",
    ADMIN_REQUIRED: "Acesso restrito a administradores.",
    INVALID_USER_STATUS: "Situação inválida.",
};

/**
 * Mensagem amigável para erros das rotas administrativas.
 */
export function describeAdminError(error, fallback = "Não foi possível concluir a operação.") {
    if (ERROR_MESSAGES[error?.code]) {
        return ERROR_MESSAGES[error.code];
    }

    if (Array.isArray(error?.details) && error.details[0]?.message) {
        return error.details.map((detail) => detail.message).join(" ");
    }

    if (error?.status === 400 && error.message) {
        return error.message;
    }

    return fallback;
}

export function formatDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export const REQUEST_STATUS_LABELS = {
    PENDING: "Pendente",
    APPROVED: "Aprovada",
    REJECTED: "Rejeitada",
};

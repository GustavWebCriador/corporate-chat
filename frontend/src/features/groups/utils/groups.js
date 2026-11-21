// Regras do RF09 / RN07 / RN08.
export const GROUP_NAME_MAX_LENGTH = 30;
export const GROUP_MIN_MEMBERS = 2;
export const GROUP_MAX_MEMBERS = 50;

const ERROR_MESSAGES = {
    GROUP_NAME_REQUIRED: "Informe o nome do grupo.",
    GROUP_NAME_TOO_LONG: `O nome deve ter no máximo ${GROUP_NAME_MAX_LENGTH} caracteres.`,
    GROUP_MEMBERS_REQUIRED: "Selecione ao menos um participante.",
    INVALID_GROUP_SIZE: `O grupo deve ter entre ${GROUP_MIN_MEMBERS} e ${GROUP_MAX_MEMBERS} participantes, incluindo você.`,
    GROUP_MAX_MEMBERS_EXCEEDED: `O grupo não pode ultrapassar ${GROUP_MAX_MEMBERS} participantes.`,
    GROUP_MEMBERS_NOT_FOUND: "Algum participante selecionado não foi encontrado.",
    GROUP_MEMBERS_INACTIVE: "Algum participante selecionado está desativado.",
    GROUP_MEMBERS_ALREADY_ACTIVE: "Algum participante selecionado já está no grupo.",
    GROUP_MEMBER_REENTRY_NOT_SUPPORTED: "Quem saiu ou foi removido do grupo não pode ser adicionado novamente nesta versão.",
    GROUP_CREATOR_REQUIRED: "Somente o criador do grupo pode fazer isso.",
    GROUP_CREATOR_CANNOT_BE_REMOVED: "O criador não pode ser removido do grupo.",
    GROUP_CREATOR_CANNOT_LEAVE: "O criador não pode sair do grupo nesta versão.",
    GROUP_MEMBERSHIP_REQUIRED: "Você não participa mais deste grupo.",
    GROUP_MEMBER_NOT_ACTIVE: "Este participante já não está no grupo.",
    GROUP_NOT_FOUND: "Grupo não encontrado.",
};

export function describeGroupError(error, fallback = "Não foi possível concluir a operação.") {
    return ERROR_MESSAGES[error?.code] ?? fallback;
}

export function roleLabel(role) {
    return role === "CREATOR" ? "Criador" : "Membro";
}

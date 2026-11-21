
export const GROUP_NAME_MAX_LENGTH = 30;
export const GROUP_MAX_MEMBERS = 50;
export const GROUP_MAX_SELECTED_MEMBERS = GROUP_MAX_MEMBERS - 1;

const ERROR_MESSAGES = {
    GROUP_NAME_REQUIRED: "Informe o nome do grupo.",
    GROUP_NAME_TOO_LONG: "O nome deve ter no máximo 30 caracteres.",
    GROUP_MEMBERS_REQUIRED: "Selecione pelo menos um participante.",
    INVALID_GROUP_MEMBERS: "A seleção de participantes é inválida.",
    INVALID_GROUP_SIZE: "O grupo deve ter entre 2 e 50 participantes.",
    GROUP_MEMBERS_NOT_FOUND: "Um dos participantes não foi encontrado.",
    GROUP_MEMBERS_INACTIVE: "Um dos participantes está inativo.",
    GROUP_MEMBERS_ALREADY_ACTIVE: "Este participante já está no grupo.",
    GROUP_MEMBER_REENTRY_NOT_SUPPORTED:
        "Não é possível adicionar novamente um participante que saiu ou foi removido nesta versão.",
    GROUP_MAX_MEMBERS_EXCEEDED:
        "O grupo não pode ultrapassar 50 participantes.",
    GROUP_CREATOR_REQUIRED:
        "Somente o criador pode realizar esta operação.",
    GROUP_CREATOR_CANNOT_BE_REMOVED:
        "O criador não pode ser removido.",
    GROUP_CREATOR_CANNOT_LEAVE:
        "O criador não pode sair do grupo nesta versão.",
    GROUP_MEMBERSHIP_REQUIRED:
        "Você não participa mais deste grupo.",
    GROUP_MEMBER_NOT_ACTIVE:
        "Este participante não está mais ativo no grupo.",
    GROUP_NOT_FOUND: "Grupo não encontrado.",
};

export function describeGroupError(
    error,
    fallback = "Não foi possível concluir a operação."
) {
    if (error?.status === 401) {
        return "Sua sessão expirou. Entre novamente.";
    }

    return ERROR_MESSAGES[error?.code] ?? fallback;
}

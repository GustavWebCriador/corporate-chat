const PASSWORD_MIN_LENGTH =
    8;

const PASSWORD_MAX_LENGTH =
    128;


/**
 * Valida a política de senha
 * utilizada no Corporate Chat.
 */
function validatePassword(
    password
) {

    const details =
        [];


    if (
        typeof password !==
        "string"
    ) {

        details.push({
            field:
                "password",

            message:
                "A senha deve ser uma string.",
        });


        return details;
    }


    if (
        password.length <
        PASSWORD_MIN_LENGTH
    ) {

        details.push({
            field:
                "password",

            message:
                "A senha deve possuir no mínimo 8 caracteres.",
        });
    }


    if (
        password.length >
        PASSWORD_MAX_LENGTH
    ) {

        details.push({
            field:
                "password",

            message:
                "A senha excede o tamanho máximo permitido.",
        });
    }


    if (
        !/[A-Z]/.test(
            password
        )
    ) {

        details.push({
            field:
                "password",

            message:
                "A senha deve possuir pelo menos uma letra maiúscula.",
        });
    }


    if (
        !/[0-9]/.test(
            password
        )
    ) {

        details.push({
            field:
                "password",

            message:
                "A senha deve possuir pelo menos um número.",
        });
    }


    return details;
}


module.exports = {

    PASSWORD_MIN_LENGTH,

    PASSWORD_MAX_LENGTH,

    validatePassword,
};
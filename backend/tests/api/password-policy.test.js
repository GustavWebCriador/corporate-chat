const test =
    require(
        "node:test"
    );

const assert =
    require(
        "node:assert/strict"
    );


const {
    validatePassword,
} = require(
    "../../src/validators/passwordPolicy"
);


test(
    "PASSWORD: senha válida deve ser aceita",
    () => {

        const details =
            validatePassword(
                "Senha123"
            );


        assert.equal(
            details.length,
            0
        );
    }
);


test(
    "PASSWORD: senha menor que 8 caracteres deve ser rejeitada",
    () => {

        const details =
            validatePassword(
                "Sen1"
            );


        assert.ok(
            details.length > 0
        );
    }
);


test(
    "PASSWORD: senha sem maiúscula deve ser rejeitada",
    () => {

        const details =
            validatePassword(
                "senha123"
            );


        assert.ok(
            details.some(
                detail =>
                    detail.message.includes(
                        "maiúscula"
                    )
            )
        );
    }
);


test(
    "PASSWORD: senha sem número deve ser rejeitada",
    () => {

        const details =
            validatePassword(
                "SenhaForte"
            );


        assert.ok(
            details.some(
                detail =>
                    detail.message.includes(
                        "número"
                    )
            )
        );
    }
);


test(
    "PASSWORD: senha acima de 128 caracteres deve ser rejeitada",
    () => {

        const password =
            `A1${"a".repeat(127)}`;


        const details =
            validatePassword(
                password
            );


        assert.ok(
            details.length > 0
        );
    }
);
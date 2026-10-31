const test =
    require(
        "node:test"
    );

const assert =
    require(
        "node:assert/strict"
    );

const {
    validateRuntimeConfig,
} = require(
    "../../src/config/runtime"
);


const VALID_ENV = {
    NODE_ENV:
        "test",

    PORT:
        "3000",

    POSTGRES_HOST:
        "127.0.0.1",

    POSTGRES_PORT:
        "5433",

    POSTGRES_USER:
        "test",

    POSTGRES_PASSWORD:
        "test",

    POSTGRES_DB:
        "corporate_chat_test",

    MONGO_HOST:
        "127.0.0.1",

    MONGO_PORT:
        "27017",

    MONGO_USER:
        "test",

    MONGO_PASSWORD:
        "test",

    MONGO_DB:
        "corporate_chat_test",

    JWT_SECRET:
        "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres",

    CORS_ORIGIN:
        undefined,
};


function withEnv(
    values,
    run
) {
    const previous =
        {};


    for (
        const key of
        Object.keys(
            values
        )
    ) {
        previous[key] = {
            exists:
                Object
                    .prototype
                    .hasOwnProperty
                    .call(
                        process.env,
                        key
                    ),

            value:
                process.env[key],
        };


        if (
            values[key] ===
            undefined
        ) {
            delete process
                .env[key];

        } else {
            process.env[key] =
                values[key];
        }
    }


    try {
        return run();

    } finally {
        for (
            const key of
            Object.keys(
                values
            )
        ) {
            if (
                previous[key]
                    .exists
            ) {
                process.env[key] =
                    previous[key]
                        .value;

            } else {
                delete process
                    .env[key];
            }
        }
    }
}


function withValidEnv(
    overrides,
    run
) {
    return withEnv(
        {
            ...VALID_ENV,
            ...overrides,
        },
        run
    );
}


test(
    "BE-12 RUNTIME: configuração válida é aceita",

    () => {
        withValidEnv(
            {},
            () => {
                const config =
                    validateRuntimeConfig();


                assert.deepEqual(
                    config,
                    {
                        nodeEnv:
                            "test",

                        port:
                            3000,
                    }
                );
            }
        );
    }
);


test(
    "BE-12 RUNTIME: PORT utiliza 3000 quando não informado",

    () => {
        withValidEnv(
            {
                PORT:
                    undefined,
            },
            () => {
                const config =
                    validateRuntimeConfig();


                assert.equal(
                    config.port,
                    3000
                );
            }
        );
    }
);


test(
    "BE-12 RUNTIME: variável obrigatória ausente interrompe configuração",

    () => {
        withValidEnv(
            {
                POSTGRES_PASSWORD:
                    undefined,
            },
            () => {
                assert.throws(
                    () =>
                        validateRuntimeConfig(),

                    /POSTGRES_PASSWORD não configurado/
                );
            }
        );
    }
);


test(
    "BE-12 RUNTIME: porta PostgreSQL inválida é rejeitada",

    () => {
        withValidEnv(
            {
                POSTGRES_PORT:
                    "abc",
            },
            () => {
                assert.throws(
                    () =>
                        validateRuntimeConfig(),

                    /POSTGRES_PORT deve ser um número inteiro/
                );
            }
        );
    }
);


test(
    "BE-12 RUNTIME: porta MongoDB fora do intervalo é rejeitada",

    () => {
        withValidEnv(
            {
                MONGO_PORT:
                    "70000",
            },
            () => {
                assert.throws(
                    () =>
                        validateRuntimeConfig(),

                    /MONGO_PORT deve ser um número inteiro/
                );
            }
        );
    }
);


test(
    "BE-12 RUNTIME: NODE_ENV desconhecido é rejeitado",

    () => {
        withValidEnv(
            {
                NODE_ENV:
                    "local",
            },
            () => {
                assert.throws(
                    () =>
                        validateRuntimeConfig(),

                    /NODE_ENV deve ser development, test ou production/
                );
            }
        );
    }
);


test(
    "BE-12 RUNTIME: produção exige CORS_ORIGIN",

    () => {
        withValidEnv(
            {
                NODE_ENV:
                    "production",

                CORS_ORIGIN:
                    undefined,
            },
            () => {
                assert.throws(
                    () =>
                        validateRuntimeConfig(),

                    /CORS_ORIGIN é obrigatório em produção/
                );
            }
        );
    }
);


test(
    "BE-12 RUNTIME: produção exige JWT_SECRET forte",

    () => {
        withValidEnv(
            {
                NODE_ENV:
                    "production",

                CORS_ORIGIN:
                    "https://app.corp.local",

                JWT_SECRET:
                    "curto",
            },
            () => {
                assert.throws(
                    () =>
                        validateRuntimeConfig(),

                    /JWT_SECRET deve ter pelo menos/
                );
            }
        );
    }
);
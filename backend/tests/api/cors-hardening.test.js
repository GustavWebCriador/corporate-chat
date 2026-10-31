process.env.NODE_ENV =
    "test";


const test =
    require(
        "node:test"
    );


const assert =
    require(
        "node:assert/strict"
    );


const {
    buildCorsOptions,
    getAllowedCorsOrigins,
    isOriginAllowed,
} = require(
    "../../src/config/cors"
);


const {
    createApp,
} = require(
    "../../src/app"
);


/*
 * * ENV HELPER
 * */

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
                process.env[
                    key
                ],
        };


        const nextValue =
            values[key];


        if (
            nextValue ===
            undefined
        ) {
            delete process
                .env[key];

        } else {
            process.env[
                key
            ] =
                nextValue;
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
                process.env[
                    key
                ] =
                    previous[key]
                        .value;

            } else {
                delete process
                    .env[key];
            }
        }
    }
}


/*
 * * SERVER HELPERS
 * */

function listen(
    app
) {
    return new Promise(
        resolve => {

            const server =
                app.listen(
                    0,
                    "127.0.0.1",
                    () => {

                        resolve({
                            server,

                            baseUrl:
                                `http://127.0.0.1:${server.address().port}`,
                        });
                    }
                );
        }
    );
}


function close(
    server
) {
    return new Promise(
        resolve =>
            server.close(
                resolve
            )
    );
}


/*
 * * CONFIG TESTS
 * */

test(
    "BE-12 CORS: desenvolvimento sem CORS_ORIGIN mantém origem dinâmica",

    () => {
        withEnv(
            {
                NODE_ENV:
                    "test",

                CORS_ORIGIN:
                    undefined,
            },

            () => {
                const options =
                    buildCorsOptions();


                assert.equal(
                    options.origin,
                    true
                );


                assert.equal(
                    options.credentials,
                    false
                );
            }
        );
    }
);


test(
    "BE-12 CORS: produção exige CORS_ORIGIN explícito",

    () => {
        withEnv(
            {
                NODE_ENV:
                    "production",

                CORS_ORIGIN:
                    undefined,
            },

            () => {
                assert.throws(
                    () =>
                        buildCorsOptions(),

                    /CORS_ORIGIN é obrigatório/
                );
            }
        );
    }
);


test(
    "BE-12 CORS: wildcard é rejeitado em produção",

    () => {
        withEnv(
            {
                NODE_ENV:
                    "production",

                CORS_ORIGIN:
                    "*",
            },

            () => {
                assert.throws(
                    () =>
                        buildCorsOptions(),

                    /não pode utilizar '\*'/
                );
            }
        );
    }
);


test(
    "BE-12 CORS: origens são normalizadas e duplicidades removidas",

    () => {
        withEnv(
            {
                NODE_ENV:
                    "production",

                CORS_ORIGIN:
                    "https://app.corp.local/, https://admin.corp.local, https://app.corp.local",
            },

            () => {
                const origins =
                    getAllowedCorsOrigins();


                assert.deepEqual(
                    origins,
                    [
                        "https://app.corp.local",
                        "https://admin.corp.local",
                    ]
                );


                assert.equal(
                    isOriginAllowed(
                        "https://app.corp.local"
                    ),
                    true
                );


                assert.equal(
                    isOriginAllowed(
                        "https://evil.example"
                    ),
                    false
                );
            }
        );
    }
);


test(
    "BE-12 CORS: origem com path é rejeitada",

    () => {
        withEnv(
            {
                NODE_ENV:
                    "production",

                CORS_ORIGIN:
                    "https://app.corp.local/private",
            },

            () => {
                assert.throws(
                    () =>
                        buildCorsOptions(),

                    /somente protocolo, host e porta/
                );
            }
        );
    }
);


/*
 * 
 * HTTP INTEGRATION
 * 
 * */

test(
    "BE-12 CORS: Express expõe header apenas para origem autorizada",

    async () => {
        const app =
            withEnv(
                {
                    NODE_ENV:
                        "production",

                    CORS_ORIGIN:
                        "https://app.corp.local",
                },

                () =>
                    createApp()
            );


        const {
            server,
            baseUrl,
        } =
            await listen(
                app
            );


        try {
            const allowed =
                await fetch(
                    `${baseUrl}/api/v1/nao-existe`,

                    {
                        headers: {
                            Origin:
                                "https://app.corp.local",
                        },
                    }
                );


            assert.equal(
                allowed
                    .headers
                    .get(
                        "access-control-allow-origin"
                    ),

                "https://app.corp.local"
            );


            const blocked =
                await fetch(
                    `${baseUrl}/api/v1/nao-existe`,

                    {
                        headers: {
                            Origin:
                                "https://evil.example",
                        },
                    }
                );


            /*
             * CORS não é firewall.
             *
             * A requisição chega ao Express,
             * porém o navegador não recebe
             * autorização para expor a resposta.
             */
            assert.equal(
                blocked
                    .headers
                    .get(
                        "access-control-allow-origin"
                    ),

                null
            );

        } finally {
            await close(
                server
            );
        }
    }
);
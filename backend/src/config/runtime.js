const {
    getJwtConfig,
} = require(
    "./jwt"
);

const {
    getAllowedCorsOrigins,
} = require(
    "./cors"
);


const VALID_NODE_ENVS =
    new Set([
        "development",
        "test",
        "production",
    ]);


const REQUIRED_VARIABLES = [
    "POSTGRES_HOST",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",

    "MONGO_HOST",
    "MONGO_USER",
    "MONGO_PASSWORD",
    "MONGO_DB",
];


function requireEnvironmentVariable(
    name
) {
    const value =
        process.env[name];


    if (
        typeof value !==
            "string" ||
        value.trim()
            .length === 0
    ) {
        throw new Error(
            `${name} não configurado.`
        );
    }


    return value.trim();
}


function parsePort(
    name,
    {
        defaultValue,
    } = {}
) {
    const raw =
        process.env[name];


    if (
        (
            raw === undefined ||
            raw.trim() === ""
        ) &&
        defaultValue !== undefined
    ) {
        return defaultValue;
    }


    const value =
        requireEnvironmentVariable(
            name
        );


    const port =
        Number(
            value
        );


    if (
        !Number.isInteger(
            port
        ) ||
        port < 1 ||
        port > 65535
    ) {
        throw new Error(
            `${name} deve ser um número inteiro entre 1 e 65535.`
        );
    }


    return port;
}


function validateRuntimeConfig() {
    const nodeEnv =
        requireEnvironmentVariable(
            "NODE_ENV"
        );


    if (
        !VALID_NODE_ENVS.has(
            nodeEnv
        )
    ) {
        throw new Error(
            "NODE_ENV deve ser development, test ou production."
        );
    }


    for (
        const variable of
        REQUIRED_VARIABLES
    ) {
        requireEnvironmentVariable(
            variable
        );
    }


    parsePort(
        "POSTGRES_PORT"
    );


    parsePort(
        "MONGO_PORT"
    );


    const port =
        parsePort(
            "PORT",
            {
                defaultValue:
                    3000,
            }
        );


    /*
     * JWT e CORS já possuem regras próprias de segurança.
     * A validação central reutiliza essas regras para evitar
     * contratos diferentes entre startup e runtime.
     */
    getJwtConfig();
    getAllowedCorsOrigins();


    return {
        nodeEnv,
        port,
    };
}


module.exports = {
    validateRuntimeConfig,
};
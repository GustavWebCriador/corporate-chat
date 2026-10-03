const {
    spawnSync
} = require("child_process");

const fs = require("fs");
const path = require("path");


const backendPath =
    path.resolve(__dirname, "..");


const envPath =
    path.join(
        backendPath,
        ".env"
    );


function run(command) {

    console.log("");
    console.log(
        `> ${command}`
    );

    const result =
        spawnSync(
            command,
            {
                cwd: backendPath,

                stdio: "inherit",

                shell: true,

                env: process.env,
            }
        );


    if (
        result.status !== 0
    ) {

        console.error("");
        console.error(
            `[FRESH] Command failed: ${command}`
        );

        process.exit(
            result.status || 1
        );
    }
}


/*
 * Proteção contra execução acidental
 */
const confirmed =
    process.argv.includes(
        "--confirm"
    );


if (!confirmed) {

    console.error("");
    console.error(
        "ATENÇÃO:"
    );

    console.error(
        "Este comando remove todos os dados locais do PostgreSQL e MongoDB."
    );

    console.error("");

    console.error(
        "Para confirmar:"
    );

    console.error(
        "npm run env:fresh -- --confirm"
    );

    process.exit(1);
}


/*
 * Verifica .env
 */
if (
    !fs.existsSync(envPath)
) {

    console.error(
        ".env não encontrado."
    );

    process.exit(1);
}


console.log("");
console.log(
    "========================================"
);

console.log(
    " Corporate Chat - Fresh Environment"
);

console.log(
    "========================================"
);


/*
 * Remove infraestrutura e volumes
 */
run(
    'docker compose -f "../docker-compose.yml" down -v'
);


/*
 * Cria PostgreSQL e MongoDB vazios
 */
run(
    'docker compose -f "../docker-compose.yml" up -d --wait'
);


/*
 * PostgreSQL
 */
run(
    "npx sequelize-cli db:migrate"
);


run(
    "npx sequelize-cli db:seed:all"
);


/*
 * MongoDB
 */
run(
    "node database/mongodb/sync-indexes.js"
);


run(
    "node database/mongodb/seeds/development.js"
);


/*
 * Testes
 */
run(
    "node database/postgres/health-test.js"
);


run(
    "node database/mongodb/smoke-test.js"
);

run(
    "node database/mongodb/health-test.js"
);



run(
    "npx sequelize-cli db:migrate:status"
);


console.log("");
console.log(
    "========================================"
);

console.log(
    " Environment rebuilt successfully"
);

console.log(
    "========================================"
);
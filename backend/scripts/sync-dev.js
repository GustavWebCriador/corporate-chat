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
            `[SETUP] Command failed: ${command}`
        );

        process.exit(
            result.status || 1
        );
    }
}


console.log("");
console.log(
    "========================================"
);

console.log(
    " Corporate Chat - Environment Sync"
);

console.log(
    "========================================"
);


/*
 * Verifica .env
 */
if (
    !fs.existsSync(envPath)
) {

    console.error("");
    console.error(
        "[SETUP] Arquivo .env não encontrado."
    );

    console.error(
        "Copie .env.example para .env e configure as variáveis."
    );

    process.exit(1);
}


console.log(
    "[SETUP] .env found."
);


/*
 * Infraestrutura
 */
run(
    'docker compose --env-file .env -f "../docker-compose.yml" up -d --wait'
);


/*
 * PostgreSQL migrations
 */
run(
    "npx sequelize-cli db:migrate"
);


/*
 * PostgreSQL development seeders
 *
 * Como SequelizeData está habilitado,
 * apenas novos seeders serão executados.
 *
 *
 * MongoDB indexes
 */
run(
    "node scripts/seed-dev.js"
);

/*
* Mongo DB smoke test
*/
run(
    "node database/mongodb/smoke-test.js"
);

/*
 * Health tests
 */
run(
    "node database/postgres/health-test.js"
);

run(
    "node database/mongodb/health-test.js"
);


/*
 * Migration status
 */
run(
    "npx sequelize-cli db:migrate:status"
);


console.log("");
console.log(
    "========================================"
);

console.log(
    " Corporate Chat environment synchronized"
);

console.log(
    "========================================"
);
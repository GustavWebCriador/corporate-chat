require("dotenv").config();

const {
    spawnSync,
} = require("child_process");

const path =
    require("path");


const backendPath =
    path.resolve(
        __dirname,
        ".."
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
                cwd:
                    backendPath,

                stdio:
                    "inherit",

                shell:
                    true,

                env:
                    process.env,
            }
        );


    if (
        result.status !== 0
    ) {

        console.error("");

        console.error(
            `[INTEGRITY] Command failed: ${command}`
        );


        process.exit(
            result.status || 1
        );
    }
}


/*
 * PER-07 está usando atualmente
 * o ambiente local de desenvolvimento.
 */
if (
    process.env.NODE_ENV !==
    "development"
) {

    console.error(
        "Integrity tests are allowed only in development."
    );

    process.exit(1);
}


console.log("");

console.log(
    "========================================"
);

console.log(
    " Corporate Chat - Persistence Integrity"
);

console.log(
    "========================================"
);


/*
 * Garante os índices MongoDB.
 */
run(
    "node database/mongodb/sync-indexes.js"
);


/*
 * Valida a massa oficial da PER-06
 * e a relação PostgreSQL ↔ MongoDB.
 */
run(
    "node scripts/verify-dev-seed.js"
);


/*
 * Executa os testes positivos e negativos.
 *
 * --test-concurrency=1:
 * roda de maneira previsível e sequencial
 * no ambiente local.
 */
run(
    "node --test --test-concurrency=1 database/tests/integrity/postgres-integrity.test.js database/tests/integrity/mongodb-integrity.test.js"
);


console.log("");

console.log(
    "========================================"
);

console.log(
    " Persistence integrity: VALID"
);

console.log(
    "========================================"
);
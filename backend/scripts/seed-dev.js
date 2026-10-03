require("dotenv").config();

const {
    spawnSync
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

        process.exit(
            result.status || 1
        );
    }
}


if (
    process.env.NODE_ENV !==
    "development"
) {

    console.error(
        "Development seed blocked outside development."
    );

    process.exit(1);
}


console.log("");
console.log(
    "========================================"
);

console.log(
    " Corporate Chat - Development Seeds"
);

console.log(
    "========================================"
);


/*
 * PostgreSQL
 */
run(
    "npx sequelize-cli db:seed:all"
);


/*
 * MongoDB indexes
 */
run(
    "node database/mongodb/sync-indexes.js"
);


/*
 * MongoDB fixtures
 */
run(
    "node database/mongodb/seeds/development.js"
);


/*
 * Validation
 */
run(
    "node scripts/verify-dev-seed.js"
);


console.log("");
console.log(
    "========================================"
);

console.log(
    " Development seed completed"
);

console.log(
    "========================================"
);
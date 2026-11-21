"use strict";

/*
 * DEP-01.2 — Cria o primeiro administrador do ambiente publicado.
 *
 * Em produção não existe seed (os usuários de desenvolvimento têm senha
 * conhecida). Este comando cria o administrador inicial pedindo a senha
 * sem exibi-la; ela não passa por variável de ambiente nem fica no
 * histórico do terminal.
 *
 * Uso no servidor (dentro do contêiner da API):
 *
 *   docker compose -f docker-compose.deploy.yml -f docker-compose.aws.yml \
 *       run --rm api node src/operations/createAdmin.js \
 *       --name "Nome do Administrador" --email admin@empresa.com
 *
 * Sem terminal interativo, a senha é lida da primeira linha da entrada
 * padrão (útil em automação: printf '%s\n' "$SENHA" | ... -T ...).
 *
 * O comando recusa a criação se já houver um administrador ativo.
 */

const readline = require("node:readline");

function parseArgs(argv) {
    const options = {};

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === "--name" || arg === "--email") {
            const value = argv[index + 1];

            if (value === undefined || value.startsWith("--")) {
                throw new Error(`Informe um valor para ${arg}.`);
            }

            options[arg.slice(2)] = value;
            index += 1;
        } else if (arg === "--help" || arg === "-h") {
            options.help = true;
        } else {
            throw new Error(`Opção desconhecida: ${arg}`);
        }
    }

    return options;
}

/*
 * Lê uma linha sem ecoar os caracteres digitados.
 */
function askHidden(question, { input = process.stdin, output = process.stdout } = {}) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input, output, terminal: true });

        rl._writeToOutput = function writeMasked(text) {
            if (text.includes(question)) {
                output.write(text);
            }
        };

        rl.question(question, (answer) => {
            rl.close();
            output.write("\n");
            resolve(answer);
        });
    });
}

function readFirstLine(input = process.stdin) {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({ input, terminal: false });
        let resolved = false;

        rl.once("line", (line) => {
            resolved = true;
            rl.close();
            resolve(line);
        });
        rl.once("close", () => {
            if (!resolved) {
                reject(new Error("Nenhuma senha recebida na entrada padrão."));
            }
        });
    });
}

async function readPassword({ input = process.stdin, output = process.stdout } = {}) {
    if (!input.isTTY) {
        return readFirstLine(input);
    }

    const first = await askHidden("Senha do administrador: ", { input, output });
    const second = await askHidden("Repita a senha: ", { input, output });

    if (first !== second) {
        throw new Error("As senhas digitadas não coincidem.");
    }

    return first;
}

function describeError(error) {
    if (error && error.code === "VALIDATION_ERROR" && Array.isArray(error.details)) {
        return [error.message, ...error.details.map((detail) => `- ${detail.field}: ${detail.message}`)].join("\n");
    }

    return error && error.message ? error.message : String(error);
}

/*
 * Executa a criação. Dependências injetáveis para teste.
 */
async function runCreateAdmin({
    argv = process.argv.slice(2),
    userService,
    passwordReader = readPassword,
    log = console.log,
} = {}) {
    const options = parseArgs(argv);

    if (options.help) {
        log("Uso: node src/operations/createAdmin.js --name \"Nome\" --email admin@empresa.com");
        return null;
    }

    if (!options.name || !options.email) {
        throw new Error("Informe --name e --email.");
    }

    const password = await passwordReader();

    const user = await userService.createInitialAdmin({
        name: options.name,
        email: options.email,
        password,
    });

    log(`[DEP-01.2] Administrador criado: ${user.email} (${user.user_id})`);

    return user;
}

async function main() {
    require("dotenv").config();

    const { sequelize, connectPostgres } = require("../config/db/postgres");
    const { userService } = require("../services/users/userService");

    let exitCode = 0;

    try {
        await connectPostgres();
        await runCreateAdmin({ userService });
    } catch (error) {
        console.error(`[DEP-01.2] Não foi possível criar o administrador.\n${describeError(error)}`);
        exitCode = 1;
    } finally {
        await sequelize.close().catch(() => {});
    }

    process.exitCode = exitCode;
}

if (require.main === module) {
    main();
}

module.exports = {
    parseArgs,
    readPassword,
    runCreateAdmin,
};

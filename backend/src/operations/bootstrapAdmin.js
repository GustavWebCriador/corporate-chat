/*Esse script utiliza o modelo User e a política de senhas que o backend já possui. Ele cria o primeiro
administrador no PostgreSQL,
sem utilizar os seeds de desenvolvimento.
A execução será feita uma única vez, depois que os bancos e a API estiverem funcionando.
A senha não ficará gravada no código nem no GitHub.*/

"use strict";

const bcrypt = require("bcryptjs");

const {
    sequelize,
    User,
} = require("../models/postgres");

const {
    validatePassword,
} = require("../validators/passwordPolicy");

async function main() {
    if (process.env.NODE_ENV !== "production") {
        throw new Error(
            "Bootstrap exige NODE_ENV=production."
        );
    }

    // Entrada: nome, email e senha separados
    // por bytes NUL, enviados via stdin.
    const chunks = [];
    let total = 0;

    for await (const chunk of process.stdin) {
        total += chunk.length;

        if (total > 8192) {
            throw new Error("Entrada muito grande.");
        }

        chunks.push(chunk);
    }

    const parts = Buffer.concat(chunks)
        .toString("utf8")
        .split("\0");

    if (parts.length !== 3) {
        throw new Error(
            "Informe nome, email e senha via stdin."
        );
    }

    const name = parts[0].trim();
    const email = parts[1].trim().toLowerCase();
    const password = parts[2];

    if (!name || name.length > 150) {
        throw new Error("Nome inválido.");
    }

    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 150
    ) {
        throw new Error("E-mail inválido.");
    }

    const violations = validatePassword(password);

    if (violations.length > 0) {
        throw new Error(
            "Senha inválida: " +
            violations.map(v => v.message).join(" ")
        );
    }

    await sequelize.authenticate();

    const adminCount = await User.count({
        where: {
            is_admin: true,
        },
    });

    if (adminCount > 0) {
        throw new Error(
            "Já existe um administrador. Bootstrap recusado."
        );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
        name,
        email,
        password_hash: passwordHash,
        status: "ACTIVE",
        is_admin: true,
    });

    console.log(
        `Administrador criado. ID: ${user.user_id}`
    );
}

main()
    .catch(error => {
        console.error(
            "Falha no bootstrap:",
            error.message
        );

        process.exitCode = 1;
    })
    .finally(async () => {
        await sequelize.close();
    });

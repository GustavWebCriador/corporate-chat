process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const { PassThrough } = require("node:stream");

const { createUserService } = require("../../src/services/users/userService");
const { parseArgs, readPassword, runCreateAdmin } = require("../../src/operations/createAdmin");

/*
 * DEP-01.2 — Administrador inicial do ambiente publicado.
 */

const VALID_PASSWORD = "Admin@Producao2026";

function createRepository({ users = [] } = {}) {
    const created = [];

    return {
        created,
        async findAll() {
            return users;
        },
        async findByEmail(email) {
            return users.find((user) => user.email === email) ?? null;
        },
        async create(data) {
            created.push(data);
            return { user_id: "u-admin", created_at: new Date(), updated_at: new Date(), last_login_at: null, ...data };
        },
    };
}

const fastHasher = { hash: async (password) => `hash:${password}` };

test("DEP-01.2: cria o administrador inicial com is_admin=true e senha com hash", async () => {
    const repository = createRepository();
    const service = createUserService({ userRepository: repository, passwordHasher: fastHasher });

    const user = await service.createInitialAdmin({
        name: "  Administração  ",
        email: "  Admin@Empresa.com ",
        password: VALID_PASSWORD,
    });

    assert.equal(repository.created.length, 1);
    assert.equal(repository.created[0].is_admin, true);
    assert.equal(repository.created[0].status, "ACTIVE");
    assert.equal(repository.created[0].email, "admin@empresa.com");
    assert.equal(repository.created[0].password_hash, `hash:${VALID_PASSWORD}`);
    assert.equal(user.is_admin, true);
    assert.equal("password_hash" in user, false);
});

test("DEP-01.2: recusa criar se já existe administrador ativo", async () => {
    const repository = createRepository({
        users: [{ user_id: "u-1", email: "chefe@empresa.com", is_admin: true, status: "ACTIVE" }],
    });
    const service = createUserService({ userRepository: repository, passwordHasher: fastHasher });

    await assert.rejects(
        service.createInitialAdmin({ name: "Outro", email: "outro@empresa.com", password: VALID_PASSWORD }),
        (error) => error.code === "ADMIN_ALREADY_EXISTS" && error.statusCode === 409
    );
    assert.equal(repository.created.length, 0);
});

test("DEP-01.2: administrador inativo não impede criar um novo", async () => {
    const repository = createRepository({
        users: [{ user_id: "u-1", email: "antigo@empresa.com", is_admin: true, status: "INACTIVE" }],
    });
    const service = createUserService({ userRepository: repository, passwordHasher: fastHasher });

    const user = await service.createInitialAdmin({ name: "Nova", email: "nova@empresa.com", password: VALID_PASSWORD });
    assert.equal(user.is_admin, true);
});

test("DEP-01.2: aplica a mesma política de senha do cadastro", async () => {
    const repository = createRepository();
    const service = createUserService({ userRepository: repository, passwordHasher: fastHasher });

    await assert.rejects(
        service.createInitialAdmin({ name: "Admin", email: "admin@empresa.com", password: "123" }),
        (error) => error.code === "VALIDATION_ERROR"
    );
    assert.equal(repository.created.length, 0);
});

test("DEP-01.2: o cadastro comum continua criando usuários sem privilégio", async () => {
    const repository = createRepository();
    const service = createUserService({ userRepository: repository, passwordHasher: fastHasher });

    await service.createUser({ name: "Maria", email: "maria@empresa.com", password: VALID_PASSWORD });
    assert.equal(repository.created[0].is_admin, false);
});

test("DEP-01.2: comando lê --name e --email e recusa opções desconhecidas", () => {
    assert.deepEqual(parseArgs(["--name", "Admin", "--email", "a@b.com"]), { name: "Admin", email: "a@b.com" });
    assert.throws(() => parseArgs(["--email"]), /--email/);
    assert.throws(() => parseArgs(["--password", "x"]), /desconhecida/);
});

test("DEP-01.2: comando exige nome e e-mail e repassa a senha lida", async () => {
    const calls = [];
    const userService = {
        async createInitialAdmin(input) {
            calls.push(input);
            return { user_id: "u-admin", email: input.email };
        },
    };

    await assert.rejects(
        runCreateAdmin({ argv: ["--name", "Admin"], userService, passwordReader: async () => VALID_PASSWORD, log() {} }),
        /--name e --email/
    );

    const user = await runCreateAdmin({
        argv: ["--name", "Admin", "--email", "admin@empresa.com"],
        userService,
        passwordReader: async () => VALID_PASSWORD,
        log() {},
    });

    assert.equal(user.user_id, "u-admin");
    assert.deepEqual(calls, [{ name: "Admin", email: "admin@empresa.com", password: VALID_PASSWORD }]);
});

test("DEP-01.2: sem terminal, a senha vem da primeira linha da entrada padrão", async () => {
    const input = new PassThrough();
    input.isTTY = false;
    const pending = readPassword({ input, output: new PassThrough() });
    input.end(`${VALID_PASSWORD}\nlinha-ignorada\n`);

    assert.equal(await pending, VALID_PASSWORD);
});

test("DEP-01.2: entrada padrão vazia gera erro claro", async () => {
    const input = new PassThrough();
    input.isTTY = false;
    const pending = readPassword({ input, output: new PassThrough() });
    input.end();

    await assert.rejects(pending, /Nenhuma senha/);
});

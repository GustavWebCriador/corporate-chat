require("dotenv").config();

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const backendPath = path.resolve(__dirname, "..");
const projectPath = path.resolve(backendPath, "..");
const evidenceDirectory = path.join(
    projectPath,
    "docs",
    "persistence",
    "evidence"
);
const evidenceFile = path.join(
    evidenceDirectory,
    "latest.md"
);

function stripAnsi(value = "") {
    return value.replace(
        /\x1B\[[0-?]*[ -/]*[@-~]/g,
        ""
    );
}

function execute(title, command) {
    console.log("");
    console.log(`> ${command}`);

    const result = spawnSync(
        command,
        {
            cwd: backendPath,
            shell: true,
            encoding: "utf8",
            env: process.env,
        }
    );

    const stdout = stripAnsi(result.stdout || "");
    const stderr = stripAnsi(result.stderr || "");

    if (stdout) {
        process.stdout.write(stdout);
    }

    if (stderr) {
        process.stderr.write(stderr);
    }

    return {
        title,
        command,
        status: result.status ?? 1,
        output: [stdout, stderr]
            .filter(Boolean)
            .join("\n"),
    };
}

async function main() {
    if (process.env.NODE_ENV !== "development") {
        console.error(
            "Evidence collection is allowed only in development."
        );
        process.exit(1);
    }

    fs.mkdirSync(
        evidenceDirectory,
        { recursive: true }
    );

    const checks = [
        ["Node.js", "node --version"],
        ["npm", "npm --version"],
        ["Docker Compose", "docker compose version"],
        ["Git branch", "git branch --show-current"],
        ["Git commit", "git rev-parse --short HEAD"],
        [
            "Containers",
            'docker compose --env-file ".env" -f "../docker-compose.yml" ps',
        ],
        ["Migrations", "npm run db:migrate:status"],
        ["Development seed", "npm run seed:verify"],
        [
            "Cross-database integrity",
            "npm run integration:verify",
        ],
        ["Critical queries", "npm run queries:verify"],
        ["Automated tests", "npm test"],
    ];

    const results = [];

    for (const [title, command] of checks) {
        results.push(
            execute(title, command)
        );
    }

    const generatedAt = new Date().toISOString();

    let markdown =
        "# Evidência Automatizada — Persistência\n\n";

    markdown +=
        `Gerada em: \`${generatedAt}\`\n\n`;

    for (const result of results) {
        markdown += `## ${result.title}\n\n`;
        markdown += "Comando:\n\n```text\n";
        markdown += result.command;
        markdown += "\n```\n\n";
        markdown += `Exit code: \`${result.status}\`\n\n`;
        markdown += "```text\n";
        markdown += result.output || "(sem saída)";
        markdown += "\n```\n\n";
    }

    const failed = results.filter(
        result => result.status !== 0
    );

    markdown += "## Resultado final\n\n";

    if (failed.length === 0) {
        markdown +=
            "✅ Todas as verificações foram concluídas com sucesso.\n";
    } else {
        markdown +=
            `❌ ${failed.length} verificação(ões) falharam.\n`;
    }

    fs.writeFileSync(
        evidenceFile,
        markdown,
        "utf8"
    );

    console.log("");
    console.log(
        `Evidence written to: ${evidenceFile}`
    );

    if (failed.length > 0) {
        process.exit(1);
    }
}

main();

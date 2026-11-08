# Corporate Chat - BE-18 - Conferencia dos IDs apos restauracao automatizada
# Uso exclusivo do fixture BE-18 com dados sinteticos.
# Nao modifica documentos ou tabelas. Copia apenas um script temporario para os containers.

param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^corporate-chat-be18-fixture-[0-9]{14}$')]
    [string]$SourceProject,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^corporate-chat-be18-restore-[0-9]{14}-[a-f0-9]{8}$')]
    [string]$RestoreProject
)

$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo

$fixtureProject = $SourceProject
$verifyProject  = $RestoreProject

function Get-Be18ContainerId {
    param([string]$Project, [string]$Service)

    $argsCompose = @(
        'compose', '-p', $Project,
        '--env-file', '.\deploy\.env',
        '-f', '.\docker-compose.deploy.yml',
        'ps', '-q', $Service
    )

    $id = docker @argsCompose
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($id)) {
        throw "Container $Service nao encontrado no projeto $Project."
    }
    return $id.Trim()
}

$fixturePgId = Get-Be18ContainerId $fixtureProject 'postgres'
$fixtureMongoId = Get-Be18ContainerId $fixtureProject 'mongodb'
$verifyPgId = Get-Be18ContainerId $verifyProject 'postgres'
$verifyMongoId = Get-Be18ContainerId $verifyProject 'mongodb'

# Verifica os IDs de todos os registros relacionais, nao somente as contagens.
$sql = @'
SELECT 'USER:' || user_id::text AS key FROM users
UNION ALL
SELECT 'REQUEST:' || request_id::text FROM registration_requests
UNION ALL
SELECT 'SESSION:' || session_id::text FROM auth_sessions
ORDER BY key;
'@

function Get-PgKeys {
    param([string]$ContainerId)
    $keys = @($sql | docker exec -i $ContainerId sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -A -t -v ON_ERROR_STOP=1 -f -')
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao consultar IDs PostgreSQL do container $ContainerId."
    }
    return $keys
}

$pgSourceKeys = @(Get-PgKeys $fixturePgId)
$pgRestoreKeys = @(Get-PgKeys $verifyPgId)

if ($pgSourceKeys.Count -ne 4 -or $pgRestoreKeys.Count -ne 4) {
    throw 'Quantidade inesperada de identificadores PostgreSQL.'
}
if (($pgSourceKeys -join '|') -cne ($pgRestoreKeys -join '|')) {
    throw 'Os identificadores PostgreSQL diferem entre origem e restauracao.'
}
Write-Host '[OK] PostgreSQL: 2 usuarios, 1 solicitacao e 1 sessao preservaram seus UUIDs.'

# A mesma consulta MongoDB e executada nos containers de origem e restauracao.
# Criar um arquivo evita erros do PSReadLine e de escape de aspas no --eval.
$mongoScript = @'
const conversation = db.conversations.findOne({ name: "BE18 Restore Test" });
if (!conversation) throw new Error("Conversa de teste ausente");

const members = db.conversation_members.find({ conversation_id: conversation._id })
    .sort({ user_id: 1 }).toArray();
const messages = db.messages.find({ conversation_id: conversation._id }).toArray();

if (db.conversations.countDocuments({}) !== 1 || members.length !== 2 || messages.length !== 1) {
    throw new Error("Quantidade de documentos MongoDB incorreta");
}

const message = messages[0];
if (!conversation.last_message_id || !conversation.last_message_id.equals(message._id)) {
    throw new Error("Ultima mensagem nao esta vinculada a conversa");
}
if (!message.client_message_id || message.content !== "BE18 - mensagem de teste de recuperacao") {
    throw new Error("Mensagem incompleta ou alterada");
}

print(JSON.stringify({
    conversationId: conversation._id.toHexString(),
    createdBy: conversation.created_by,
    members: members.map(m => ({ userId: m.user_id, role: m.role })),
    messageId: message._id.toHexString(),
    senderId: message.sender_id,
    clientMessageId: message.client_message_id,
    content: message.content
}));
'@

$tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("be18-mongo-check-" + $PID + '.js')
[System.IO.File]::WriteAllText($tempFile, $mongoScript, [System.Text.UTF8Encoding]::new($false))

try {
    function Get-MongoSummary {
        param([string]$ContainerId)

        docker cp $tempFile "${ContainerId}:/tmp/be18-verify-restore.js" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw 'Falha ao copiar o verificador MongoDB.'
        }

        $output = @(docker exec $ContainerId sh -c 'mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_INITDB_DATABASE" --file /tmp/be18-verify-restore.js')
        if ($LASTEXITCODE -ne 0) {
            throw 'Falha ao executar a verificacao MongoDB.'
        }
        return ($output -join "`n").Trim()
    }

    $mongoSourceJson = Get-MongoSummary $fixtureMongoId
    $mongoRestoreJson = Get-MongoSummary $verifyMongoId

    if ($mongoSourceJson -cne $mongoRestoreJson) {
        throw 'Os identificadores ou o conteudo dos documentos MongoDB diferem da origem.'
    }

    $restoredMongo = $mongoRestoreJson | ConvertFrom-Json
    Write-Host '[OK] MongoDB: ObjectIds, participantes, remetente e conteudo preservados.'

    # Verifica referencias logicas do MongoDB contra os usuarios PostgreSQL restaurados.
    $pgUserIds = @(
        $pgRestoreKeys |
        Where-Object { $_.StartsWith('USER:') } |
        ForEach-Object { $_.Substring(5) }
    )
    $linkedUserIds = @($restoredMongo.createdBy, $restoredMongo.senderId) + @(
        $restoredMongo.members | ForEach-Object { $_.userId }
    )

    foreach ($userId in ($linkedUserIds | Sort-Object -Unique)) {
        if ($userId -notin $pgUserIds) {
            throw "UUID MongoDB sem usuario correspondente no PostgreSQL restaurado: $userId"
        }
    }

    Write-Host '[OK] Integridade PostgreSQL <-> MongoDB: todos os UUIDs vinculados existem.'
    Write-Host '[OK] BE-18: restauracao com dados nao vazios verificada.'
} finally {
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
}

# Corporate Chat - BE-18 - Restauracao isolada de PostgreSQL e MongoDB
# Apenas para verificacao/local: cria um novo projeto Docker Compose, sem alterar ambientes existentes.
# Nao use em producao sem um procedimento operacional aprovado.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ManifestPath,

    [string]$ProjectName = (
        'corporate-chat-be18-restore-' +
        (Get-Date -Format 'yyyyMMddHHmmss') + '-' +
        ([guid]::NewGuid().ToString('N')).Substring(0, 8)
    )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-NativeExit {
    param([string]$Step)
    if ($LASTEXITCODE -ne 0) {
        throw "$Step falhou (codigo $LASTEXITCODE)."
    }
}

if ($ProjectName -notmatch '^corporate-chat-be18-restore-[0-9]{14}-[a-f0-9]{8}$') {
    throw 'O nome de projeto deve seguir corporate-chat-be18-restore-AAAAMMDDHHMMSS-xxxxxxxx.'
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$envFile = Join-Path $root 'deploy\.env'
$composeFile = Join-Path $root 'docker-compose.deploy.yml'
$backupsDir = Join-Path $root 'deploy\backups'

foreach ($file in @($envFile, $composeFile)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Arquivo necessario nao encontrado: $file"
    }
}
if (-not (Test-Path -LiteralPath $backupsDir -PathType Container)) {
    throw 'Diretorio deploy/backups nao encontrado.'
}

$manifestFile = Get-Item -LiteralPath $ManifestPath -ErrorAction Stop
$resolvedBackupsDir = (Resolve-Path -LiteralPath $backupsDir).Path
if (-not [string]::Equals($manifestFile.DirectoryName, $resolvedBackupsDir, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'O manifesto precisa estar diretamente em deploy/backups.'
}

$manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.version -ne 1 -or -not $manifest.postgres -or -not $manifest.mongodb) {
    throw 'Formato do manifesto nao reconhecido.'
}
if ($manifest.project -notmatch '^corporate-chat-(deploy|be18-fixture-[0-9]{14}|be18-verify-[0-9]{14})$') {
    throw 'Projeto de origem do manifesto nao reconhecido.'
}
if ($manifest.postgres.file -notmatch '^[A-Za-z0-9_.-]+-postgres\.dump$') {
    throw 'Nome de dump PostgreSQL invalido no manifesto.'
}
if ($manifest.mongodb.file -notmatch '^[A-Za-z0-9_.-]+-mongodb\.archive\.gz$') {
    throw 'Nome de dump MongoDB invalido no manifesto.'
}

$pgLocal = Join-Path $backupsDir $manifest.postgres.file
$mongoLocal = Join-Path $backupsDir $manifest.mongodb.file
foreach ($entry in @(
    @{ Path = $pgLocal; Info = $manifest.postgres; Label = 'PostgreSQL' },
    @{ Path = $mongoLocal; Info = $manifest.mongodb; Label = 'MongoDB' }
)) {
    $fileInfo = Get-Item -LiteralPath $entry.Path -ErrorAction Stop
    if ($fileInfo.Length -le 0 -or $fileInfo.Length -ne [int64]$entry.Info.bytes) {
        throw "$($entry.Label): tamanho do arquivo diferente do manifesto."
    }
    $actualSha = (Get-FileHash -LiteralPath $entry.Path -Algorithm SHA256).Hash
    if ($actualSha -ine $entry.Info.sha256) {
        throw "$($entry.Label): SHA-256 diferente do manifesto."
    }
}
Write-Host '[OK] Integridade SHA-256 e tamanhos dos dois backups confirmados.'

$composeArgs = @('compose', '-p', $ProjectName, '--env-file', $envFile, '-f', $composeFile)
& docker @composeArgs config --quiet
Assert-NativeExit 'Validacao da configuracao Compose'

# Bloqueio de seguranca: nunca restaura sobre projeto preexistente.
$oldContainers = (& docker ps -a --filter "label=com.docker.compose.project=$ProjectName" --format '{{.ID}}' | Out-String).Trim()
Assert-NativeExit 'Inspecao de containers existentes'
$oldVolumes = (& docker volume ls --filter "label=com.docker.compose.project=$ProjectName" --format '{{.Name}}' | Out-String).Trim()
Assert-NativeExit 'Inspecao de volumes existentes'
$oldNetworks = (& docker network ls --filter "label=com.docker.compose.project=$ProjectName" --format '{{.ID}}' | Out-String).Trim()
Assert-NativeExit 'Inspecao de redes existentes'
if ($oldContainers -or $oldVolumes -or $oldNetworks) {
    throw "O projeto $ProjectName ja possui recursos Docker. Nenhuma restauracao foi iniciada."
}

Write-Host "[BE-18] Origem do backup: $($manifest.project)"
Write-Host "[BE-18] Destino isolado: $ProjectName"
Write-Host '[BE-18] Iniciando somente PostgreSQL e MongoDB em volumes novos.'

& docker @composeArgs up -d --wait postgres mongodb
Assert-NativeExit 'Inicializacao dos bancos de restauracao'

$pgId = (& docker @composeArgs ps -q postgres | Out-String).Trim()
Assert-NativeExit 'Identificacao PostgreSQL'
$mongoId = (& docker @composeArgs ps -q mongodb | Out-String).Trim()
Assert-NativeExit 'Identificacao MongoDB'
if ([string]::IsNullOrWhiteSpace($pgId) -or [string]::IsNullOrWhiteSpace($mongoId)) {
    throw 'Containers de restauracao nao encontrados.'
}

$pgTemp = '/tmp/be18-' + $ProjectName + '.dump'
$mongoTemp = '/tmp/be18-' + $ProjectName + '.archive.gz'
try {
    & docker cp $pgLocal "${pgId}:$pgTemp"
    Assert-NativeExit 'Copia do dump PostgreSQL'

    & docker exec $pgId pg_restore --list $pgTemp | Out-Null
    Assert-NativeExit 'Leitura do dump PostgreSQL'

    $pgCommand = 'pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB" ' + $pgTemp
    & docker exec $pgId sh -c $pgCommand
    Assert-NativeExit 'Restauracao PostgreSQL'

    & docker cp $mongoLocal "${mongoId}:$mongoTemp"
    Assert-NativeExit 'Copia do dump MongoDB'

    $mongoCommand = 'mongorestore --host 127.0.0.1 --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --gzip --archive=' + $mongoTemp + ' --nsInclude="$MONGO_INITDB_DATABASE.*" --stopOnError'
    & docker exec $mongoId sh -c $mongoCommand
    Assert-NativeExit 'Restauracao MongoDB'

    $pgSql = @'
SELECT 'users|' || COUNT(*) FROM users
UNION ALL SELECT 'registration_requests|' || COUNT(*) FROM registration_requests
UNION ALL SELECT 'auth_sessions|' || COUNT(*) FROM auth_sessions
UNION ALL SELECT 'migrations|' || COUNT(*) FROM "SequelizeMeta";
'@
    $pgCounts = @($pgSql | & docker exec -i $pgId sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -A -t -v ON_ERROR_STOP=1 -f -')
    Assert-NativeExit 'Consulta de contagens PostgreSQL'
    $pgLines = @($pgCounts | Where-Object { $_ -match '^(users|registration_requests|auth_sessions|migrations)\|[0-9]+$' })
    if ($pgLines.Count -ne 4) {
        throw 'Resposta de contagens PostgreSQL inesperada.'
    }
    Write-Host "[OK] PostgreSQL: $($pgLines -join ', ')"

    $mongoJs = @'
print('BE18_COUNTS|' + [
    db.conversations.countDocuments({}),
    db.conversation_members.countDocuments({}),
    db.messages.countDocuments({})
].join('|'));
'@
    $mongoOutput = @($mongoJs | & docker exec -i $mongoId sh -c 'mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_INITDB_DATABASE"')
    Assert-NativeExit 'Consulta de contagens MongoDB'
    $mongoLine = @($mongoOutput | Where-Object { $_ -match 'BE18_COUNTS\|[0-9]+\|[0-9]+\|[0-9]+' } | Select-Object -Last 1)
    if ($mongoLine.Count -ne 1) {
        throw 'Resposta de contagens MongoDB inesperada.'
    }
    Write-Host "[OK] MongoDB: $($mongoLine[0])"

    Write-Host '[OK] Restauracao isolada concluida. Os volumes e containers foram preservados.' -ForegroundColor Green
    Write-Host "[BE-18] Projeto restaurado: $ProjectName"
    Write-Host '[BE-18] Compare os IDs e relacionamentos com verify-be18-restore.ps1.'
}
finally {
    # Remove apenas as COPIAS temporarias internas, nunca os backups locais.
    try { & docker exec $pgId rm -f $pgTemp 2>$null | Out-Null } catch { }
    try { & docker exec $mongoId rm -f $mongoTemp 2>$null | Out-Null } catch { }
}

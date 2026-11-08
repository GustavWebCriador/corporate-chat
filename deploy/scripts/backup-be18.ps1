# Corporate Chat - BE-18 - Backup PostgreSQL e MongoDB
# Execucao a partir da raiz OU de outro diretorio: o script descobre o repositorio.
# Exemplo: .\deploy\scripts\backup-be18.ps1 -ProjectName 'corporate-chat-be18-fixture-20261108110151'
# Nao encerra containers, nao altera dados e nao remove volumes.

param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^corporate-chat-(deploy|be18-fixture-[0-9]{14}|be18-verify-[0-9]{14})$')]
    [string]$ProjectName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-Exit {
    param([string]$Stage)
    if ($LASTEXITCODE -ne 0) {
        throw "$Stage falhou (codigo $LASTEXITCODE)."
    }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$envFile = Join-Path $root 'deploy\.env'
$composeFile = Join-Path $root 'docker-compose.deploy.yml'
$outputDir = Join-Path $root 'deploy\backups'

if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw 'Arquivo deploy/.env nao encontrado.'
}
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw 'Arquivo docker-compose.deploy.yml nao encontrado.'
}

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

# Os backups nao podem ser adicionados ao Git por acidente.
& git -C $root check-ignore --no-index --quiet -- 'deploy/backups/be18-check.tmp'
if ($LASTEXITCODE -ne 0) {
    throw 'Adicione /deploy/backups/ ao .gitignore antes de continuar.'
}

$composeArgs = @(
    'compose', '-p', $ProjectName,
    '--env-file', $envFile,
    '-f', $composeFile
)

& docker @composeArgs config --quiet
Assert-Exit 'Validacao Docker Compose'

$pgId = (& docker @composeArgs ps -q postgres | Out-String).Trim()
Assert-Exit 'Consulta PostgreSQL'
$mongoId = (& docker @composeArgs ps -q mongodb | Out-String).Trim()
Assert-Exit 'Consulta MongoDB'

if ([string]::IsNullOrWhiteSpace($pgId) -or [string]::IsNullOrWhiteSpace($mongoId)) {
    throw 'Os dois containers precisam estar em execucao no projeto selecionado.'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$nonce = ([guid]::NewGuid().ToString('N')).Substring(0, 8)
$baseName = "be18-$ProjectName-$stamp-$nonce"
$pgTemp = "/tmp/$baseName.dump"
$mongoTemp = "/tmp/$baseName.archive.gz"
$pgLocal = Join-Path $outputDir "$baseName-postgres.dump"
$mongoLocal = Join-Path $outputDir "$baseName-mongodb.archive.gz"
$manifestLocal = Join-Path $outputDir "$baseName.manifest.json"
$success = $false

try {
    Write-Host "[BE-18] Projeto selecionado: $ProjectName"
    Write-Host '[BE-18] Este backup e sequencial; evite gravacoes simultaneas nos dois bancos.'

    # As variaveis entre aspas sao expandidas DENTRO do container.
    $pgCmd = 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f ' + $pgTemp
    & docker exec $pgId sh -c $pgCmd
    Assert-Exit 'pg_dump'

    & docker exec $pgId pg_restore --list $pgTemp | Out-Null
    Assert-Exit 'Validacao do dump PostgreSQL'

    & docker cp "${pgId}:$pgTemp" $pgLocal
    Assert-Exit 'Copia do dump PostgreSQL'

    $mongoCmd = 'mongodump --host 127.0.0.1 --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db "$MONGO_INITDB_DATABASE" --gzip --archive=' + $mongoTemp
    & docker exec $mongoId sh -c $mongoCmd
    Assert-Exit 'mongodump'

    & docker cp "${mongoId}:$mongoTemp" $mongoLocal
    Assert-Exit 'Copia do dump MongoDB'

    $pgInfo = Get-Item -LiteralPath $pgLocal
    $mongoInfo = Get-Item -LiteralPath $mongoLocal
    if ($pgInfo.Length -le 0 -or $mongoInfo.Length -le 0) {
        throw 'Arquivo de backup vazio.'
    }

    $manifest = [ordered]@{
        version = 1
        project = $ProjectName
        createdAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        consistency = 'sequencial; realizar sem escritas concorrentes'
        postgres = [ordered]@{
            file = $pgInfo.Name
            bytes = $pgInfo.Length
            sha256 = (Get-FileHash -LiteralPath $pgLocal -Algorithm SHA256).Hash
        }
        mongodb = [ordered]@{
            file = $mongoInfo.Name
            bytes = $mongoInfo.Length
            sha256 = (Get-FileHash -LiteralPath $mongoLocal -Algorithm SHA256).Hash
        }
    }

    $json = $manifest | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText(
        $manifestLocal,
        $json,
        [System.Text.UTF8Encoding]::new($false)
    )

    $success = $true
    Write-Host '[OK] Backup concluido.' -ForegroundColor Green
    Write-Host "PostgreSQL: $pgLocal ($($pgInfo.Length) bytes)"
    Write-Host "MongoDB:    $mongoLocal ($($mongoInfo.Length) bytes)"
    Write-Host "Manifesto:  $manifestLocal"
}
finally {
    # Apagar somente os arquivos temporarios criados por esta execucao.
    & docker exec $pgId rm -f $pgTemp 2>$null | Out-Null
    & docker exec $mongoId rm -f $mongoTemp 2>$null | Out-Null

    if (-not $success) {
        foreach ($item in @($pgLocal, $mongoLocal, $manifestLocal)) {
            if (Test-Path -LiteralPath $item) {
                Remove-Item -LiteralPath $item -Force
            }
        }
        Write-Warning 'Backup incompleto: arquivos locais parciais foram excluidos.'
    }
}

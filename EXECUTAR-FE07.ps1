param(
    [string]$RepoRoot = (Get-Location).Path,
    [string]$BackendUrl = 'http://127.0.0.1:3000',
    [switch]$PularTestesFrontend
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath $RepoRoot).Path
if (-not (Test-Path -LiteralPath (Join-Path $repo 'frontend\scripts\fe07-live.mjs'))) {
    throw 'Arquivos FE-07 não encontrados. Execute primeiro APLICAR-FE07.ps1.'
}
if ($BackendUrl -notmatch '^http://(127\.0\.0\.1|localhost)(:\d+)?/?$') {
    throw 'FE-07 só pode atingir backend HTTP local (localhost/127.0.0.1).'
}
Write-Host ''
Write-Host 'FE-07 executa testes integrados e CRIA DADOS DE TESTE no PostgreSQL/MongoDB local.' -ForegroundColor Yellow
$confirm = Read-Host 'Confirma que o backend usa SOMENTE a base local de desenvolvimento? Digite SIM'
if ($confirm -cne 'SIM') { throw 'Execução cancelada.' }

$hadPassword = Test-Path Env:FE07_DEV_PASSWORD
if (-not $hadPassword) {
    $securePassword = Read-Host 'Senha DEV_SEED_PASSWORD (não será mostrada)' -AsSecureString
    $credential = New-Object System.Management.Automation.PSCredential('fe07', $securePassword)
    $env:FE07_DEV_PASSWORD = $credential.GetNetworkCredential().Password
}
$env:FE07_ALLOW_LOCAL_WRITES = 'SIM'
$env:FE07_BACKEND_URL = $BackendUrl

function Run-Checked([string] $label, [scriptblock] $command) {
    Write-Host "`n>>> $label" -ForegroundColor Cyan
    & $command
    if ($LASTEXITCODE -ne 0) { throw "Falha em: $label (exit $LASTEXITCODE)" }
}

Push-Location $repo
try {
    if (-not $PularTestesFrontend) {
        Run-Checked 'Frontend - todos os testes Vitest' { npm --prefix frontend test }
        Run-Checked 'Frontend - ESLint' { npm --prefix frontend run lint }
        Run-Checked 'Frontend - build Vite' { npm --prefix frontend run build }
    }
    Run-Checked 'FE-07 - backend e Socket.IO reais' { node frontend/scripts/fe07-live.mjs }
    Write-Host "`nFE-07: verificações automatizadas concluídas com sucesso." -ForegroundColor Green
} finally {
    Pop-Location
    Remove-Item Env:FE07_ALLOW_LOCAL_WRITES -ErrorAction SilentlyContinue
    Remove-Item Env:FE07_BACKEND_URL -ErrorAction SilentlyContinue
    if (-not $hadPassword) {
        Remove-Item Env:FE07_DEV_PASSWORD -ErrorAction SilentlyContinue
    }
}
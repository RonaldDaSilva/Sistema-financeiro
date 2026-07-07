$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $root "backend\SistemaFinanceiro.Api"
$logPath = Join-Path $root "backend-api.log"

$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:ASPNETCORE_URLS = "http://localhost:5000"

Set-Location $backendPath
dotnet run --no-launch-profile --no-restore *> $logPath

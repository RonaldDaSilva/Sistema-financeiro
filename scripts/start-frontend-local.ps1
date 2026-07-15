$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $root "frontend"
$logPath = Join-Path $root "frontend-vite.log"

Set-Location $frontendPath
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --force *> $logPath

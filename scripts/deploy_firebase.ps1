$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$buildScript = Join-Path $root "build_all.ps1"

Write-Host "Building all modules..."
& $buildScript
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

Write-Host "Deploying to Firebase Hosting..."
firebase deploy --only "hosting" --project crossmanager-482403
if ($LASTEXITCODE -ne 0) { throw "Firebase deploy failed." }

Write-Host "Deploy complete."

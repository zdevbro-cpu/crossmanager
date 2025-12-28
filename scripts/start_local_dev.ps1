$root = Split-Path -Parent $PSScriptRoot
$proxy = Join-Path $root "cloud-sql-proxy.exe"
$svcKey = Join-Path $root "server\\serviceAccountKey.json"
$serverDir = Join-Path $root "server"

if (-not (Test-Path $proxy)) {
    Write-Error "cloud-sql-proxy.exe not found at $proxy"
    exit 1
}

if (-not (Test-Path $svcKey)) {
    Write-Error "serviceAccountKey.json not found at $svcKey"
    exit 1
}

Start-Process -FilePath $proxy -WorkingDirectory $root -ArgumentList @(
    "crossmanager-482403:asia-northeast3:crossmanager",
    "--port", "5432",
    "--credentials-file", $svcKey
)

Start-Sleep -Seconds 2

Start-Process -FilePath "node" -WorkingDirectory $serverDir -ArgumentList @("index.js")

Write-Host "Started Cloud SQL Auth Proxy and server. Close the opened windows to stop."

$port = 3007
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($connections) {
    foreach ($conn in $connections) {
        $pid_to_kill = $conn.OwningProcess
        Write-Host "Killing process $pid_to_kill on port $port"
        Stop-Process -Id $pid_to_kill -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "No process found on port $port"
}
Start-Sleep -Seconds 2
node index.js

# PowerShell script to start the .NET backend and the Vite frontend.
# Usage: .\start-all.ps1

$backendPath  = Join-Path $PSScriptRoot 'backend-new\NewsConsole.Api'
$frontendPath = Join-Path $PSScriptRoot 'frontend'

# Stop any process currently occupying port 5000 (backend) or 3000 (frontend)
foreach ($port in @(5000, 3000)) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $procId   = ($conn | Select-Object -First 1).OwningProcess
        $parentId = (Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction SilentlyContinue).ParentProcessId
        Write-Host "Stopping process on port $port (PID $procId, parent PID $parentId)..."
        Stop-Process -Id $procId   -Force -ErrorAction SilentlyContinue
        if ($parentId) {
            Stop-Process -Id $parentId -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "Starting .NET backend..."
$backendCmd = "cd `"$backendPath`"; dotnet clean; dotnet restore --force; dotnet run"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal

Write-Host "Installing frontend npm dependencies..."
Push-Location $frontendPath
npm install
Pop-Location

Write-Host "Starting frontend (Vite dev server)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$frontendPath`"; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Both services are starting in new terminals."
Write-Host "  Backend  : http://localhost:5000/api/health"
Write-Host "  Frontend : http://localhost:3000"

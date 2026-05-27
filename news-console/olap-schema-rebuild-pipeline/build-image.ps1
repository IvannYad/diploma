# PowerShell script to build the OLAP schema rebuild Docker image.
# Usage:
#   .\build-image.ps1
#   .\build-image.ps1 -Tag latest
#   .\build-image.ps1 -ImageName olap-schema-rebuild-pipeline -Tag latest -NoCache

param(
    [string]$ImageName = "olap-schema-rebuild-pipeline",
    [string]$Tag = "latest",
    [switch]$NoCache
)

$scriptDir = $PSScriptRoot
if (-not $scriptDir) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$imageRef = "$ImageName`:$Tag"

Write-Host "Building Docker image: $imageRef"
Write-Host "Context: $scriptDir"

Push-Location $scriptDir
try {
    $args = @("build", "-t", $imageRef)
    if ($NoCache) {
        $args += "--no-cache"
    }
    $args += "."

    & docker @args
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed with exit code $LASTEXITCODE."
    }

    Write-Host "Docker image built successfully: $imageRef" -ForegroundColor Green
}
finally {
    Pop-Location
}

# =============================================================================
# Build psycopg2 Lambda Layer (PowerShell)
# =============================================================================
# This script builds a psycopg2 Lambda layer compatible with Python 3.11
# runtime using Docker to ensure compatibility with AWS Lambda environment.
#
# Usage: .\build-layer.ps1
# Output: layers\psycopg2-layer.zip
# =============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LayersDir = Join-Path $ScriptDir "layers"
$PythonDir = Join-Path $LayersDir "python"

Write-Host "[INFO] Building psycopg2 Lambda layer..." -ForegroundColor Cyan
Write-Host "[INFO] Script directory: $ScriptDir" -ForegroundColor Cyan

# Cleanup previous builds
if (Test-Path $LayersDir) {
    Write-Host "[INFO] Cleaning up previous build artifacts..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $LayersDir
}

# Create directories
New-Item -ItemType Directory -Force -Path $PythonDir | Out-Null

Write-Host "[INFO] Installing psycopg2-binary using Docker..." -ForegroundColor Cyan

# Use AWS Lambda Python 3.11 runtime container to build layer
# Convert Windows path to Unix-style for Docker
$LayersDirUnix = $LayersDir -replace '\\', '/' -replace '^([A-Z]):', '/$1' -replace '^/([A-Z])/', '/\L$1/'

$dockerCmd = "docker run --rm -v `"${LayersDir}:/out`" public.ecr.aws/lambda/python:3.11 /bin/bash -c `"pip install psycopg2-binary -t /out/python && chmod -R 755 /out`""

Write-Host "[DEBUG] Running: $dockerCmd" -ForegroundColor Gray

try {
    # Run docker command
    docker run --rm `
        -v "${LayersDir}:/out" `
        public.ecr.aws/lambda/python:3.11 `
        /bin/bash -c "pip install psycopg2-binary -t /out/python && chmod -R 755 /out"

    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "[ERROR] Failed to install psycopg2-binary: $_" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Creating layer zip archive..." -ForegroundColor Cyan

# Create zip using PowerShell (Compress-Archive)
$ZipPath = Join-Path $LayersDir "psycopg2-layer.zip"
Set-Location $LayersDir

try {
    # PowerShell Compress-Archive
    Compress-Archive -Path "python" -DestinationPath $ZipPath -Force

    # Verify zip was created
    if (-not (Test-Path $ZipPath)) {
        throw "Zip file was not created"
    }

    # Get zip size
    $ZipSize = (Get-Item $ZipPath).Length
    $ZipSizeMB = [math]::Round($ZipSize / 1MB, 2)

    Write-Host "[OK] Layer built successfully: $ZipPath ($ZipSizeMB MB)" -ForegroundColor Green

} catch {
    Write-Host "[ERROR] Failed to create zip archive: $_" -ForegroundColor Red
    exit 1
}

# Cleanup python directory
Write-Host "[INFO] Cleaning up temporary files..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $PythonDir

Write-Host "[OK] Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Verify layer exists: Get-Item $ZipPath" -ForegroundColor White
Write-Host "2. Deploy with Terraform: terraform apply" -ForegroundColor White
Write-Host ""

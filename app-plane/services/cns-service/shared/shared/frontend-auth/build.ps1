# PowerShell build script for @components-platform/frontend-auth
$ErrorActionPreference = "Stop"

Write-Host "🔧 Building @components-platform/frontend-auth package..." -ForegroundColor Cyan

# Navigate to package directory
Set-Location $PSScriptRoot

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
  Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
  npm install
}

# Build TypeScript
Write-Host "🏗️  Compiling TypeScript..." -ForegroundColor Yellow
npm run build

# Create tarball
Write-Host "📦 Creating tarball..." -ForegroundColor Yellow
npm pack

# Get the generated tarball name
$tarball = Get-ChildItem -Filter "components-platform-frontend-auth-*.tgz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $tarball) {
  Write-Host "❌ Error: Tarball not created" -ForegroundColor Red
  exit 1
}

Write-Host "✅ Package built successfully: $($tarball.Name)" -ForegroundColor Green
Write-Host ""
Write-Host "To use in dashboards, ensure they reference:" -ForegroundColor Cyan
Write-Host "  `"@components-platform/frontend-auth`": `"file:../../shared/frontend-auth/$($tarball.Name)`"" -ForegroundColor White
Write-Host ""
Write-Host "Run 'npm install' in each dashboard to update the package." -ForegroundColor Yellow

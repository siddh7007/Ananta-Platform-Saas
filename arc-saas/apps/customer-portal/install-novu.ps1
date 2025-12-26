# Novu Notification Center Installation Script (PowerShell)
# Run from: arc-saas\apps\customer-portal

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Installing Novu Notification Center" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "Error: package.json not found" -ForegroundColor Red
    Write-Host "Please run this script from arc-saas\apps\customer-portal" -ForegroundColor Red
    exit 1
}

# Check for bun or npm
$bunExists = Get-Command bun -ErrorAction SilentlyContinue
$npmExists = Get-Command npm -ErrorAction SilentlyContinue

if ($bunExists) {
    Write-Host "Using Bun package manager..." -ForegroundColor Green
    bun add @novu/notification-center
} elseif ($npmExists) {
    Write-Host "Using npm package manager..." -ForegroundColor Green
    npm install @novu/notification-center
} else {
    Write-Host "Error: Neither bun nor npm found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy .env.example to .env (if not already done)"
Write-Host "2. Ensure Novu services are running (docker-compose up -d)"
Write-Host "3. Start the dev server: bun run dev"
Write-Host "4. Look for the bell icon in the header"
Write-Host ""
Write-Host "See NOVU_SETUP.md for detailed instructions" -ForegroundColor Cyan
Write-Host ""

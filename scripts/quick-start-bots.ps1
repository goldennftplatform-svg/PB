# PEPEBALL Bot Testing - Quick Start (PowerShell)
Write-Host "🤖 PEPEBALL Bot Testing - Quick Start" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if Solana CLI is installed
$solanaCheck = Get-Command solana -ErrorAction SilentlyContinue
if (-not $solanaCheck) {
    Write-Host "❌ Solana CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

# Create wallets
Write-Host "Step 1: Creating bot wallets..." -ForegroundColor Yellow
node scripts/create-bot-wallets.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create wallets" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Funding bot wallets with devnet SOL..." -ForegroundColor Yellow
Write-Host "⚠️  This may take a few minutes due to rate limits..." -ForegroundColor Yellow
node scripts/fund-bot-wallets.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Some bots may not have been funded. You can run this again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 3: Ready to run bots!" -ForegroundColor Green
Write-Host ""
Write-Host "To run all bots:" -ForegroundColor Cyan
Write-Host "  node scripts/run-all-bots.js" -ForegroundColor White
Write-Host ""
Write-Host "To run a single bot:" -ForegroundColor Cyan
Write-Host "  node scripts/bot-trader.js 1" -ForegroundColor White
Write-Host ""




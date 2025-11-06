# PEPEBALL Devnet Deployment (PowerShell)
# Usage: Right-click -> Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File .\deploy-devnet.ps1

param(
    [string]$AnchorPath = "anchor",
    [string]$SolanaPath = "solana",
    [string]$Cluster = "devnet"
)

function Fail($msg) { Write-Error $msg; exit 1 }

Write-Host "🐸 PEPEBALL Devnet Deployment Starting..." -ForegroundColor Green

# 1) Check Solana CLI
Write-Host "Checking Solana CLI..."
$solanaVersion = & $SolanaPath --version 2>$null
if (-not $solanaVersion) { Fail "Solana CLI not found. Install from https://docs.solana.com/cli/install-solana-cli-tools" }
Write-Host "Solana CLI:" $solanaVersion

# 2) Check Anchor
Write-Host "Checking Anchor..."
$anchorVersion = & $AnchorPath --version 2>$null
if (-not $anchorVersion) { Fail "Anchor not found. Install with: npm install -g @coral-xyz/anchor-cli" }
Write-Host "Anchor:" $anchorVersion

# 3) Configure cluster
Write-Host "Setting Solana cluster to" $Cluster "..."
& $SolanaPath config set --url $Cluster | Out-Host
& $SolanaPath config get | Out-Host

# 4) Ensure some devnet SOL
Write-Host "Checking balance..."
$balanceRaw = & $SolanaPath balance 2>$null
if (-not $balanceRaw) { Fail "Failed to read wallet balance. Ensure a keypair exists at ~/.config/solana/id.json" }
$balance = [decimal]($balanceRaw -replace '[^0-9\.]','')
Write-Host "Current balance:" $balance "SOL"
if ($balance -lt 1) {
  Write-Host "Low balance, requesting airdrop..."
  & $SolanaPath airdrop 2 | Out-Host
  Start-Sleep -Seconds 5
  & $SolanaPath balance | Out-Host
}

# 5) Build
Write-Host "Building programs (anchor build)..."
& $AnchorPath build | Out-Host
if ($LASTEXITCODE -ne 0) { Fail "anchor build failed" }

# 6) Deploy
Write-Host "Deploying to devnet (anchor deploy --provider.cluster devnet)..."
& $AnchorPath deploy --provider.cluster $Cluster | Tee-Object -Variable DeployOutput | Out-Host
if ($LASTEXITCODE -ne 0) { Fail "anchor deploy failed" }

# 7) Capture program IDs from target/deploy
$deployDir = Join-Path (Get-Location) "target/deploy"
if (-not (Test-Path $deployDir)) { Fail "target/deploy not found after deploy" }

$ids = @{}
Get-ChildItem $deployDir -Filter *.json | ForEach-Object {
  $json = Get-Content $_.FullName -Raw | ConvertFrom-Json
  if ($json -and $json.programId) { $ids[$_.BaseName] = $json.programId }
}

# Save summary
$summaryPath = Join-Path (Get-Location) "DEVNET_DEPLOYMENT_SUMMARY.txt"
"PEPEBALL Devnet Deployment Summary`n===============================`n" | Out-File -Encoding utf8 $summaryPath
(Get-Date).ToString("s") | Out-File -Append -Encoding utf8 $summaryPath
"" | Out-File -Append -Encoding utf8 $summaryPath
foreach ($k in $ids.Keys) { "$k : $($ids[$k])" | Out-File -Append -Encoding utf8 $summaryPath }
"" | Out-File -Append -Encoding utf8 $summaryPath
"Explorer (devnet): https://explorer.solana.com/?cluster=devnet" | Out-File -Append -Encoding utf8 $summaryPath

Write-Host "✅ Deployment complete. Summary written to $summaryPath" -ForegroundColor Green










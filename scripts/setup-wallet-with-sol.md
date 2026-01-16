# Setup Wallet with 125 SOL for Speed Run

## Option 1: Use Existing Wallet (Recommended)

If your 125 SOL is already in a wallet, you can import it:

```bash
# Import your wallet (will prompt for seed phrase)
solana-keygen recover 'prompt://?full-path=/path/to/keypair.json' -o ~/.config/solana/id.json

# Or if you have the keypair JSON file:
cp /path/to/your/wallet.json ~/.config/solana/id.json

# Verify it's set correctly
solana config get
node scripts/check-balance.js
```

## Option 2: Use Custom Wallet Path

If your wallet is in a different location, set the environment variable:

```powershell
# Windows PowerShell
$env:ANCHOR_WALLET="C:\path\to\your\wallet.json"
node scripts/speed-run-100-wallets.js
```

## Option 3: Transfer SOL to Current Wallet

If you want to use your current wallet, transfer the 125 SOL to it:

1. Get your current wallet address:
   ```bash
   node scripts/check-balance.js
   ```

2. Send 125 SOL from your other wallet to that address

3. Verify balance:
   ```bash
   node scripts/check-balance.js
   ```

## Quick Check

Run this to see your current wallet:
```bash
node scripts/check-balance.js
```

This will show:
- Your wallet address
- Current balance
- Whether you have enough SOL

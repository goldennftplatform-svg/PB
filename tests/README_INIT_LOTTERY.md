# Lottery Initialization Test

This test script initializes the lottery contract on devnet.

## Prerequisites

1. **Anchor installed**: `anchor --version`
2. **Solana CLI installed**: `solana --version`
3. **Wallet configured**: `solana config get`
4. **Devnet SOL**: Get from faucet if needed
5. **Program deployed**: Run `anchor build && anchor deploy --provider.cluster devnet`

## Running the Test

### Option 1: Using Anchor Test Command
```bash
anchor test --skip-local-validator --provider.cluster devnet tests/init-lottery-devnet.ts
```

### Option 2: Using ts-mocha directly
```bash
# Set environment variables
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export ANCHOR_WALLET="$HOME/.config/solana/id.json"

# Run test
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/init-lottery-devnet.ts
```

### Option 3: Windows PowerShell
```powershell
$env:ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
$env:ANCHOR_WALLET="$env:USERPROFILE\.config\solana\id.json"
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/init-lottery-devnet.ts
```

## What the Test Does

1. **Checks Admin Wallet**
   - Verifies admin wallet is configured
   - Checks SOL balance
   - Displays program ID

2. **Derives Lottery PDA**
   - Calculates Program Derived Address using seeds `[b"lottery"]`
   - Shows PDA address and bump seed

3. **Checks Existing State**
   - If lottery already initialized, displays current state
   - Shows jackpot, participants, timing, etc.

4. **Initializes Lottery** (if not already initialized)
   - Sets initial jackpot to 20 SOL
   - Configures timing (72h base, 48h fast)
   - Sets fast mode threshold (200 SOL)
   - Sets admin address

5. **Verifies Initialization**
   - Fetches lottery account
   - Validates all values
   - Displays complete state

## Expected Output

```
🎰 Initializing Lottery on Devnet
============================================================

✅ Admin: [your-admin-address]
✅ Program: ytKyH7viyfRmqYtS7Y3nCa8kCJXAPTN6MA8a3EmtSn1

💰 Balance: X.XXXX SOL

📝 Lottery PDA: [lottery-pda-address]
   Bump: [bump-value]

🚀 Initializing lottery with 20 SOL initial jackpot...

✅ Transaction Signature: [tx-signature]
🔗 Explorer: https://explorer.solana.com/tx/[tx]?cluster=devnet
🔗 Solscan: https://solscan.io/tx/[tx]?cluster=devnet

✅ Transaction confirmed!

🎉 Lottery Successfully Initialized!
📊 Lottery State:
   Jackpot: 20 SOL
   Carry-over: 0 SOL
   Base Snapshot Interval: 72 hours (72h)
   Fast Snapshot Interval: 48 hours (48h)
   Fast Mode Threshold: 200 SOL (200 SOL)
   Active: ✅ Yes
   Participants: 0
   Total Snapshots: 0
   Fees Collected: 0 SOL
   Is Fast Mode: ❌ No
   Admin: [admin-address]

✅ All validations passed!

💡 NEXT STEPS:
   1. Get participants to enter lottery (need 9+ for snapshot)
   2. Test lottery entry: node scripts/test-lottery-entry.js
   3. Configure test timing: node scripts/configure-test-timing.js 1
   4. Trigger snapshot: node scripts/trigger-snapshot.js
   5. Test payout: node scripts/test-payout-flow.js

✅ Ready for testing!
```

## Troubleshooting

### Error: "Insufficient funds"
- Get devnet SOL from faucet: `solana airdrop 2 [your-address] --url devnet`

### Error: "Program not found"
- Deploy program first: `anchor deploy --provider.cluster devnet --program-name lottery`

### Error: "Account already in use"
- Lottery is already initialized
- Test will show current state instead of initializing

### Error: "Signature verification failed"
- Ensure program is deployed with correct program ID
- Check Anchor.toml has correct program ID
- Rebuild and redeploy: `anchor build && anchor deploy --provider.cluster devnet`

## Next Steps After Initialization

1. **Test Lottery Entry**
   ```bash
   node scripts/test-lottery-entry.js
   ```

2. **Configure Test Timing** (for faster testing)
   ```bash
   node scripts/configure-test-timing.js 1  # 1 hour intervals
   ```

3. **Add Participants**
   - Need at least 9 participants for snapshot
   - Each participant needs to hold $20+ worth of tokens

4. **Trigger Snapshot**
   ```bash
   node scripts/trigger-snapshot.js
   ```

5. **Test Payout**
   ```bash
   node scripts/test-payout-flow.js
   ```

## Program IDs

- **Lottery Program**: `ytKyH7viyfRmqYtS7Y3nCa8kCJXAPTN6MA8a3EmtSn1`
- **Token Program**: `HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR`
- **LP Manager**: `G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG`

## Configuration

Default initialization values:
- **Initial Jackpot**: 20 SOL
- **Base Snapshot Interval**: 72 hours
- **Fast Snapshot Interval**: 48 hours
- **Fast Mode Threshold**: 200 SOL
- **Carry-over Rate**: 8%
- **Grand Prize**: 68%
- **Minor Winners**: 8 winners at 3% each


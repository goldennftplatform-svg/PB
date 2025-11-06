# Next Steps: Lottery Initialization

## ✅ What's Complete

### Contract Updates
- ✅ New payout structure (68% grand prize, 8% carry-over, 8 winners at 3% each)
- ✅ Contract built successfully (`anchor build`)
- ✅ Contract ready to deploy on devnet
- ✅ All calculations verified

### Testing Tools
- ✅ Secure payout tool with 9-point security checks
- ✅ Payout calculations verified for multiple scenarios
- ✅ 25M volume test completed
- ✅ New payout structure tested

## ⏭️ Remaining: Lottery Initialization

### Current Status
- Contract is built and ready
- IDL is generated correctly
- Admin wallet has sufficient balance (4.4 SOL)
- Lottery PDA derived: `5qrYwQEcoTKn6i3MGdw5SbQVApg4nwNHbH89PzidCL4d`

### Issue
Anchor's `Program` constructor is having trouble parsing the account types from the IDL, causing a `Cannot read properties of undefined (reading 'size')` error.

### Solutions

#### Option 1: Use Anchor Test Framework (Recommended)
```powershell
# Set environment variables
$env:ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
$env:ANCHOR_WALLET="$env:USERPROFILE\.config\solana\id.json"

# Run integration test
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/integration.ts
```

The integration test properly handles PDA signing and initialization.

#### Option 2: Manual Transaction (Alternative)
If the test framework doesn't work, we can use Solana's CLI or a direct transaction builder:

```javascript
// Build raw transaction with:
// - Discriminator: [113, 199, 243, 247, 73, 217, 33, 11]
// - Jackpot amount: 20 SOL (20000000000 lamports)
// - Accounts: lottery PDA, admin, system program
```

#### Option 3: Fix IDL Structure
The IDL might need explicit account size information. Anchor's account parsing expects:
- Account discriminator
- Account type definition with size calculation

## 🧪 After Initialization

Once initialized, test the payout workflow:

```bash
# 1. Check lottery status
node scripts/secure-payout-tool.js check

# 2. Test payout calculations
node scripts/test-new-payout-structure.js

# 3. Test full workflow
node scripts/test-full-workflow.js
```

## 📋 Verification Checklist

After successful initialization:
- [ ] Lottery account exists on devnet
- [ ] Jackpot amount: 20 SOL
- [ ] Carry-over: 0 SOL
- [ ] Active: true
- [ ] Participants: 0
- [ ] Payout tool can fetch account
- [ ] Payout calculations work correctly

## 💡 Alternative: Use Solana CLI

If all else fails, we can use Solana CLI to call the program directly:

```bash
# This would require building the instruction manually
# but bypasses Anchor's account parsing issues
```

## 🎯 Priority

**High Priority:** Get lottery initialized on devnet so we can:
1. Test the new payout structure end-to-end
2. Verify the carry-over mechanism works
3. Confirm 8 minor winners are selected correctly
4. Test the full payout workflow

The contract is ready - we just need to get it initialized!


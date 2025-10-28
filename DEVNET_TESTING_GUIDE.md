# 🧪 PEPEBALL Devnet Testing Guide

## Overview

This guide will help you test PEPEBALL on Solana devnet with 3-5 testers. Devnet is perfect for testing without risking real funds.

## Prerequisites

- [ ] Anchor installed
- [ ] Solana CLI installed
- [ ] Node.js and npm/yarn installed
- [ ] A Phantom wallet (or any Solana wallet)
- [ ] Git installed

## Quick Start Checklist

### Step 1: Environment Setup

1. **Install Solana CLI** (if not already installed):
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   solana --version
   ```

2. **Install Anchor** (if not already installed):
   ```bash
   npm install -g @coral-xyz/anchor-cli
   anchor --version
   ```

3. **Set Solana to Devnet**:
   ```bash
   solana config set --url devnet
   solana config get
   ```

4. **Request Devnet SOL**:
   ```bash
   solana airdrop 2
   # Repeat if needed: solana airdrop 2
   ```

### Step 2: Build and Deploy

1. **Install Dependencies**:
   ```bash
   # In project root
   yarn install
   # OR
   npm install
   ```

2. **Build the Programs**:
   ```bash
   anchor build
   ```

3. **Deploy to Devnet**:
   ```bash
   anchor deploy --provider.cluster devnet
   ```

4. **Save Deployment Info**:
   ```bash
   # Your program IDs will be in target/deploy/*.json
   # Note down these addresses:
   - Token Program: target/deploy/pepball_token-keypair.json
   - Lottery Program: target/deploy/lottery-keypair.json
   - LP Manager: target/deploy/lp_manager-keypair.json
   ```

### Step 3: Initialize Contracts

After deployment, you'll need to initialize each program.

1. **Update Program IDs in Anchor.toml** (if they changed during deployment)
2. **Run Integration Tests**:
   ```bash
   anchor test --cluster devnet
   ```

## Testing Tasks for 3-5 People

### Tester 1: Basic Token Operations
**Focus**: Token transfers and tax system

- [ ] Connect wallet to devnet
- [ ] Get initial token balance
- [ ] Transfer tokens to another wallet
- [ ] Verify tax is deducted (2.5% total)
- [ ] Check creator fund receives 0.05%
- [ ] Check jackpot receives 2.45%
- [ ] Transfer tokens back and forth multiple times

**Expected Results**:
- Each transfer deducts 2.5% total tax
- Creator fund receives 0.05% of each transfer
- Jackpot pool grows with each transfer

### Tester 2: Lottery Entry System
**Focus**: Qualification and lottery mechanics

- [ ] Enter lottery with $20 value (1 ticket)
- [ ] Enter lottery with $100 value (4 tickets)
- [ ] Enter lottery with $500 value (10 tickets)
- [ ] Try entering with less than $20 value (should fail)
- [ ] Verify ticket counts in lottery
- [ ] Check dynamic pricing calculation

**Expected Results**:
- $20 = 1 ticket
- $100 = 4 tickets (bonus)
- $500 = 10 tickets (bonus)
- Qualification minimum is $20 USD
- Cannot enter with value less than $20

### Tester 3: Snapshot and Winner Selection
**Focus**: Snapshot timing and winner selection

- [ ] Trigger snapshot (after 72h or admin trigger)
- [ ] Verify at least 6 participants required
- [ ] Check winner selection
- [ ] Test payout distribution
- [ ] Test fast mode (48h when fees > 200 SOL)
- [ ] Test normal mode (72h when fees < 200 SOL)

**Expected Results**:
- Snapshot requires 6+ participants
- Winners are selected from participants
- Main winner gets 60% of jackpot
- 5 minor winners get 8% each (40% total)

### Tester 4: LP Manager and Fee Conversion
**Focus**: LP burns and jackpot funding

- [ ] Test fee conversion to SOL
- [ ] Verify LP burns (85%)
- [ ] Verify jackpot funding (15%)
- [ ] Test with multiple fee conversions
- [ ] Check jackpot growth over time

**Expected Results**:
- 85% of LP tokens are burned
- 15% of LP tokens fund jackpot
- SOL conversion works properly
- Jackpot increases with each conversion

### Tester 5: Security and Edge Cases
**Focus**: Security features and boundary testing

- [ ] Test admin renounce function
- [ ] Test emergency pause
- [ ] Resume lottery after pause
- [ ] Try unauthorized actions (should fail)
- [ ] Test with insufficient balance
- [ ] Test rapid transactions
- [ ] Test maximum participants

**Expected Results**:
- Admin can renounce after deployment
- Emergency pause works correctly
- Unauthorized actions fail
- System handles edge cases gracefully

## Collective Testing Tasks

### Day 1: Setup and Basic Tests
- All testers deploy and configure wallets
- Get devnet SOL
- Test wallet connections
- Basic token transfers between testers

### Day 2: Lottery Mechanics
- All testers enter lottery
- Test different entry amounts
- Verify participant counting
- Test qualification limits

### Day 3: Snapshot and Payouts
- Trigger snapshot with 6+ participants
- Verify winner selection
- Test payout distribution
- Test dynamic timing (72h vs 48h)

### Day 4: Stress Testing
- Rapid transactions
- Multiple wallet interactions
- Fee conversion and LP burns
- Security feature testing

### Day 5: Final Review
- Document all findings
- Create bug reports
- Test emergency features
- Final security checks

## Important Addresses

After deployment, update these addresses in your frontend:

```javascript
// Update in app/src/app.js
this.programIds = {
    token: "YOUR_DEVNET_TOKEN_PROGRAM_ID",
    lottery: "YOUR_DEVNET_LOTTERY_PROGRAM_ID",
    lpManager: "YOUR_DEVNET_LP_MANAGER_PROGRAM_ID"
};
```

## Getting Devnet SOL

All testers need devnet SOL:
1. Request via CLI: `solana airdrop 2`
2. Use faucet: https://faucet.solana.com
3. Join testing Discord for help

## Tracking Testing Progress

Create a shared document (Google Sheets, Notion, etc.) to track:
- ✅ Completed tests
- 🐛 Bugs found
- 💡 Suggestions
- ❓ Questions

## Reporting Issues

When you find a bug:
1. Take a screenshot
2. Note the transaction ID (if applicable)
3. Document steps to reproduce
4. Share in testing chat

## Next Steps After Testing

Once testing is complete:
1. Fix all identified bugs
2. Update documentation
3. Prepare for mainnet
4. Consider audit
5. Plan launch strategy

## Resources

- **Solana Explorer**: https://explorer.solana.com/?cluster=devnet
- **Anchor Docs**: https://www.anchor-lang.com/docs
- **Devnet Faucet**: https://faucet.solana.com
- **Phantom Setup**: https://phantom.app/

---

## Quick Commands Reference

```bash
# Check balance
solana balance

# Get new airdrop
solana airdrop 2

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run tests
anchor test --cluster devnet

# Check program logs
solana logs YOUR_PROGRAM_ID

# Reset for new test
anchor clean && anchor build && anchor deploy
```

---

**Ready to test PEPEBALL on devnet! 🐸🎰**


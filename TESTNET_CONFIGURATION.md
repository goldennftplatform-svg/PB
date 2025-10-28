# 🌐 Testnet Configuration for PEPEBALL

## Quick Setup for Testers

Share this document with your 3-5 testers to get them started quickly.

## 1. Initial Setup (Do This First)

```bash
# Clone the repository
git clone YOUR_REPO_URL
cd POWERsol

# Install dependencies
yarn install
# OR
npm install
```

## 2. Configure Solana for Devnet

```bash
# Set to devnet
solana config set --url devnet

# Verify connection
solana config get

# Request SOL (repeat if needed)
solana airdrop 2
```

## 3. Configure Phantom Wallet for Devnet

1. Open Phantom wallet
2. Go to Settings → Developer Mode
3. Enable "Test Mode"
4. Add devnet network
5. Fund with devnet SOL from faucet

Or use the CLI:
```bash
# Get your wallet address
solana address

# Request airdrop
solana airdrop 2 YOUR_WALLET_ADDRESS

# Check balance
solana balance
```

## 4. Build and Deploy

```bash
# Build the programs
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## 5. Get Your Deployment Addresses

After deployment, you'll get addresses like:
```
Deploying program: target/deploy/pepball_token.so
Program Id: PEPEBALL111111111111111111111111111111111111

Deploying program: target/deploy/lottery.so
Program Id: LOTTERY111111111111111111111111111111111111

Deploying program: target/deploy/lp_manager.so
Program Id: LPMANAGER111111111111111111111111111111111
```

**Save these addresses!** You'll need them for testing.

## 6. Configuration Files

### Update Anchor.toml

The `Anchor.toml` should have these entries for devnet:

```toml
[programs.devnet]
pepball_token = "YOUR_TOKEN_PROGRAM_ID"
lottery = "YOUR_LOTTERY_PROGRAM_ID"
lp_manager = "YOUR_LP_MANAGER_PROGRAM_ID"
```

### Update Frontend (app/src/app.js)

```javascript
// Line 8-12: Update with your program IDs
this.programIds = {
    token: "YOUR_TOKEN_PROGRAM_ID",
    lottery: "YOUR_LOTTERY_PROGRAM_ID",
    lpManager: "YOUR_LP_MANAGER_PROGRAM_ID"
};
```

## 7. Testing Checklist Template

Copy this for each tester:

```markdown
# Tester X: [Your Name]

## Setup
- [ ] Solana CLI installed
- [ ] Anchor installed
- [ ] Wallet configured
- [ ] Devnet SOL received
- [ ] Repository cloned
- [ ] Dependencies installed
- [ ] Programs deployed

## Basic Tests
- [ ] Wallet connection works
- [ ] Token balance visible
- [ ] Can send tokens
- [ ] Can receive tokens

## Advanced Tests
- [ ] Lottery entry works
- [ ] Ticket calculation correct
- [ ] Snapshot triggers properly
- [ ] Winners selected correctly
- [ ] Payouts distributed fairly

## Issues Found
List any bugs or issues here...

## Suggestions
Any ideas for improvements?
```

## 8. Shared Resources

### Testing Discord/Slack Channels

Create channels for:
- **#pepeball-devnet** - General testing discussion
- **#test-results** - Share test results
- **#bugs-issues** - Bug reports
- **#suggestions** - Feature suggestions

### Shared Google Sheet/Notion

Track:
- Test progress per person
- Bugs found and status
- Deployment addresses
- Test transaction IDs
- Winner logs

## 9. Common Issues and Solutions

### Issue: "Insufficient funds"
**Solution**: Request more devnet SOL
```bash
solana airdrop 2
```

### Issue: "Program not deployed"
**Solution**: Rebuild and redeploy
```bash
anchor clean
anchor build
anchor deploy --provider.cluster devnet
```

### Issue: "Wallet not connected"
**Solution**: Enable Phantom in browser, switch to devnet

### Issue: "Transaction failed"
**Solution**: Check logs with:
```bash
solana logs
```

## 10. Testing Schedule

Coordinate with your testers:

- **Day 1-2**: Setup and basic tests
- **Day 3-4**: Lottery mechanics and snapshots
- **Day 5**: Final review and bug fixes

## 11. Success Criteria

The test is successful when:
- ✅ All 5 testers can use the system
- ✅ Token transfers work correctly
- ✅ Lottery entries work correctly
- ✅ Snapshots trigger properly
- ✅ Winners are selected fairly
- ✅ Payouts work correctly
- ✅ No critical bugs found

## 12. Next Steps After Testing

1. Document all findings
2. Fix identified bugs
3. Run security audit
4. Prepare for mainnet deployment
5. Plan launch strategy

---

## Quick Reference

```bash
# Check what cluster you're on
solana config get

# Switch to devnet
solana config set --url devnet

# Get fresh SOL
solana airdrop 2

# Check balance
solana balance

# Deploy
anchor deploy --provider.cluster devnet

# Test
anchor test --cluster devnet

# View logs
solana logs

# Get your public key
solana address
```

## Support

If testers encounter issues:
1. Check Solana status: https://status.solana.com/
2. Check network: `solana config get`
3. Check logs: `solana logs`
4. Ask in testing Discord/Slack

---

**Share this with your testers to get them started! 🐸**


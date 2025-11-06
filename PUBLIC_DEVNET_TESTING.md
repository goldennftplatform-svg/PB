# 🎰 PEPEBALL Public Devnet Testing - NOW LIVE! 🐸

## ✅ Programs Deployed and Ready!

All PEPEBALL programs are **LIVE on Solana Devnet** and ready for public testing!

### 📍 Program Addresses (Devnet)

```
PEPEBALL Token:  61gft4rst67cSLvNZ7G8wxGxiUmpVmEQWbPW5cXR2rPW
Lottery:         Ayf1yysvTa1KPVC3ZDwMJ5nScGcsxJnfXSRpP8BvCBWX
LP Manager:      CnjYgWGNN4FfMhNF3fuDKbFAwQkMWjoT2kEdetbTRyUc
```

### 🔗 View on Explorer

- **Token Program**: https://explorer.solana.com/address/61gft4rst67cSLvNZ7G8wxGxiUmpVmEQWbPW5cXR2rPW?cluster=devnet
- **Lottery Program**: https://explorer.solana.com/address/Ayf1yysvTa1KPVC3ZDwMJ5nScGcsxJnfXSRpP8BvCBWX?cluster=devnet
- **LP Manager**: https://explorer.solana.com/address/CnjYgWGNN4FfMhNF3fuDKbFAwQkMWjoT2kEdetbTRyUc?cluster=devnet

---

## 🚀 Quick Start for Testers

### Option 1: Use Phantom Wallet (Easiest)

1. **Install Phantom** (if you don't have it)
   - Chrome: https://phantom.app/
   - Firefox: https://phantom.app/

2. **Switch to Devnet**
   - Open Phantom → Settings → Developer Mode
   - Toggle "Test Mode" ON
   - Change network to **Devnet**

3. **Get Devnet SOL**
   - Click your wallet address in Phantom
   - Click "Airdrop" button (if available)
   - OR use: https://faucet.solana.com/
   - OR CLI: `solana airdrop 2 YOUR_WALLET_ADDRESS`

4. **Connect and Test!**
   - Open the frontend (instructions below)
   - Connect your Phantom wallet
   - Start testing!

### Option 2: Use Solana CLI

1. **Install Solana CLI**:
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   ```

2. **Set to Devnet**:
   ```bash
   solana config set --url devnet
   ```

3. **Get Devnet SOL**:
   ```bash
   solana airdrop 2
   solana balance
   ```

4. **Test Programs** (see testing tasks below)

---

## 🧪 Testing Tasks

### Task 1: Connect Wallet
- [ ] Install/Open Phantom wallet
- [ ] Switch to Devnet network
- [ ] Get devnet SOL from faucet
- [ ] Connect wallet to frontend
- [ ] Verify connection works

### Task 2: Initialize Programs
Use Anchor CLI or web interface:

**Initialize Token:**
```bash
anchor test --skip-build --provider.cluster devnet
```

**Initialize Lottery:**
```bash
# Use Anchor IDL or custom script
```

### Task 3: Test Token Transfers
- [ ] Transfer tokens between wallets
- [ ] Verify 2.5% tax is deducted
- [ ] Check creator fund receives 0.05%
- [ ] Verify jackpot receives 2.45%
- [ ] View transactions on Explorer

### Task 4: Enter Lottery
- [ ] Enter with $20 value (1 ticket)
- [ ] Enter with $100 value (4 tickets)  
- [ ] Enter with $500 value (10 tickets)
- [ ] Try entering with <$20 (should fail)
- [ ] View your tickets on-chain

### Task 5: Test Lottery Mechanics
- [ ] Get 6+ people to enter lottery
- [ ] Trigger snapshot (admin function)
- [ ] Verify winners are selected
- [ ] Check payout distribution
- [ ] Test dynamic timing (72h vs 48h)

---

## 🌐 Frontend Testing

### Local Setup

1. **Clone/Download the repo**

2. **Install dependencies**:
   ```bash
   cd app
   npm install
   ```

3. **Start local server**:
   ```bash
   npm start
   # OR
   npx live-server --port=3000
   ```

4. **Open in browser**:
   - Navigate to: `http://localhost:3000`
   - Connect Phantom wallet (set to Devnet!)
   - Start testing!

### Online Testing (LIVE NOW!)

**Frontend is LIVE at:** https://pb-n7kx.vercel.app/

**To test:**
1. Open https://pb-n7kx.vercel.app/
2. Connect your Phantom wallet (make sure it's set to Devnet!)
3. Start testing immediately!

**Note:** The frontend is already deployed and connected to devnet programs.

---

## 📊 What to Test

### ✅ Core Features
1. **Wallet Connection**
   - Connect/Disconnect
   - Display wallet address
   - Show balance

2. **Token Operations**
   - View token balance
   - Transfer tokens
   - Verify taxes

3. **Lottery System**
   - Enter lottery
   - View tickets
   - Check jackpot amount
   - See participant count

4. **Transaction Tracking**
   - View on Explorer
   - Verify calculations
   - Check fee distribution

### 🐛 Report Issues

When you find a bug:
1. Take a screenshot
2. Note the transaction ID
3. Describe what happened
4. Report via:
   - GitHub Issues
   - Discord (link coming)
   - Email

---

## 📝 Testing Checklist

### Day 1: Setup & Basics
- [ ] Set up wallet for devnet
- [ ] Get devnet SOL
- [ ] Connect to frontend
- [ ] Basic wallet operations

### Day 2: Token Testing
- [ ] Token transfers
- [ ] Tax verification
- [ ] Multiple transfers
- [ ] Edge cases

### Day 3: Lottery Testing
- [ ] Enter lottery
- [ ] Different entry amounts
- [ ] Participant tracking
- [ ] Ticket calculations

### Day 4: Advanced Features
- [ ] Snapshot triggering
- [ ] Winner selection
- [ ] Payouts
- [ ] Dynamic timing

### Day 5: Final Review
- [ ] Report all findings
- [ ] Submit bug reports
- [ ] Share feedback
- [ ] Final security checks

---

## 🔧 Developer Commands

### Anchor CLI
```bash
# Build programs
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Run tests
anchor test --skip-build --provider.cluster devnet

# Check program
solana program show <PROGRAM_ID>
```

### Solana CLI
```bash
# Check balance
solana balance

# Get airdrop
solana airdrop 2

# View transaction
solana confirm <TRANSACTION_SIGNATURE>

# Program logs
solana logs <PROGRAM_ID>
```

---

## 📞 Support & Resources

### Useful Links
- **Solana Explorer (Devnet)**: https://explorer.solana.com/?cluster=devnet
- **Devnet Faucet**: https://faucet.solana.com/
- **Phantom Wallet**: https://phantom.app/
- **Anchor Docs**: https://www.anchor-lang.com/docs
- **Solana Docs**: https://docs.solana.com/

### Get Help
- Discord: (link coming soon)
- GitHub Issues: (repo link)
- Email: (contact info)

---

## 🎁 Rewards for Testers

Active testers will receive:
- ✅ Early access to mainnet launch
- ✅ Recognition in launch materials
- ✅ Beta tester NFT (planned)
- ✅ Special Discord role
- ✅ Your input shapes the product!

---

## ⚠️ Important Notes

### Devnet vs Mainnet
- **Devnet = Testing only!**
- No real money involved
- Transactions are free
- Can reset/redeploy anytime

### Security
- These are test programs
- Not audited yet
- Do NOT use mainnet addresses
- Do NOT send real SOL

### Feedback
- All feedback is valuable!
- Report even small issues
- Suggest improvements
- Share your experience!

---

## 🚀 Ready to Test?

1. ✅ Switch Phantom to Devnet
2. ✅ Get devnet SOL
3. ✅ Connect wallet
4. ✅ Start testing!
5. ✅ Report findings

**Let's make PEPEBALL the best lottery token on Solana! 🐸🎰**

---

## 📅 Testing Timeline

- **Week 1**: Setup & Basic Testing
- **Week 2**: Advanced Features  
- **Week 3**: Bug Fixes
- **Week 4**: Final Testing
- **Week 5**: Mainnet Launch! 🚀

**Start testing now and help us launch!** 🎉

---

**Last Updated**: 2025-10-30
**Status**: ✅ LIVE ON DEVNET - READY FOR TESTING!


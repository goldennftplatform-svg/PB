# 🤖 PEPEBALL Bot Testing Guide

## Overview

Automated bot system to stress test PEPEBALL contracts on devnet using 10 wallets that buy, sell, and interact with the lottery.

## Quick Start

### 1. Install Dependencies
```bash
cd scripts
npm install
```

### 2. Create Bot Wallets
```bash
npm run create-wallets
```
This creates 10 bot wallets in `bots/wallets/`

### 3. Fund Bot Wallets
```bash
npm run fund-wallets
```
This requests 2 SOL airdrop for each bot (20 SOL total)

### 4. Run All Bots
```bash
npm run run-all-bots
```
This runs all 10 bots simultaneously to stress test contracts

## Bot System

### Bot Wallets
- **Location**: `bots/wallets/`
- **Format**: `bot1.json` through `bot10.json`
- **Addresses**: Saved in `bots/addresses.txt`

### What Bots Do

1. **Buy Tokens** - Simulates purchasing PEPEBALL tokens
2. **Sell Tokens** - Simulates selling tokens (triggers tax)
3. **Enter Lottery** - Enters lottery with various USD values ($20, $100, $500)
4. **Stress Testing** - Runs multiple transactions in parallel

### Bot Patterns

Each bot follows a different pattern:
- **Bot 1, 5, 9**: Aggressive traders (frequent buy/sell)
- **Bot 2, 6, 10**: Lottery focused (multiple entries)
- **Bot 3, 7**: Buy and hold strategy
- **Bot 4, 8**: Frequent small trades

## Results

Results are saved in `bots/results/`:
- Individual bot results: `bot1-results.json` ... `bot10-results.json`
- Summary: `stress-test-summary.json`

### Results Include:
- Total transactions per bot
- Error count
- Transaction history
- Error details

## Manual Bot Control

### Run Single Bot
```bash
node bot-trader.js 1  # Run bot 1
node bot-trader.js 5  # Run bot 5
```

### Check Bot Status
```bash
# View bot addresses
cat bots/addresses.txt

# Check funding status
cat bots/funding-status.json

# View results
cat bots/results/stress-test-summary.json
```

## Advanced Usage

### Custom Trading Patterns

Edit `run-all-bots.js` to customize bot behavior:

```javascript
const patterns = [
    // Add your custom pattern
    [
        () => bot.buyTokens(100),
        () => bot.enterLottery(100),
        // ... more actions
    ],
];
```

### Continuous Testing

Run bots in a loop:

```bash
# Run for 10 iterations
for i in {1..10}; do
    npm run run-all-bots
    sleep 60  # Wait 1 minute between runs
done
```

## Monitoring

### Real-time Monitoring

```bash
# Watch bot transactions
solana logs <PROGRAM_ID> --url devnet

# Check bot balances
solana balance <BOT_ADDRESS> --url devnet
```

### Explorer Links

View bot activity on Solana Explorer:
- Token Program: https://explorer.solana.com/address/61gft4rst67cSLvNZ7G8wxGxiUmpVmEQWbPW5cXR2rPW?cluster=devnet
- Lottery: https://explorer.solana.com/address/Ayf1yysvTa1KPVC3ZDwMJ5nScGcsxJnfXSRpP8BvCBWX?cluster=devnet

## Troubleshooting

### Bots Not Funding
- Check devnet SOL faucet availability
- Retry funding: `npm run fund-wallets`
- Check network connection

### Transaction Failures
- Verify program IDs are correct
- Check bot wallet balances
- Ensure contracts are deployed to devnet

### Rate Limiting
- Bots include delays between transactions
- Adjust delays in bot scripts if needed
- Stagger bot start times

## Integration with Real Contracts

When ready to test with real contract interactions:

1. **Load Anchor Program**:
```javascript
const anchor = require('@coral-xyz/anchor');
const program = anchor.Program.load(idl, programId, provider);
```

2. **Call Real Methods**:
```javascript
await program.methods
    .enterLotteryWithUsdValue(new anchor.BN(usdValue))
    .accounts({...})
    .rpc();
```

3. **Handle Real Transactions**:
- Wait for confirmations
- Handle errors properly
- Verify transaction success

## Next Steps

1. ✅ Create bot wallets
2. ✅ Fund with devnet SOL
3. ✅ Run stress tests
4. ⏭️ Integrate with real contract calls
5. ⏭️ Add contract verification
6. ⏭️ Set up continuous testing

---

**Status**: Ready for devnet testing! 🤖



















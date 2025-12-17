# 🤖 PEPEBALL Bot Testing Scripts

Automated bot system to stress test PEPEBALL contracts with 10 wallets.

## Quick Start

```bash
# 1. Install dependencies (if not already installed)
npm install

# 2. Create 10 bot wallets
node create-bot-wallets.js

# 3. Fund wallets with devnet SOL (2 SOL each)
node fund-bot-wallets.js

# 4. Run all bots simultaneously
node run-all-bots.js
```

## Scripts

### `create-bot-wallets.js`
Creates 10 bot wallets using Solana CLI.
- Output: `bots/wallets/bot1.json` through `bot10.json`
- Registry: `bots/registry.json`

### `fund-bot-wallets.js`
Funds all bot wallets with devnet SOL.
- Requests 2 SOL airdrop per bot
- Handles rate limits with retries
- Status: `bots/funding-status.json`

### `bot-trader.js`
Single bot trading simulator.
```bash
node bot-trader.js 1  # Run bot 1
node bot-trader.js 5  # Run bot 5
```

### `run-all-bots.js`
Runs all 10 bots simultaneously for stress testing.
- Different trading patterns per bot
- Parallel execution
- Results saved to `bots/results/`

## Bot Trading Patterns

- **Bots 1, 5, 9**: Aggressive traders (frequent buy/sell)
- **Bots 2, 6, 10**: Lottery focused (multiple entries)
- **Bots 3, 7**: Buy and hold strategy
- **Bots 4, 8**: Frequent small trades

## Results

Results are saved in `bots/results/`:
- Individual: `bot1-results.json` ... `bot10-results.json`
- Summary: `stress-test-summary.json`

## Requirements

- Node.js
- Solana CLI installed
- Access to devnet

## Next Steps

1. ✅ Create wallets
2. ✅ Fund with SOL
3. ⏭️ Integrate with real Anchor program calls
4. ⏭️ Add transaction verification
5. ⏭️ Continuous testing loop

See `BOT_TESTING_GUIDE.md` for full documentation.



















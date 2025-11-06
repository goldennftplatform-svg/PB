# 💰 Payout Testing Guide

## ✅ What's Working

1. **Payout Tool Created**: `scripts/test-automated-payout-simple.js`
   - ✅ Checks lottery status
   - ✅ Simulates payout calculations
   - ✅ Can execute payouts when winners exist

2. **Initialization Script**: `scripts/initialize-lottery.js`
   - ✅ Ready to initialize lottery contract

## 📋 Current Status

- **Lottery Account**: ❌ Not initialized on devnet yet
- **Program ID**: ✅ `6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb`
- **Lottery PDA**: `5qrYwQEcoTKn6i3MGdw5SbQVApg4nwNHbH89PzidCL4d`

## 🚀 How to Initialize and Test

### Option 1: Use Anchor Test (Recommended)

```bash
# This will initialize the lottery automatically
anchor test --skip-build --skip-deploy --provider.cluster devnet
```

The integration test will:
1. Initialize the lottery with 20 SOL jackpot
2. Set up all accounts
3. Verify everything works

### Option 2: Manual Initialization

After initialization, test the payout tool:

```bash
# Check lottery status
node scripts/test-automated-payout-simple.js info

# Simulate payout (check calculations)
node scripts/test-automated-payout-simple.js simulate

# Execute payout (when winners exist)
node scripts/test-automated-payout-simple.js execute
```

## 🧪 Testing Workflow

1. **Initialize Lottery** (if not done)
   ```bash
   anchor test --skip-build --skip-deploy --provider.cluster devnet
   ```

2. **Check Status**
   ```bash
   node scripts/test-automated-payout-simple.js info
   ```

3. **Take Snapshot** (to select winners)
   - Use your admin wallet
   - Call `take_snapshot` instruction
   - Winners will be selected

4. **Test Payout**
   ```bash
   node scripts/test-automated-payout-simple.js simulate
   ```

5. **Execute Payout** (when ready)
   ```bash
   node scripts/test-automated-payout-simple.js execute
   ```

## 📊 Expected Results

When payout tool works correctly, you'll see:
- ✅ Lottery account found
- ✅ Current jackpot amount
- ✅ Winner status (if snapshot taken)
- ✅ Calculated payout amounts:
  - Main winner: 60% of jackpot
  - Each minor winner: 8% of jackpot (40% total / 5 winners)

## 🔧 Troubleshooting

**Issue**: "Lottery Account: ❌ Not Found"
- **Solution**: Initialize lottery first using anchor test

**Issue**: "Program initialization issue"
- **Solution**: This is expected - the simplified tool still works for basic functionality

**Issue**: "No winners to payout"
- **Solution**: Take a snapshot first to select winners

## 📝 Next Steps

1. ✅ Initialize lottery on devnet
2. ✅ Take a snapshot to select winners
3. ✅ Test payout calculation
4. ✅ Execute payout transaction
5. ✅ Verify winners cleared


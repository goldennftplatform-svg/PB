# 🎰 Testing 50/50 Rollover - Quick Guide

## ✅ What's Done

1. **Code Updated**: 50/50 rollover mechanic implemented in `programs/lottery/src/lib.rs`
2. **Program Deployed**: Updated lottery program deployed to devnet
3. **Test Script Created**: `scripts/test-50-50-rollover.js` ready to use

## ⚠️ Important Note

The lottery account on-chain has the **old structure** (without `rollover_count` and `pepe_ball_count` fields). 

**Two Options:**

### Option 1: Test with Existing Account (Quick)
The new code will work, but the new fields will default to 0. This is fine for testing!

### Option 2: Fresh Start (Recommended for Full Testing)
Close and reinitialize the lottery account to get the full new structure.

## 🚀 Quick Test Steps

### Step 1: Test the Rollover Logic
```bash
node scripts/test-50-50-rollover.js
```

This will:
- Check current lottery state
- Create test entries if needed (9+ participants)
- Take a snapshot (triggers 50/50 logic)
- Show if it's ODD (payout) or EVEN (rollover)

### Step 2: See the Result

**If ODD Count:**
- 🎉 PAYOUT TIME!
- Winners can be selected
- Payout: 50% main, 40% minors, 10% house

**If EVEN Count:**
- 🚀 ROLLOVER!
- Jackpot grows
- Timer extended
- Participants carry over

## 📊 What to Expect

The test script will show:
```
🐸 Pepe Ball Count: 15 (ODD)
🎉 ODD COUNT - PAYOUT TIME!
```

OR

```
🐸 Pepe Ball Count: 20 (EVEN)
🚀 EVEN COUNT - ROLLOVER!
Rollover Count: 1
```

## 🎯 Next Steps After Testing

1. **If you want fresh account** (with new fields properly initialized):
   - The account will auto-resize on next initialization
   - Or manually close and reinit (requires admin)

2. **Test multiple rollovers:**
   - Run snapshot multiple times
   - Watch rollover count increase
   - See timer extensions

3. **Test payout:**
   - When you get ODD count
   - Use `helius-winner-indexer.js` to find winners
   - Use `secure-payout-tool.js` to execute payout

## 💡 Pro Tips

- **Timer Check**: If timer isn't ready, the script will show a simulation
- **Multiple Tests**: Run the test multiple times to see both ODD and EVEN outcomes
- **Watch Explorer**: All transactions are logged with explorer links

## 🐛 Troubleshooting

**"Timer not ready"**: 
- Wait for timer to expire, OR
- Use `configure_timing` to set shorter intervals

**"Not enough participants"**:
- Script auto-creates 10 test wallets
- Or use existing test wallets

**"Account size mismatch"**:
- This is expected - new fields default to 0
- Works fine for testing!

---

**Ready to test?** Run: `node scripts/test-50-50-rollover.js` 🚀


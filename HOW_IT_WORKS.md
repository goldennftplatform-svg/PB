# 🎰 How the Lottery System Works

## ✅ Current Status

**Lottery Account:** `ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb`  
**Current Jackpot:** 5.003835 SOL  
**Admin Wallet:** `Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ`  
**Admin Balance:** 57.67 SOL  

## 🔄 How It Works

### 1. **Entries Don't Transfer SOL**
- When users enter the lottery, they call `enter_lottery` or `enter_lottery_with_usd_value`
- This function **only records participants** - it doesn't transfer SOL
- It creates a participant account and updates counters (`total_participants`, `total_tickets`)
- **No SOL is moved during entry**

### 2. **Jackpot Must Be Funded Separately**
The jackpot comes from:
- **Token sales** (when users buy tokens, a portion goes to jackpot)
- **Manual funding** (admin transfers SOL to lottery account)
- **LP fees** (if using liquidity pool integration)

### 3. **Frontend Reads Account Balance**
- The frontend reads the jackpot directly from the lottery account's balance
- `accountInfo.lamports` = the actual jackpot amount
- The `jackpot_amount` field in the struct is separate (for program logic)

### 4. **Snapshot & Payout Flow**
1. **Snapshot** (`take_snapshot`):
   - Requires 9+ participants
   - Calculates Pepe ball count (1-30)
   - If ODD: Sets seed for payout
   - If EVEN: Rollover (grows jackpot, extends timer)

2. **Payout** (`payout_winners`):
   - Transfers SOL from lottery account to winners
   - 50% to main winner
   - 40% split among 8 minor winners (5% each)
   - 10% house fee

## 🛠️ Scripts You Can Use

### Check Status
```bash
node scripts/diagnose-lottery-state.js
node scripts/check-transaction-details.js
```

### Fund Jackpot
```bash
# Fund with specific amount
node scripts/make-it-work.js 10.0  # Adds 10 SOL

# Or use the dedicated script
node scripts/fund-jackpot-manual.js 10.0
```

### Sync jackpot_amount Field
```bash
node scripts/sync-jackpot-amount.js
```

### Make Everything Work
```bash
# Comprehensive setup (checks, funds if needed, syncs)
node scripts/make-it-work.js [amount]
```

## 📱 Frontend

The frontend (`app/lottery-data.js`) reads the jackpot from:
```javascript
const accountInfo = await connection.getAccountInfo(lotteryPDA);
const jackpot = accountInfo.lamports; // This is the real jackpot
```

**The frontend should now show: 5.0038 SOL**

## 🎯 Why Entries Show 0 Balance Change

This is **correct behavior**:
- Entries record participants
- They don't transfer SOL
- The jackpot is funded separately

## 💡 To Add More Funds

You have 57.67 SOL in your admin wallet. To add more to the jackpot:

```bash
node scripts/make-it-work.js 20.0  # Adds 20 SOL to jackpot
```

Or manually:
```bash
node scripts/fund-jackpot-manual.js 20.0
```

## ✅ Everything Should Work Now

1. ✅ Lottery is initialized
2. ✅ Jackpot has 5.003835 SOL
3. ✅ 18 entry transactions recorded
4. ✅ Frontend reads from account balance
5. ✅ Ready for snapshots and payouts

**Just hard refresh the frontend (Ctrl+Shift+R) and you should see the jackpot!**

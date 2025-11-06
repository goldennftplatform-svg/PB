# 🚀 Deployment & Upgrade Checklist

## ✅ Completed Updates

### 1. Contract Upgrades
- ✅ New payout structure: 68% grand prize, 8% carry-over, 8 winners at 3% each
- ✅ PDA initialization security (seeds + bump)
- ✅ Input validation (jackpot limits)
- ✅ New program ID: `ytKyH7viyfRmqYtS7Y3nCa8kCJXAPTN6MA8a3EmtSn1`
- ✅ Account size issue identified (>10KB CPI limit)

### 2. Frontend Updates Needed
- ⏭️ Update program IDs in `app/src/app.js` ✅ DONE
- ⏭️ Add price service for dynamic USD conversion ✅ DONE
- ⏭️ Update payout structure display (68/8/8×3)
- ⏭️ Add real-time price fetching
- ⏭️ Add Helius API integration

### 3. Price Integration
- ✅ Price service created (`app/src/price-service.js`)
- ✅ Jupiter Price API integration
- ✅ Helius API support for enhanced data
- ⏭️ Connect to lottery snapshot system
- ⏭️ Real-time price updates in UI

## 📋 Remaining Tasks

### Frontend Updates
1. **Update Payout Display**
   - Show: 68% Grand Prize, 8% Carry-over, 8×3% Minor Winners
   - Update jackpot display with carry-over
   - Show expected payouts

2. **Dynamic Price Integration**
   - Initialize price service on app load
   - Set token mint address from contract
   - Calculate minimum tokens for $20 entry dynamically
   - Update UI with real-time price

3. **Helius API Setup**
   - Add Helius API key to environment
   - Configure for production
   - Use for snapshot value calculations

4. **Dashboard Updates**
   - Show new payout percentages
   - Display carry-over amount
   - Show 8 minor winners (not 5)
   - Real-time price display

### Vercel Deployment
1. **Update Program IDs**
   - ✅ Frontend updated
   - ⏭️ Deploy to Vercel
   - ⏭️ Verify on live site

2. **Environment Variables**
   - Add `HELIUS_API_KEY` to Vercel
   - Configure for devnet/mainnet

3. **Test Deployment**
   - Verify wallet connection
   - Test price fetching
   - Test lottery entry with dynamic pricing

## 🔧 Helius API Integration

### Benefits
- **Faster RPC**: Better performance than standard RPC
- **Enhanced Data**: Better transaction parsing
- **Price Data**: Can use for token price retrieval
- **Optimization**: Reduces load on standard RPC

### Setup
1. Get Helius API key from https://helius.xyz
2. Add to Vercel environment variables
3. Update `price-service.js` to use Helius RPC
4. Test with enhanced data retrieval

## 📊 Price to USDC Conversion

### Current Implementation
- Uses Jupiter Price API for token price
- Calculates USD value dynamically
- Caches price for 30 seconds
- Falls back to default if API fails

### For Snapshots
- Need to calculate USD value of token holdings
- Determine ticket count based on USD value
- Update lottery entries with accurate USD values

### Integration Points
1. **Lottery Entry**: Calculate USD value before entry
2. **Snapshot**: Calculate USD value for all participants
3. **Display**: Show USD value in UI
4. **Minimum Entry**: Dynamic $20 minimum based on current price

## 🎯 Next Steps

1. **Immediate**
   - Update Vercel deployment with new code
   - Add Helius API key to environment
   - Test price fetching on live site

2. **Short-term**
   - Connect price service to lottery entry
   - Update snapshot system to use USD values
   - Add real-time price display

3. **Production**
   - Mainnet deployment
   - Final Helius API configuration
   - Production price feeds

## 📝 Files Updated

- ✅ `app/src/app.js` - Updated program IDs
- ✅ `app/src/price-service.js` - NEW: Price service with Helius
- ⏭️ `app/index.html` - Add price service script
- ⏭️ `vercel.json` - Environment variables config

## 🔗 Resources

- **Jupiter Price API**: https://price.jup.ag/v4/price
- **Helius API**: https://docs.helius.dev/
- **Vercel Docs**: https://vercel.com/docs
- **Current Deployment**: https://pb-n7kx.vercel.app/


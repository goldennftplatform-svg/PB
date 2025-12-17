# 💰 LP Pairing & $20 Qualification Explained

## How It Works

### LP Pairing Strategy
When creating the liquidity pool:
- **Equal Value Pairing**: Tokens are paired with SOL at equal value
- **Example**: If you add 10 SOL to LP, you add tokens worth 10 SOL
- **Initial Price**: Set by the LP ratio

### $20 Qualification Logic

**Key Point**: Since tokens are paired at equal value, buying $20 worth = holding $20 worth!

#### Scenario 1: Initial LP Creation
```
LP Pool:
- 10 SOL ($1,000 at $100/SOL)
- Tokens worth $1,000
- Initial price: 1 token = $0.001 (if 1M tokens)
```

#### Scenario 2: User Buys $20 Worth
```
User buys:
- $20 worth of tokens
- Gets tokens at current LP price
- Since LP maintains equal value pairing:
  → User holds $20 worth of tokens
  → Automatically qualifies for lottery!
```

### Why This Works

1. **LP Maintains Price**: Constant product formula keeps value stable
2. **Equal Pairing**: SOL and tokens always paired at equal USD value
3. **Direct Qualification**: $20 purchase = $20 worth held = auto-entry

### Auto-Entry Flow

```
User buys $20 on Pump.fun
    ↓
Receives tokens worth $20 (at LP price)
    ↓
Monitor detects transfer
    ↓
Calculates USD value: $20.00
    ↓
Meets $20 minimum ✅
    ↓
Auto-enters into lottery
    ↓
User gets tickets based on purchase amount
```

### Ticket Calculation

Based on USD value:
- **$20 - $99.99**: 1 ticket
- **$100 - $499.99**: 4 tickets (100% bonus)
- **$500+**: 10 tickets (400% bonus)

### Important Notes

1. **Price Fluctuations**: If price changes after purchase, user still qualified (snapshot uses entry value)
2. **LP Stability**: Equal pairing keeps price relatively stable
3. **Minimum Enforced**: Must hold $20+ USD worth to qualify
4. **Auto-Check**: Monitor automatically calculates USD value using real-time price

### Example Calculations

#### Initial LP Setup
```
Public LP (85%):
- 850M tokens
- Paired with equivalent SOL value
- Price discovery: Market sets initial price
```

#### User Purchase
```
User buys $20:
- Current price: $0.000020 per token
- Gets: 1,000,000 tokens
- USD value: $20.00
- Qualifies: ✅ YES (meets $20 minimum)
- Tickets: 1 ticket
```

#### Price Change Scenario
```
Price goes up to $0.000040:
- User still holds 1,000,000 tokens
- New USD value: $40.00
- Still qualified: ✅ YES (was $20+ at entry)
- Tickets: Still 1 ticket (based on entry value)
```

## Implementation

### Monitor Script
- Calculates real-time USD value using Jupiter price API
- Checks if $20+ minimum is met
- Auto-enters qualifying buyers

### LP Creation
- 85% tokens to public LP (non-house)
- 15% tokens to house LP (admin)
- Equal value pairing ensures fair pricing

## Summary

✅ **LP pairs tokens at equal value with SOL**
✅ **Buying $20 = holding $20 worth**
✅ **Automatic qualification for lottery**
✅ **Real-time price calculation for accuracy**
✅ **$20 minimum enforced**

The equal value pairing makes the $20 qualification straightforward - if you buy $20 worth, you hold $20 worth, so you automatically qualify!


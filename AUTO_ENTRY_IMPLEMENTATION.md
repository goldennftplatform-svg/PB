# 🎰 Auto-Entry Implementation for Pump.fun Buyers

## Overview

**Every Pump.fun purchase automatically enters buyers into the lottery!**

## Implementation Strategy

### Current Setup

1. **Token Transfer Detection**: Monitor all token transfers
2. **USD Value Calculation**: Calculate USD value of received tokens
3. **Auto-Entry**: Automatically call `enter_lottery_with_usd_value` if $20+ minimum met

### How It Works

1. **User buys on Pump.fun** → Receives tokens
2. **Transfer detected** → Monitor sees new tokens in wallet
3. **USD value calculated** → Check if meets $20 minimum
4. **Auto-entry triggered** → Automatically calls lottery program
5. **User is entered** → No manual action needed!

## Files Created

### 1. `scripts/auto-entry-monitor.js`
- Monitors token transfers in real-time
- Detects when users receive tokens
- Automatically enters qualifying buyers ($20+)

### 2. `scripts/mint-and-setup-lp.js`
- Mints 1 billion tokens
- 85% to public LP (non-house)
- 15% to house LP (admin controlled)

### 3. Updated UI (`app/index.html`)
- Powerball.com mobile design
- Clean, professional, modern
- Auto-entry badge prominently displayed
- Emphasizes automatic entry for Pump.fun buyers

## Running Auto-Entry Monitor

```bash
# Start the monitor
node scripts/auto-entry-monitor.js
```

The monitor will:
- Watch for new token transfers
- Calculate USD value
- Auto-enter buyers who meet $20 minimum
- Log all entries

## LP Strategy

### 85% Public LP (Non-House)
- Goes to Raydium/Orca pool
- Public trading
- No admin control
- Transparent and decentralized

### 15% House LP (Admin Controlled)
- Reserved for jackpot funding
- Can add liquidity if needed
- Admin has control
- Used for operational purposes

## Minting Tokens

```bash
# Run the mint script
node scripts/mint-and-setup-lp.js
```

This will:
1. Create token mint
2. Mint 1 billion tokens total
3. Allocate 850M to public LP account
4. Allocate 150M to house LP account
5. Provide instructions for creating liquidity pool

## UI Design

### Powerball.com Mobile Style
- ✅ Clean, professional design
- ✅ Red/Blue/Gold color scheme
- ✅ Mobile-first responsive
- ✅ Modern typography (Inter font)
- ✅ Smooth animations
- ✅ Auto-entry badge prominently displayed

### Key Features
- Large jackpot display
- Clear call-to-action buttons
- Ticket tier cards
- Auto-entry messaging
- Contract address section

## Next Steps

1. **Mint tokens**: `node scripts/mint-and-setup-lp.js`
2. **Create public LP**: Add 85% tokens + SOL to Raydium
3. **Start monitor**: `node scripts/auto-entry-monitor.js`
4. **Test**: Buy tokens on Pump.fun and verify auto-entry

## Important Notes

- **Auto-entry requires monitor running** (or contract-level CPI)
- **$20 minimum** for lottery entry
- **Pump.fun buyers** automatically entered
- **85% public LP** ensures fair trading
- **15% house LP** for operational control

## Future: Contract-Level Auto-Entry

For true automatic entry without a monitor, add CPI to token contract:

```rust
// In transfer_with_tax function
// After successful transfer, call lottery program
let lottery_program = ctx.accounts.lottery_program.to_account_info();
let cpi_accounts = EnterLottery {
    lottery: lottery_pda,
    participant: ctx.accounts.to.owner, // Recipient
};
let cpi_ctx = CpiContext::new(lottery_program, cpi_accounts);
lottery::cpi::enter_lottery_with_usd_value(cpi_ctx, usd_value_cents)?;
```

This requires:
- Adding lottery program as dependency
- Updating TransferWithTax accounts struct
- Rebuilding and redeploying

For now, the monitor script handles auto-entry!


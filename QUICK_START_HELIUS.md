# Quick Start: Helius Winner Indexer

## ✅ Setup Complete!

The Helius-based winner indexer is ready to use. Here's how to get started:

## 1. Get Helius API Key (Optional but Recommended)

For 20k+ participants, Helius API is essential:

1. Visit https://www.helius.dev/
2. Sign up (free tier available)
3. Get your API key
4. Set environment variable:

```powershell
# Windows PowerShell
$env:HELIUS_API_KEY="your-api-key-here"
```

```bash
# Linux/Mac
export HELIUS_API_KEY="your-api-key-here"
```

**Note:** The indexer works without Helius but will be slower for large datasets.

## 2. Deploy Updated Program

The scalable lottery program is ready. Deploy it:

```bash
anchor build
anchor deploy --provider.cluster devnet
```

## 3. Initialize Lottery

```powershell
$env:ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
$env:ANCHOR_WALLET="$env:USERPROFILE\.config\solana\id.json"
node scripts/simple-init-lottery.js
```

## 4. Participants Enter Lottery

Participants can now enter using:
- `enter_lottery_with_usd_value` - For new participants
- `update_participant_tickets` - For existing participants (add more tickets)

**Client-side logic:**
```javascript
try {
    // Try new entry
    await program.methods.enterLotteryWithUsdValue(usdValue)
        .accounts({...})
        .rpc();
} catch (error) {
    if (error.message.includes('already in use')) {
        // Account exists, update instead
        await program.methods.updateParticipantTickets(ticketCount, usdValue)
            .accounts({...})
            .rpc();
    }
}
```

## 5. Take Snapshot

When ready to select winners:

```powershell
node scripts/trigger-snapshot.js
```

This calculates `snapshot_seed` and resets counters for next round.

## 6. Index Winners

After snapshot, run the Helius indexer:

```powershell
$env:ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
$env:ANCHOR_WALLET="$env:USERPROFILE\.config\solana\id.json"
node scripts/helius-winner-indexer.js
```

The indexer will:
1. ✅ Fetch all participant accounts (via Helius or standard RPC)
2. ✅ Calculate winners based on snapshot seed
3. ✅ Set winners on-chain via `set_winners`

## 7. Payout Winners

Once winners are set:

```powershell
node scripts/trigger-payout.js
```

## Architecture Summary

```
┌─────────────────────┐
│  Participants       │ → Each has own PDA account
│  (20,000+)         │   [participant, lottery_pda, wallet]
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Lottery Account    │ → Stores totals only:
│                     │   - total_participants
│                     │   - total_tickets
│                     │   - snapshot_seed
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  take_snapshot      │ → Calculates seed, resets
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Helius Indexer     │ → Fetches all accounts
│                     │   Calculates winners
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  set_winners        │ → On-chain verification
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  payout_winners     │ → Distribute prizes
└─────────────────────┘
```

## Testing with Large Participant Counts

To test with 20,000 participants:

1. Create 20,000 test wallets
2. Each wallet enters lottery
3. Take snapshot
4. Run Helius indexer (with API key for speed)
5. Verify winners and payout

## Files Created

- ✅ `scripts/helius-winner-indexer.js` - Main indexer
- ✅ `scripts/participant-account-helper.js` - Helper utilities
- ✅ `scripts/README-HELIUS.md` - Detailed documentation
- ✅ `SCALABLE_ARCHITECTURE.md` - Architecture overview

## Next Steps

1. ✅ Scalable architecture implemented
2. ✅ Helius indexer created
3. ⏳ Deploy updated program
4. ⏳ Test with large participant counts
5. ⏳ Production deployment

## Support

- Helius Docs: https://www.helius.dev/docs
- Helius Pricing: https://www.helius.dev/pricing
- Free tier: 100k requests/month (sufficient for testing)


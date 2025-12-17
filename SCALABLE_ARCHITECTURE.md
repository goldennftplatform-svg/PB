# Scalable Lottery Architecture - 20,000+ Participants

## Overview

The lottery has been refactored to support **20,000+ participants** by using **separate PDA accounts** for each participant instead of storing all participants in a single account.

## Architecture Changes

### Before (Limited Scale)
- All participants stored in `Lottery.participants: Vec<Participant>` 
- Limited to ~100 participants due to account size constraints
- All participant data loaded into memory for each transaction

### After (Scalable)
- Each participant has their own **PDA account**: `ParticipantAccount`
- Lottery account only stores **aggregate data**:
  - `total_participants: u64`
  - `total_tickets: u64`
  - Metadata (jackpot, timing, etc.)
- **No account size limits** - can scale to 20,000+ participants

## Participant Account Structure

```rust
#[account]
pub struct ParticipantAccount {
    pub lottery: Pubkey,        // Which lottery this belongs to
    pub wallet: Pubkey,          // Participant's wallet
    pub ticket_count: u32,       // Total tickets for this participant
    pub usd_value: u64,          // Total USD value contributed
    pub entry_time: i64,         // First entry timestamp
}
```

**PDA Derivation:**
```
seeds = [b"participant", lottery_pda, participant_wallet]
```

Each participant account is a unique PDA, so:
- ✅ No collisions
- ✅ Automatic aggregation (same wallet = same PDA)
- ✅ Scales infinitely

## Entry Methods

### 1. New Participants: `enter_lottery_with_usd_value` / `enter_lottery`
- Creates a new `ParticipantAccount` PDA
- Increments `lottery.total_participants`
- Adds tickets to `lottery.total_tickets`

**Note:** This will fail if the participant account already exists. Use `update_participant_tickets` for subsequent entries.

### 2. Existing Participants: `update_participant_tickets`
- Updates existing `ParticipantAccount`
- Adds more tickets and USD value
- Updates `lottery.total_tickets`

## Client-Side Entry Logic

Since `enter_lottery` uses `init` (which fails if account exists), clients should:

```javascript
try {
    // Try to enter as new participant
    await program.methods.enterLotteryWithUsdValue(usdValue)
        .accounts({...})
        .rpc();
} catch (error) {
    if (error.message.includes('already in use')) {
        // Account exists, update instead
        await program.methods.updateParticipantTickets(ticketCount, usdValue)
            .accounts({...})
            .rpc();
    } else {
        throw error;
    }
}
```

## Winner Selection (Snapshot)

For 20,000 participants, loading all accounts in one transaction is impossible. Solution:

### Two-Phase Approach:

1. **Phase 1: `take_snapshot`**
   - Calculates deterministic `snapshot_seed` from blockchain state
   - Stores seed on-chain
   - Resets participant counters for next round
   - **Off-chain indexer** uses seed to find winners

2. **Phase 2: `set_winners`** (Admin)
   - Off-chain indexer calculates winners based on `snapshot_seed`
   - Admin calls `set_winners` with calculated winners
   - On-chain verification ensures winners are valid

### Off-Chain Indexer Requirements

The indexer needs to:
1. Monitor all `ParticipantAccount` PDAs
2. Track ticket counts for each participant
3. When snapshot occurs, use `snapshot_seed` to deterministically select winners
4. Calculate weighted selection based on ticket counts

**Example Winner Selection Logic:**
```javascript
// Pseudo-code for off-chain indexer
function selectWinners(participants, snapshotSeed, totalTickets) {
    // Main winner (weighted by tickets)
    const mainTicket = snapshotSeed % totalTickets;
    let accumulated = 0;
    let mainWinner = null;
    
    for (const participant of participants) {
        accumulated += participant.ticket_count;
        if (accumulated > mainTicket) {
            mainWinner = participant.wallet;
            break;
        }
    }
    
    // Minor winners (8 winners, excluding main)
    const minorWinners = [];
    let seed = snapshotSeed * 7;
    const available = participants.filter(p => p.wallet !== mainWinner);
    
    for (let i = 0; i < 8 && available.length > 0; i++) {
        const idx = seed % available.length;
        minorWinners.push(available[idx].wallet);
        available.splice(idx, 1);
        seed = seed * 13 + 1;
    }
    
    return { mainWinner, minorWinners };
}
```

## Benefits

1. **Unlimited Scale**: No account size limits
2. **Cost Efficient**: Each participant pays rent for their own account (~0.001 SOL)
3. **Parallel Processing**: Multiple participants can enter simultaneously
4. **Easy Indexing**: Off-chain indexers can efficiently query participant accounts
5. **Aggregation**: Same wallet automatically aggregates tickets (same PDA)

## Migration Notes

- Old lottery account structure is incompatible
- Need to close old account and reinitialize
- Existing participant data would need to be migrated (if any)

## Testing

To test with large participant counts:
1. Create 20,000 test wallets
2. Each wallet calls `enter_lottery_with_usd_value`
3. Verify `lottery.total_participants` reaches 20,000
4. Test snapshot and winner selection

## Next Steps

1. ✅ Separate participant accounts implemented
2. ✅ Lottery account refactored
3. ⏳ Create off-chain indexer for winner selection
4. ⏳ Update client scripts to handle entry logic
5. ⏳ Test with large participant counts


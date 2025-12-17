# 🚀 Implement Critical Upgrades - Step by Step

## ✅ Test Verification Complete

**Bot Test Results:**
- ✅ Revenue calculations verified: 8,163 SOL needed
- ✅ Tax structure working correctly: 2.45% to jackpot
- ✅ All 10 bots operational

## 🔧 Ready to Implement Upgrades

### Phase 1: Token Contract Upgrades (CRITICAL)

**File**: `programs/pepball-token/src/lib.rs`

**Upgrade 1**: Add pause check (Line 44)
```rust
// ADD AFTER: let token_info = &ctx.accounts.token_info;
require!(!token_info.is_paused, ErrorCode::TransfersPaused);
```

**Upgrade 2**: Add minimum transfer (Line 45)
```rust
// ADD AFTER pause check
require!(amount >= token_info.min_transfer_amount, ErrorCode::AmountTooSmall);
```

**Upgrade 3**: Validate tax calculation (After line 49)
```rust
// ADD AFTER: let total_tax = creator_tax + jackpot_tax;
require!(total_tax < amount, ErrorCode::InvalidTaxCalculation);
require!(total_tax > 0, ErrorCode::InvalidTaxCalculation);
```

**Upgrade 4**: Add min_transfer_amount to TokenInfo struct
```rust
// ADD TO TokenInfo struct (line 191):
pub min_transfer_amount: u64,
```

**Upgrade 5**: Initialize min_transfer_amount (Line 28)
```rust
// ADD TO initialize_token:
token_info.min_transfer_amount = 1000; // Prevent dust attacks
```

**Upgrade 6**: Add new error codes
```rust
// ADD TO ErrorCode enum:
#[msg("Transfer amount is too small")]
AmountTooSmall,
#[msg("Invalid tax calculation")]
InvalidTaxCalculation,
```

### Phase 2: Lottery Contract Upgrades (IMPORTANT)

**File**: `programs/lottery/src/lib.rs`

**Upgrade 1**: Fix deterministic winner selection (Replace lines 111-117)

**CURRENT (INSECURE)**:
```rust
lottery.winners.main_winner = Some(lottery.participants[0].wallet);
let mut minor: Vec<Pubkey> = Vec::with_capacity(5);
for i in 1..6 { minor.push(lottery.participants[i].wallet); }
lottery.winners.minor_winners.extend(minor);
```

**UPGRADED (RANDOM)**:
```rust
// Improved randomness using clock data
let seed = clock.slot
    .wrapping_mul(clock.unix_timestamp as u64)
    .wrapping_add(lottery.participants.len() as u64)
    .wrapping_add(lottery.total_snapshots);

// Weighted selection by ticket count
let total_tickets: u32 = lottery.participants.iter()
    .map(|p| p.ticket_count)
    .sum();

let main_winner_ticket = (seed % total_tickets as u64) as u32;
let mut accumulated = 0u32;
let mut main_winner_idx = 0;

for (idx, participant) in lottery.participants.iter().enumerate() {
    accumulated += participant.ticket_count;
    if accumulated > main_winner_ticket {
        main_winner_idx = idx;
        break;
    }
}

lottery.winners.main_winner = Some(lottery.participants[main_winner_idx].wallet);

// Select 5 minor winners (excluding main)
let mut minor_indices = Vec::new();
let mut remaining_seed = seed.wrapping_mul(7);

for _ in 0..5 {
    let available: Vec<usize> = (0..lottery.participants.len())
        .filter(|&i| i != main_winner_idx && !minor_indices.contains(&i))
        .collect();
    
    if available.is_empty() { break; }
    
    let winner_idx = available[(remaining_seed as usize) % available.len()];
    minor_indices.push(winner_idx);
    remaining_seed = remaining_seed.wrapping_mul(13).wrapping_add(1);
}

let mut minor_winners = Vec::with_capacity(5);
for idx in minor_indices {
    minor_winners.push(lottery.participants[idx].wallet);
}
lottery.winners.minor_winners = minor_winners;
```

## 📝 Implementation Steps

### Step 1: Backup Current Code
```bash
git add .
git commit -m "Backup before upgrades"
```

### Step 2: Apply Token Upgrades
1. Open `programs/pepball-token/src/lib.rs`
2. Apply upgrades 1-6 from Phase 1
3. Save file

### Step 3: Apply Lottery Upgrades
1. Open `programs/lottery/src/lib.rs`
2. Replace winner selection code (lines 111-117)
3. Save file

### Step 4: Build and Test
```bash
anchor build
anchor test --skip-build --provider.cluster devnet
```

### Step 5: Verify
```bash
# Run bot tests again
node scripts/smart-bot-test.js

# Check for errors
anchor build 2>&1 | findstr error
```

## 🧪 Testing Checklist

After implementing upgrades:

- [ ] Token transfers work normally
- [ ] Token transfers fail when paused
- [ ] Small transfers (<1000) are rejected
- [ ] Tax calculations validate correctly
- [ ] Lottery winner selection is random
- [ ] Multiple snapshots produce different winners
- [ ] Weighted selection favors higher ticket counts
- [ ] All existing tests pass
- [ ] Bot tests still work

## ⚠️ Important Notes

1. **Backup First**: Always commit before making changes
2. **Test Thoroughly**: Run all tests after each upgrade
3. **Deploy Carefully**: Test on devnet before mainnet
4. **Keep Old Versions**: Don't delete upgraded files yet

## 🔄 Rollback Plan

If something breaks:
```bash
git restore programs/pepball-token/src/lib.rs
git restore programs/lottery/src/lib.rs
anchor build
```

---

**Ready to implement? Start with Phase 1 upgrades!**



















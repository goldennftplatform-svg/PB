# 🧪 Contract Upgrade Test Plan

## Test Verification Complete ✅

**Bot Test Results:**
- ✅ Calculations verified (8,163 SOL needed for 200 SOL threshold)
- ✅ Tax structure working correctly (2.45% to jackpot)
- ✅ Transaction tracking accurate

## Upgrade Priority Implementation

### Phase 1: Critical Security Fixes (Test First)

1. **Token Contract - Add Pause Check**
   - Current: `transfer_with_tax` doesn't check pause status
   - Risk: Transfers can continue during pause
   - Fix: Add `require!(!token_info.is_paused, ErrorCode::TransfersPaused);`

2. **Token Contract - Add Minimum Transfer**
   - Current: No minimum, allows dust attacks
   - Risk: Spam transactions, gas waste
   - Fix: Add `require!(amount >= token_info.min_transfer_amount, ErrorCode::AmountTooSmall);`

3. **Token Contract - Validate Tax Calculation**
   - Current: No validation tax < amount
   - Risk: Edge case errors
   - Fix: Add validation checks

### Phase 2: Lottery Improvements (Test Second)

4. **Lottery - Fix Deterministic Winner Selection**
   - Current: Always picks first participant
   - Risk: Predictable, not fair
   - Fix: Use clock + blockhash for randomness

5. **Lottery - Weighted Winner Selection**
   - Current: Equal weight for all
   - Better: Weight by ticket count

6. **Lottery - Real SOL Payouts**
   - Current: Tracking only
   - Fix: Actual SOL transfers

## Testing Strategy

### Step 1: Test Current Contracts
```bash
# Run full test suite
anchor test --skip-build --provider.cluster devnet

# Run bot tests
node scripts/smart-bot-test.js

# Verify revenue calculations
node scripts/calculate-revenue-needed.js
```

### Step 2: Apply Upgrades
1. Create upgrade branch
2. Apply Phase 1 fixes
3. Build and test
4. Apply Phase 2 improvements
5. Test again

### Step 3: Regression Testing
- Test all existing functionality
- Verify no breaking changes
- Test edge cases

### Step 4: Deploy to Devnet
- Deploy upgraded contracts
- Run integration tests
- Monitor for issues

## Test Cases

### Token Contract Tests
- [ ] Transfer works when not paused
- [ ] Transfer fails when paused
- [ ] Transfer fails if amount < minimum
- [ ] Tax calculation validates correctly
- [ ] Creator tax goes to correct address
- [ ] Jackpot tax goes to lottery pool

### Lottery Contract Tests
- [ ] Winner selection is random (not deterministic)
- [ ] Weighted selection works correctly
- [ ] SOL payouts execute successfully
- [ ] Snapshot timing works (72h/48h)
- [ ] Minimum participants enforced (6+)

### Integration Tests
- [ ] Full flow: Buy → Enter Lottery → Snapshot → Payout
- [ ] Tax accumulation reaches 200 SOL threshold
- [ ] Fast mode activates correctly
- [ ] Multiple simultaneous transactions

## Performance Benchmarks

Track these metrics before/after upgrades:
- Compute units per transaction
- Transaction success rate
- Gas costs
- Time to execute

## Rollback Plan

If upgrades fail:
1. Keep old program IDs
2. Revert to previous version
3. Analyze failures
4. Fix and retest

---

**Ready to proceed with Phase 1 critical fixes?**




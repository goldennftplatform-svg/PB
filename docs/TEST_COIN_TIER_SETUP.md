# Test coin tier setup (0.50 / 1 / 5 USDC → same ratio as $20 / $100 / $500)

Use **test coin** (e.g. USDC on devnet) with smaller amounts that map to the **same 1 / 4 / 10 ticket** logic as production.

## Same ratio

| Production (USD) | Tickets | Test (USDC) | Cents | Tickets |
|-----------------|--------|------------|-------|--------|
| $20–$99.99      | 1      | $0.50      | 50    | 1      |
| $100–$499.99    | 4      | $1.00      | 100   | 4      |
| $500+           | 10     | $5.00      | 500   | 10     |

## Initialize lottery for test coin

When initializing the lottery for test coin, pass tier thresholds in **cents**:

- `entry_min_cents`: **50** (min for 1 ticket; $0.50 USDC)
- `tier2_min_cents`: **100** (min for 4 tickets; $1 USDC)
- `tier3_min_cents`: **500** (min for 10 tickets; $5 USDC)

Example (Anchor/JS):

```js
await program.methods
  .initializeLottery(
    new anchor.BN(jackpotLamports),
    new anchor.BN(50),   // 0.50 USDC → 1 ticket
    new anchor.BN(100),  // 1 USDC → 4 tickets
    new anchor.BN(500)   // 5 USDC → 10 tickets
  )
  .accounts({ lottery, admin, systemProgram })
  .rpc();
```

## If lottery already exists (e.g. devnet)

Use the admin instruction to switch to test tiers without re-initializing:

```js
await program.methods
  .setTierThresholds(
    new anchor.BN(50),
    new anchor.BN(100),
    new anchor.BN(500)
  )
  .accounts({ lottery: lotteryPDA, admin: adminKeypair.publicKey })
  .signers([adminKeypair])
  .rpc();
```

Then enter with USDC value in **cents**: 50, 100, 500 for 1, 4, 10 tickets. Run snapshot/payout as usual to verify logic.

## Production init

Production uses:

- `entry_min_cents`: **2000** ($20)
- `tier2_min_cents`: **10000** ($100)
- `tier3_min_cents**: **50000** ($500)

All existing init scripts use these by default.

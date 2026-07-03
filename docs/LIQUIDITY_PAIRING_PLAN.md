# Liquidity pairing plan — Orca pools + Jupiter routing

**Cluster for rehearsal:** Solana **devnet** (project “testnet”). Mainnet uses the same pool topology with real SOL.

Related: [MASTER_LAUNCH_ARCHITECTURE.md](./MASTER_LAUNCH_ARCHITECTURE.md), [DEVNET_TRIO_PROOF.md](./DEVNET_TRIO_PROOF.md), [SNAPSHOT_MEME_CALLOUT.md](./SNAPSHOT_MEME_CALLOUT.md)

**Rules:** Jackpot = **pure SOL**. **ODD = payout · EVEN = rollover**. Eligibility = combined USD across registry mints at snapshot.

---

## Token graph (4 unique mints)

| Symbol | Registry field | Pool needed? |
|--------|----------------|--------------|
| **PBALL** | `master_mint` = `trix_yin_mint` | Yes — canonical game token |
| **PUMP** | `pump_shell_mint` | Yes — pump surface |
| **TRIX_YANG** | `trix_yang_mint` | Yes — TRiX hype |
| **TRIX_BRIDGE** | `trix_bridge_mint` | Yes — 1:1 bridge |

Yin does **not** get a separate pool (same mint as PBALL).

---

## Launch pool set (6 pools)

Jupiter **routes** through pools you create on **Orca Whirlpool**. You do not “create Jupiter pairs.”

### Tier 1 — Required (~85% of LP budget)

| # | Pair | Venue | Purpose |
|---|------|-------|---------|
| 1 | **SOL / PBALL** | Orca Whirlpool (wide range) | Primary price discovery; tax harvest exit; deepest book |
| 2 | **SOL / PUMP** | Pump curve → graduate, or Orca | Pump chart liquidity |
| 3 | **SOL / TRIX_YANG** | Orca | TRiX attention surface |
| 4 | **SOL / TRIX_BRIDGE** | Orca (smaller) | Direct bridge access |

### Tier 2 — Peg & cross (~15% ops budget)

| # | Pair | Venue | Purpose |
|---|------|-------|---------|
| 5 | **PBALL / TRIX_BRIDGE** | Orca concentrated (±0.5–1%) | 1:1 peg maintenance |
| 6 | **PBALL / PUMP** | Orca thin, ops-rebalanced | Optional 1-hop between “doors” |

### Skip at launch

- PUMP / TRIX_YANG, PUMP / BRIDGE, YANG / BRIDGE — thin cross-pairs invite manipulation and bad oracle reads.

```
        SOL
       / | \
      /  |  \
  PBALL PUMP YANG
     \   |   /
      \  |  /
     BRIDGE
   PBALL—BRIDGE (tight peg)
   PBALL—PUMP (optional)
```

---

## Budget split (example: 100 SOL LP)

| Pool | % | Notes |
|------|---|--------|
| SOL / PBALL | 50% | Anchor pool |
| SOL / PUMP | 20% | After pump graduation or parallel Orca |
| SOL / TRIX_YANG | 15% | Hype chart |
| SOL / TRIX_BRIDGE | 10% | Smaller; pegged to PBALL |
| PBALL / TRIX_BRIDGE | 3% | Tight range only |
| PBALL / PUMP | 2% | Add only if cross-volume justifies |

Phase 1: manual `lp_ops` wallet ([GAME_DAY_WALLETS.md](../v2turbo/docs/GAME_DAY_WALLETS.md)). On-chain `lp-manager` Orca CPI is not wired yet.

---

## Snapshot USD oracle (anti–liquidity-trick)

Holdings at snapshot — **not** wash volume — determine tickets. Price inputs must resist thin-pool games:

| Mint | USD price source |
|------|------------------|
| PBALL | `TWAP(SOL/PBALL) × SOL/USD` from deepest SOL-anchored pool |
| PUMP | `TWAP(SOL/PUMP) × SOL/USD` |
| TRIX_YANG | `TWAP(SOL/TRIX_YANG) × SOL/USD` |
| TRIX_BRIDGE | `PBALL_USD × (peg_num / peg_den)` — **registry peg 1:1**, not thin cross-pool mid |

**Guards**

- Ignore pools below **50 SOL equivalent** depth for oracle.
- Never price BRIDGE off a 2 SOL PBALL/BRIDGE pool alone.
- Combined eligibility: sum across mints (dedupe yin = master) → tiers **1 / 2 / 4** at $20 / $100 / $500.

Math proof (no chain): `node scripts/verify-combined-eligibility.js`

---

## What devnet can vs cannot test

| Devnet ✅ | Devnet ❌ |
|-----------|-----------|
| Registry seal + `register_mints` | Pump.fun bonding curve + graduation |
| 1–2 Orca Whirlpools (SOL/PBALL, optional PBALL/BRIDGE) | Real arb / MEV / sandwich at scale |
| Jupiter single-hop (sparse routes) | 25k-player slippage |
| Combined eligibility math | `tax-harvest` DEX CPI (still TODO) |
| Manual floor buys with test SOL | Full 6-pool mainnet depth |

---

## Devnet rehearsal (minimal LP)

After programs deploy and registry is initialized:

1. **SOL / PBALL** — Orca devnet Whirlpool ([orca.so/whirlpools](https://www.orca.so/whirlpools), network = Devnet).
2. **(Optional) PBALL / TRIX_BRIDGE** — tight concentrated range for peg story.
3. Skip remaining four pools on devnet unless you need routing demos.

Use mints from `devnet/trio-mints.json` (created by `node scripts/create-devnet-trio-mints.js`).

```bash
solana config set --url devnet
node scripts/devnet-proof-status.js
node scripts/initialize-game-registry-devnet.js
# Orca UI: create SOL/PBALL with master_mint from trio-mints.json
```

Record pool addresses in local `devnet/lp-pools.json` (gitignored) — template in `devnet/lp-pools.example.json`.

---

## Mainnet launch sequence

1. Deploy + seal **GameRegistry** with all four mint CAs.
2. **SOL / PBALL** first — set initial price.
3. Pump launch — own SOL path (curve → graduate).
4. TRiX yang + bridge — SOL pools on Orca.
5. **PBALL / TRIX_BRIDGE** peg pool (small, concentrated).
6. **PBALL / PUMP** only if cross-volume justifies.
7. Publish pool addresses in `launch-manifest.json` (public only, no keys).
8. Snapshot service uses oracle rules above.

---

## Program roles

| Program | LP role |
|---------|---------|
| **game-registry** | Which mints count; peg 1:1 for bridge pricing |
| **lp-manager** | Future: fee conversion, jackpot drip (manual phase 1) |
| **tax-harvest** | Swap tax vault → SOL → jackpot (DEX CPI TODO) |
| **pepball-token** | 2.5% tax → vault |

---

## Quick commands

```bash
# Status
node scripts/devnet-proof-status.js

# Registry (after anchor deploy)
node scripts/initialize-game-registry-devnet.js
node scripts/initialize-game-registry-devnet.js --seal   # irreversible on that cluster

# Eligibility math
node scripts/verify-combined-eligibility.js
```

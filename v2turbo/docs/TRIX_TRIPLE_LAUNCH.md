# TRiX triple launch — vision & manual-first ops

**Platform:** [trix.market](https://trix.market) — Solana token deployer / fair-launch style pad (2026).

**Master architecture:** TRiX mints are **registered in `game-registry` before seal** — see [MASTER_LAUNCH_ARCHITECTURE.md](../../docs/MASTER_LAUNCH_ARCHITECTURE.md). No post-launch wiring.

**Goal:** Launch **three coins** as one marketing story (Yin/Yang + bridge), protect floors manually at first, harvest fees from all three into one jackpot — while the **lottery code** reads the **sealed registry**.

Related: [GAME_DAY_WALLETS.md](./GAME_DAY_WALLETS.md), [PROMPTME.md](../PROMPTME.md)

---

## The picture (why three coins)

| Coin | Role | Narrative |
|------|------|-----------|
| **Yang** (`trix_launch_yang`) | Attention shell | Fair launch hype, discovery, “what is this?” |
| **Yin** (`trix_launch_yin`) | 1B core PEPEBALL | The “real” game token — **lottery mint** (`VITE_PEPEBALL_MINT`) |
| **Bridge** (`trix_launch_bridge`) | 1:1 value fix | Players learn Yang ↔ Yin ↔ Bridge; secret-sauce mechanic |

One draw. One snapshot. One active lottery mint at a time — but **three surfaces** for traders to interact with and for you to harvest fees.

POC reference: a literal “powerball” clone hit **~$18M MC / ~7.7k players**. You’re building for **25k+** with a stickier story than clone #47.

---

## What stays simple in code

The app reads the **sealed GameRegistry PDA** for mints (target). Until frontend wiring lands, devnet uses env — **mainnet must not rely on post-launch env flip**.

```
game_registry PDA  →  master | pump | trix_* mints (immutable after seal)
lottery program    →  snapshot tiers 1/2/4 at $20/$100/$500
jackpot_tax        →  single fee sink
```

### Manual ops (phase 1)

1. Launch Pump shell + TRiX triple — record all mint CAs.
2. `register_mints` + `seal_registry` on game-registry (before public trading).
3. **Floor buy ops** — buy bottoms manually on each chart.
4. **LP ops** — add liquidity manually when ready.
5. **Fee harvest** — claim/swap fees from each coin → **fee_consolidation** → **jackpot_tax**.

Automate consolidation later (`harmonized-drip-settlement.js` pattern per mint). Don’t block launch on multi-mint automation.

---

## Manual game-day playbook (phase 1)

### Before launch

- [ ] Fresh SEC OP wallets for every role ([GAME_DAY_WALLETS.md](./GAME_DAY_WALLETS.md))
- [ ] `audit-no-wallet-secrets.js` PASS
- [ ] All mints registered + **registry sealed** ([MASTER_LAUNCH_ARCHITECTURE.md](../../docs/MASTER_LAUNCH_ARCHITECTURE.md))
- [ ] Document mints in `launch-manifest.json` + `public-registry.json` (public only)

### Launch day (Pump + TRiX → seal)

1. Deploy **master** via pepball-token (1B taxed).
2. Launch **Pump shell** (Yang) → mint CA.
3. Launch **TRiX** yang + bridge; **Yin = master mint**.
4. `register_mints` then **`seal_registry`** — no changes after this.
5. Point site at GameRegistry PDA (not post-launch env flip).

Use **separate hot wallets** per launch if TRiX allows — limits blast radius if one key leaks.

### Manual protection (your “secret sauce hottie” guardrails)

| Action | Wallet | Notes |
|--------|--------|-------|
| Buy dips on Yang/Yin/Bridge | `floor_buy_ops` | Small SOL; don’t use jackpot wallet |
| Add LP | `lp_ops` | Pair each with SOL; document pool addresses offline |
| Harvest fees (all 3) | `fee_consolidation` | Swap to SOL if needed |
| Forward to jackpot | `jackpot_tax` | Only T1 signs; verify address every time |

**Never** use T1 jackpot wallet for degen buys — if hot wallet gets drained, treasury survives.

### Lottery wiring

- Site points at **Yin** (or whichever you declare the game token).
- Snapshot reads **that mint only** at draw time.
- Bridge story can be “hold Yin OR swap Bridge 1:1” later — **not required for v1 test**.

---

## Phase 2 (when manual harvest hurts)

| Automation | Priority |
|------------|----------|
| Cron: read LP fee accounts for 3 mints | Medium |
| Swap fees → SOL → `fee_consolidation` | Medium |
| Scheduled sweep consolidation → `jackpot_tax` | High |
| Multi-mint USD aggregation for snapshot | Low (only if you want combined eligibility) |

Keep **one mint** for VRF entry until product demands combined holdings.

---

## TRiX-specific risks (eyes open)

- **Snipe wars** — fair launches can get heavily sniped; floor_buy_ops is reactive, not guaranteed.
- **Platform dependency** — if TRiX RPC/UI dies, launches still exist on-chain; ops continue via Jupiter/Raydium.
- **Three narratives** — confusion helps the game *if* Bridge is discoverable; hurts if all three look like unrelated rugs. Brand one **PEPEBALL** draw, three doors in.
- **Coding explosion** — resist wiring 3 mints into Poof policy until manual phase proves volume. Env flip + one mint is enough.

---

## SEC OP + triple launch

```
T0 cold_master     — backup of T1/T2 seeds, never online
T1 jackpot_tax     — payouts + final fee sink
T2 admin           — snapshot / settlement only
T3 fee_consolidation — tri-mint harvest parking lot
T4 hot             — trix launches, floor buys, LP, deployer
```

**IP / secret sauce:** Game rules (even/odd, ticket tiers, 1:1 bridge) live in PROMPTME + your head — not in a public repo branch with keys. Repo = mechanics code + **public** addresses only.

---

## Quick command reference

```bash
# Full SEC OP wallet set (dry run each first)
node scripts/game-day-create-wallet.js cold_master --dry-run
node scripts/game-day-create-wallet.js jackpot_tax --update-registry
node scripts/game-day-create-wallet.js admin --update-registry
node scripts/game-day-create-wallet.js fee_consolidation --update-registry
node scripts/game-day-create-wallet.js floor_buy_ops --update-registry
node scripts/game-day-create-wallet.js lp_ops --update-registry
node scripts/game-day-create-wallet.js trix_launch_yang --update-registry
node scripts/game-day-create-wallet.js trix_launch_yin --update-registry
node scripts/game-day-create-wallet.js trix_launch_bridge --update-registry
```

After TRiX deploy, paste mint CAs into `public-registry.json` manually (never keypairs).

---

*NFA. Manual ops first; automate fee consolidation when the three launches prove traction.*

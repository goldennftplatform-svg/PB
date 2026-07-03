# Devnet trio proof — simulate Pump + TRiX + master

Prove combined eligibility and registry wiring on **devnet** before you fund mainnet programs.

**Rules:** **ODD = payout · EVEN = rollover** · Meme callout = **rare** only.

---

## Quick start

```bash
# 1. Math (no chain)
node scripts/verify-combined-eligibility.js

# 2. Devnet wallet
solana config set --url devnet
solana airdrop 2

# 3. Create 4 simulated SPL mints (master + pump + trix yang + trix bridge)
node scripts/create-devnet-trio-mints.js

# 4. Check status
node scripts/devnet-proof-status.js

# 5. Deploy programs (needs Anchor — WSL recommended)
anchor build
anchor deploy --provider.cluster devnet
```

Output: `devnet/trio-mints.json` (gitignored) — paste mints into `register_mints` when game-registry deploy lands.

---

## What the trio simulates

| Devnet mint | Production |
|-------------|------------|
| `master_mint` | pepball-token 1B taxed SPL |
| `pump_shell_mint` | pump.fun Yang |
| `trix_yang_mint` | trix.market hype coin |
| `trix_bridge_mint` | trix.market bridge |
| `trix_yin_mint` | **same as master** (enforced on-chain) |

---

## Proof checklist

- [ ] `verify-combined-eligibility.js` — all pass
- [ ] `create-devnet-trio-mints.js` — 4 mints on devnet
- [ ] `anchor deploy` — lottery + game-registry + tax_harvest (+ others)
- [ ] `initialize-game-registry-devnet.js` — register_mints (+ optional `--seal`)
- [ ] Orca devnet **SOL/PBALL** pool — [LIQUIDITY_PAIRING_PLAN.md](./LIQUIDITY_PAIRING_PLAN.md)
- [ ] Holdings snapshot test: combined $500 split → 4 tickets
- [ ] Draw test: Pepe **odd** → payout path, **even** → rollover
- [ ] (Optional rare) meme callout 10% buy + split 64 / 4.25×8 / 2 (one-and-done, no meme reserve)

---

## Funding programs

After deploy, programs need SOL for rent/txs. Use your **deployer** game-day wallet (T4) with devnet airdrop only — never mainnet keys on devnet scripts unless intentional.

| Program | Anchor name |
|---------|-------------|
| Game registry | `game_registry` |
| Lottery | `lottery` |
| Master token | `pepball_token` |
| Tax harvest | `tax_harvest` |
| LP manager | `lp_manager` |

---

## Registry + LP on devnet

```bash
# After game_registry deploys
node scripts/initialize-game-registry-devnet.js
# Optional irreversible seal (devnet rehearsal only)
node scripts/initialize-game-registry-devnet.js --seal
```

Minimal LP (Orca devnet): **SOL/PBALL** using `master_mint` from `trio-mints.json`. See [LIQUIDITY_PAIRING_PLAN.md](./LIQUIDITY_PAIRING_PLAN.md).

Record pool addresses in `devnet/lp-pools.json` (copy from `devnet/lp-pools.example.json`).

---

## Related

- [MASTER_LAUNCH_ARCHITECTURE.md](./MASTER_LAUNCH_ARCHITECTURE.md)
- [LIQUIDITY_PAIRING_PLAN.md](./LIQUIDITY_PAIRING_PLAN.md)
- [SNAPSHOT_MEME_CALLOUT.md](./SNAPSHOT_MEME_CALLOUT.md)

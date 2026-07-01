# Devnet go / no-go (before mainnet)

Run this checklist on **devnet** with **game-day wallets only**. When every **must** item is green, you are cleared for a ~$1k mainnet launch.

---

## Phase 0 — Wallets & opsec

| # | Test | Command / action | Pass? |
|---|------|------------------|-------|
| 0.1 | All roles created outside repo | `node scripts/game-day-create-wallet.js <role>` | ☐ |
| 0.2 | Public registry synced | `node scripts/sync-game-day-registry.js` | ☐ |
| 0.3 | Verify each role before fund | `node scripts/game-day-verify-wallet.js <role>` | ☐ |
| 0.4 | No secrets in repo | `node scripts/audit-no-wallet-secrets.js` | ☐ |
| 0.5 | Devnet test wallets gitignored | `devnet/tax-test-wallets/` in `.gitignore` | ☐ |

**Never fund** `FjbPun…` / `Hefy8…` / old session wallets on mainnet.

---

## Phase 1 — Programs (devnet)

| # | Test | Command | Pass? |
|---|------|---------|-------|
| 1.1 | Anchor build (lottery hardening) | `anchor build` (WSL) | ☐ |
| 1.2 | Deploy upgraded lottery | `anchor deploy --program-name lottery --provider.cluster devnet` | ☐ |
| 1.3 | All 5 programs live | `node scripts/devnet-proof-status.js` | ☐ |

---

## Phase 2 — Lottery wired to game-day admin

| # | Test | Command | Pass? |
|---|------|---------|-------|
| 2.1 | Close old lottery (old admin key) if needed | `node scripts/reinit-lottery-50-50.js` | ☐ |
| 2.2 | Init with **game-day admin** | `SOLANA_CLUSTER=devnet node scripts/init-lottery-game-day.js` | ☐ |
| 2.3 | Fund jackpot_tax + lottery PDA | manual / scripts | ☐ |
| 2.4 | **Full preflight** (ODD payout + SOL) | `node scripts/run-game-day-preflight.js` | ☐ |

Report: `devnet/game-day-preflight-report.json` → `outcome: ODD_PAYOUT_COMPLETE`

---

## Phase 3 — Registry & tax

| # | Test | Command | Pass? |
|---|------|---------|-------|
| 3.1 | Trio mints | `node scripts/create-devnet-trio-mints.js` | ☐ |
| 3.2 | Registry init + register | `node scripts/initialize-game-registry-devnet.js` | ☐ |
| 3.3 | Seal dry-run (devnet only) | `node scripts/initialize-game-registry-devnet.js --seal` | ☐ |
| 3.4 | Tax mint + pool | `node scripts/create-devnet-taxed-master-mint.js` + pool script | ☐ |
| 3.5 | Tax drip 24h unattended | cron `tax:withdraw` + `tax:drip` | ☐ |

---

## Phase 4 — Frontend

| # | Test | Action | Pass? |
|---|------|--------|-------|
| 4.1 | Vercel env = game-day pubkeys only | Dashboard → Environment Variables | ☐ |
| 4.2 | Replay shows last draw | Hard refresh live site | ☐ |
| 4.3 | Deployment Protection off | Settings → None | ☐ |

---

## Optional (full vision, not blocking $1k launch)

- Combined multi-mint holdings snapshot (`docs/SNAPSHOT_MEME_CALLOUT.md`)
- All 6 Orca pools on devnet (`docs/LIQUIDITY_PAIRING_PLAN.md`)
- On-chain tax-harvest DEX CPI (scripts path OK for v1)
- Meme callout rounds

---

## No-go triggers (stop)

- ❌ `audit-no-wallet-secrets` fails on tracked files
- ❌ Preflight ODD payout fails or SOL never reaches winner wallets
- ❌ Random wallet can still `take_snapshot` after lottery redeploy
- ❌ Settlement uses `id.json` instead of game-day `admin`
- ❌ Funding wallets without `game-day-verify-wallet.js` MATCH

---

## When green → mainnet

Follow **[MAINNET_GO_LIVE_CHECKLIST.md](./MAINNET_GO_LIVE_CHECKLIST.md)**.

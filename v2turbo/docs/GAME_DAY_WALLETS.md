# Game day wallets — SEC OP / no private keys in the repo

Production uses **all-new wallets** in a **compartmentalized security model**. The codebase stores **public addresses only**. Private keys live **outside** this repository — you backup and fortify locally.

**Secret sauce / IP:** Game mechanics and wallet topology are valuable. Treat T0–T2 keys like production credentials. Never paste seeds in chat, GitHub, Vercel, or Cursor logs.

Related: [SWITCH_TO_PRODUCTION_TOKEN.md](./SWITCH_TO_PRODUCTION_TOKEN.md), [TRIX_TRIPLE_LAUNCH.md](./TRIX_TRIPLE_LAUNCH.md), [PROMPTME.md](../PROMPTME.md)

---

## SEC OP — security tiers

| Tier | Role(s) | Exposure | Funding |
|------|---------|----------|---------|
| **T0** | `cold_master` | Offline / hardware only | **Never** for ops |
| **T1** | `jackpot_tax` | Minimal — payout signing | Fund only after verify + T0 backup |
| **T2** | `admin` | Snapshot / settlement | Small SOL for tx fees |
| **T3** | `fee_consolidation` | Receives tri-mint fee sweeps | Working balance only |
| **T4** | `deployer`, `floor_buy_ops`, `lp_ops`, `trix_launch_*` | Hot — launch, buys, LP | **Minimal** SOL; burnable |

**Principles:**

1. **All new wallets on game day** — no reuse of `FjbPun...` / `2QAQ...` or anything from old sessions.
2. **Separation of duties** — jackpot (T1) never does floor buys; hot wallets (T4) never hold jackpot SOL.
3. **Verify before fund** — every role: `game-day-verify-wallet.js` must MATCH.
4. **Compartmentalize** — compromise of one T4 wallet must not drain the draw treasury.
5. **Repo = pubkey only** — agents never commit, log, or echo private material.

---

## Wallet roles
| Role | Tier | Purpose | Repo / env |
|------|------|---------|------------|
| **cold_master** | T0 | Offline backup of critical keys | None — never in app |
| **deployer** | T4 | `anchor deploy`, one-time init | None |
| **jackpot_tax** | T1 | Tax + jackpot SOL; pays winners | `VITE_TAX_RECIPIENT` |
| **admin** | T2 | Snapshot, set winners, settlement | `ADMIN_ADDRESS` in constants |
| **fee_consolidation** | T3 | Park fees from all launch coins | None |
| **floor_buy_ops** | T4 | Manual floor buys on launch charts | None |
| **lp_ops** | T4 | Manual LP add/remove | None |
| **trix_launch_yang** | T4 | TRiX coin 1 — Yang / hype shell | Mint in local registry |
| **trix_launch_yin** | T4 | TRiX coin 2 — Yin / core PEPEBALL | `VITE_PEPEBALL_MINT` when live |
| **trix_launch_bridge** | T4 | TRiX coin 3 — 1:1 bridge / discovery | Mint in local registry |

Admin and jackpot **should be different pubkeys** when possible. Document both even if you later consolidate ops.
---

## Folder layout

```
game-day-wallets/
  public-registry.example.json   ← committed template (addresses null)
  public-registry.json         ← YOUR local copy (gitignored) — public addresses only
  .gitignore

%USERPROFILE%/pepeball-game-day/private/   ← default keypair location (OUTSIDE repo)
  jackpot_tax-keypair.json
  admin-keypair.json
  deployer-keypair.json
  ...
```

Override location: `GAME_DAY_WALLET_DIR=C:\your\secure\folder`

---

## Game day checklist (do in order)

### 1. Audit repo

```bash
node scripts/audit-no-wallet-secrets.js
```

Must pass before creating or funding wallets.

### 2. Copy registry template

```bash
copy game-day-wallets\public-registry.example.json game-day-wallets\public-registry.json
```

(`public-registry.json` is gitignored — stays on your machine.)

### 3. Create wallets (outside repo) — full SEC OP set

```bash
node scripts/game-day-create-wallet.js cold_master --update-registry
node scripts/game-day-create-wallet.js jackpot_tax --update-registry
node scripts/game-day-create-wallet.js admin --update-registry
node scripts/game-day-create-wallet.js fee_consolidation --update-registry
node scripts/game-day-create-wallet.js floor_buy_ops --update-registry
node scripts/game-day-create-wallet.js lp_ops --update-registry
```

TRiX triple launch (when ready):

```bash
node scripts/game-day-create-wallet.js trix_launch_yang --update-registry
node scripts/game-day-create-wallet.js trix_launch_yin --update-registry
node scripts/game-day-create-wallet.js trix_launch_bridge --update-registry
```

See [TRIX_TRIPLE_LAUNCH.md](./TRIX_TRIPLE_LAUNCH.md) for launch-day manual ops.
Dry run first:

```bash
node scripts/game-day-create-wallet.js jackpot_tax --dry-run
```

### 4. Back up keypairs (you)

Before any SOL:

- Import to Phantom **or** encrypted vault **or** offline backup
- Confirm you can sign from that backup
- **Never** paste private keys into chat, GitHub, Vercel, or Discord

### 5. Verify before funding

```bash
node scripts/game-day-verify-wallet.js jackpot_tax
node scripts/game-day-verify-wallet.js admin
```

Must show **MATCH** (or set expected address in `public-registry.json` first).

### 6. Wire public addresses only

**Vercel** (Production):

- `VITE_TAX_RECIPIENT` = jackpot_tax **public** address
- `VITE_PEPEBALL_MINT` = production token CA when ready

**Constants** (if admin pubkey changes):

- Update `ADMIN_ADDRESS` in `v2turbo/src/lib/constants.ts` and `partyserver/src/constants.ts`
- Redeploy

### 7. Fund only after verify

Send SOL only to addresses you verified in step 5. Check balance without keypair:

```bash
node scripts/check-jackpot-wallet-balance.js
```

(Uses legacy constant address — point script at new address via env or registry when switched.)

---

## Legacy addresses — do not fund blindly

These appear in old constants/docs from prior builds:

| Address | Note |
|---------|------|
| `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje` | Legacy jackpot default — replace on game day |
| `2QAQ367aBeHgCoHQwHo8x7ga34dANguG5Nu82Rs4ky42` | Legacy admin — replace on game day |

**Rule:** Never send SOL to any address until `game-day-verify-wallet.js` confirms **you** hold the keypair.

---

## What agents and scripts must never do

- Commit `*-keypair.json`, `id.json`, or Phantom export JSON
- Write keypairs under `POWERsol/` repo root (create script refuses this)
- Log `secretKey` or full keypair arrays
- Put private keys in `VITE_*` env vars (all `VITE_` are public in the browser bundle)
- Fund legacy hardcoded addresses without verification

---

## Scripts reference

| Script | Purpose |
|--------|---------|
| `scripts/game-day-create-wallet.js` | Generate role wallet **outside repo** |
| `scripts/game-day-verify-wallet.js` | Match keypair file → pubkey (no secret printed) |
| `scripts/audit-no-wallet-secrets.js` | Pre-flight scan for leaked keypairs |
| `scripts/check-jackpot-wallet-balance.js` | Read SOL balance (no key needed) |

---

## Yin/Yang + TRiX triple launch

Three coins on [trix.market](https://trix.market) (Yang / Yin / Bridge) are **marketing + fee harvest** layers. The lottery app still uses **one** `VITE_PEPEBALL_MINT` at snapshot (usually Yin).

Manual first: floor buys (`floor_buy_ops`) → LP (`lp_ops`) → harvest all three → `fee_consolidation` → `jackpot_tax`.

Full vision: [TRIX_TRIPLE_LAUNCH.md](./TRIX_TRIPLE_LAUNCH.md)
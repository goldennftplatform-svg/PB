# Option B — Your indexer, rented RPC

You own the **lottery backend** on a small VPS. Helius (or QuickNode) is only the pipe to Solana.

## Architecture

```
VPS (your worker)                    Paid RPC (Helius)
├── run-daemon.js          ───────►  getProgramAccounts
├── run-holder-scan.js               token holder scan
├── run-index-participants.js
├── publish-manifest.js
└── ~/pepeball-game-day/indexer/   (local DB: JSON files)
         │
         ▼
v2turbo/public/indexer-status-public.json  →  homepage "registered for draw"
```

## One-time setup

1. **Helius key** — [helius.dev](https://www.helius.dev) → devnet or mainnet RPC URL.
2. **Copy env** — `scripts/indexer/.env.example` → `~/pepeball-game-day/indexer/.env`
3. **Install deps** (on VPS):

   ```bash
   cd scripts && npm install
   ```

4. **Bind round** (after `round-ledger.js open-round`):

   ```bash
   npm run indexer:sync-round
   ```

5. **Start daemon** (pm2 recommended):

   ```bash
   export $(grep -v '^#' ~/pepeball-game-day/indexer/.env | xargs)
   npm run indexer:daemon
   ```

   Or with pm2:

   ```bash
   pm2 start scripts/indexer/run-daemon.js --name pepeball-indexer --cwd scripts
   ```

6. **Copy public status to site** — daemon writes `v2turbo/public/indexer-status-public.json`.  
   On VPS deploy, rsync that file to Vercel static assets or commit after each draw prep.

## Manual commands (game day)

| Step | Command |
|------|---------|
| Bind active round | `npm run indexer:sync-round` |
| Index on-chain entrants | `npm run indexer:participants` |
| Scan qualifying holders | `npm run indexer:holders` |
| Holders vs registered gap | `npm run indexer:gap` |
| After `take_snapshot` | `npm run indexer:manifest` |

## Draw-day order

1. `indexer:holders` + `indexer:participants` + `indexer:gap`
2. Announce gap wallets — they must **sign** `enter_lottery` (no relayer yet)
3. Admin `take_snapshot` on homepage
4. `indexer:participants` again
5. `indexer:manifest` → publish merkle root before `set_winners`
6. `set_winners` / payout (existing scripts)

## Data locations

| Path | Contents |
|------|----------|
| `~/pepeball-game-day/indexer/state.json` | Counters, round id, cross-check |
| `~/pepeball-game-day/indexer/rounds/<id>/participants.json` | Indexed entrants |
| `~/pepeball-game-day/indexer/rounds/<id>/qualified-holders.json` | Holder scan |
| `~/pepeball-game-day/indexer/rounds/<id>/registration-gap.json` | Not yet registered |
| `~/pepeball-game-day/indexer/rounds/<id>/manifests/draw-manifest.json` | Full entrant list + winners |

## Scale triggers

| Entrants | Action |
|----------|--------|
| &lt; 2k | Daemon + free/paid RPC OK |
| 2k–10k | Helius paid; holder scan every 1h |
| 10k–100k | Dedicated VPS 4GB+; holder scan off-peak; manifest before every payout |

## Known limits (honest)

- **Auto-entry** requires each wallet to **sign** on-chain. Holder scan finds who *should* register; gap report lists who has not.
- **Multi-round** participant PDAs persist — use `roundOpenedAt` filter + plan program `round_id` upgrade before round 2 at scale.
- **Prices** for eligibility scan use `STATIC_USD_PER_TOKEN` unless you set per-mint env vars — tune before mainnet draw.

## Env reference

See `scripts/indexer/.env.example`.

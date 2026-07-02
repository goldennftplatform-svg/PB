# PEPEBALL — Solana's on-chain Powerball

**Hold meme coins. Win pure SOL. ODD pays — EVEN rolls.**

On-chain lottery for Solana token holders: combined holdings across game mints qualify you for periodic draws. Winners receive **SOL** from a dedicated treasury — not more of the same bag. Pepe ball count 1–30 decides each round. **Provably fair. Auditable on Solscan.**

| | |
|---|---|
| **Live app** | [pb-n7kx.vercel.app](https://pb-n7kx.vercel.app) |
| **Info site** | [GitHub Pages](https://goldennftplatform-svg.github.io/PB/) (push `site/` to deploy) |
| **Repo** | [goldennftplatform-svg/PB](https://github.com/goldennftplatform-svg/PB) |

---

## Why it hits different

- **SOL jackpot** — real spendable lamports, not "prize tokens"
- **50/50 Pepe mechanic** — ODD = payout round · EVEN = rollover (hype compounds)
- **Combined ticket tiers** — $20 / $100 / $500 combined USD → 1 / 2 / 4 tickets (max 4, anti-gaming)
- **2.5% trade tax** — drips to jackpot bankroll
- **Round ledger** — fixed SOL commitment per round; rare meme bonuses use fixed token counts
- **Hardened on-chain admin** — game-day wallet only; random wallets can't snapshot

---

## Stack

| Layer | Tech |
|-------|------|
| Programs | Anchor/Rust — `lottery`, `game-registry`, `pepball-token`, `tax-harvest`, `lp-manager` |
| App | `v2turbo/` — React 19 + Vite + Poof/Tarobase, Phantom connect |
| Backend | `v2turbo/partyserver/` — realtime + RPC |
| Ops | `scripts/` — preflight, round ledger, tax drip, game-day wallets |

---

## Quick start (dev)

```bash
# Programs (WSL recommended)
anchor build

# Frontend
cd v2turbo && bun install && bun dev

# Game-day preflight (devnet)
node scripts/run-game-day-preflight.js

# Round ledger
node scripts/round-ledger.js open --sol 10
node scripts/round-ledger.js export-public
```

---

## Repo layout

| Path | Description |
|------|-------------|
| `programs/` | Anchor on-chain programs |
| `v2turbo/` | Live dashboard + partyserver |
| `site/` | **GitHub Pages info hub** — guides, rules, brand kit, verify |
| `scripts/` | Deploy, preflight, ledger, tax pipeline |
| `docs/` | Runbooks — mainnet checklist, round ledger, meme callouts |

---

## Key docs

- [Round ledger](docs/ROUND_LEDGER.md) — fixed SOL + meme accounting
- [Game rules (site)](site/guides/rules.html) — tiers, splits, ODD/EVEN
- [Brand kit](site/guides/brand.html) — soundbites for your launch content
- [Hall of Fame](site/leaderboard/index.html) — early winners & lore
- [Mainnet checklist](docs/MAINNET_GO_LIVE_CHECKLIST.md)
- [Devnet go/no-go](docs/DEVNET_GO_NO_GO.md)

---

## License

Private / unlicensed unless otherwise stated. Not financial advice.

# PEPEBALL — Solana Powerball Lottery

On-chain lottery for token holders: hold a minimum of the project token to be included in periodic draws. One draw for everyone; VRF-based fairness; payouts in SOL.

## Stack

- **Programs (Anchor/Rust):** `lottery`, `lp-manager`, `pepball-token`, `tax-harvest`
- **Frontend:** `v2turbo/` — React + Vite + Tarobase (Poof), Solana wallet connect
- **Backend:** `v2turbo/partyserver/` — Tarobase partyserver for realtime + RPC

## Quick start

```bash
# Build programs (WSL or Linux recommended for Anchor)
anchor build

# Frontend
cd v2turbo && bun install && bun dev
```

See [docs/](docs/) for deployment, mainnet, and token setup.

## Repo layout

| Path | Description |
|------|-------------|
| `programs/` | Anchor programs (lottery, LP, token, tax-harvest) |
| `v2turbo/` | Dashboard app + partyserver |
| `app/` | Legacy static dashboard |
| `scripts/` | Deployment, snapshot, and testing helpers |
| `docs/` | Deployment and operations docs |

## License

Private / unlicensed unless otherwise stated.

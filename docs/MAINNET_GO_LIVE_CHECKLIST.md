# Mainnet go-live checklist

**Budget:** ~15 SOL all-in (~$1k) is a solid lean launch.  
**Wallets:** All **new** game-day keys — see [v2turbo/docs/GAME_DAY_WALLETS.md](../v2turbo/docs/GAME_DAY_WALLETS.md).

Complete **[DEVNET_GO_NO_GO.md](./DEVNET_GO_NO_GO.md)** first.

---

## T-minus 7 days — devnet

```bash
node scripts/sync-game-day-registry.js
node scripts/audit-no-wallet-secrets.js
anchor build && anchor deploy --provider.cluster devnet   # WSL
SOLANA_CLUSTER=devnet node scripts/init-lottery-game-day.js
node scripts/run-game-day-preflight.js
```

---

## T-minus 1 day — config

### 1. Vercel (production env)

| Variable | Value |
|----------|--------|
| `VITE_ENV` | `LIVE` |
| `VITE_CHAIN` | `solana` |
| `VITE_RPC_URL` | Helius mainnet RPC |
| `VITE_PEPEBALL_MINT` | **production mint** (after launch) |
| `VITE_TAX_RECIPIENT` | `jackpot_tax` pubkey from registry |
| `ADMIN_ADDRESS` / constants | `admin` pubkey from registry |

Run `node scripts/sync-game-day-registry.js` and copy **addresses only** into Vercel.

### 2. SOL budget (~15 SOL)

| Wallet | SOL | Purpose |
|--------|-----|---------|
| deployer (T4) | 3–6 | Program deploy + inits |
| admin (T2) | 0.5 | Snapshots / settlement fees |
| jackpot_tax (T1) | 5–10 | Starting prize + tax bankroll |
| lp_ops (T4) | 2–5 | One Orca pool (optional) |

Verify before every transfer: `node scripts/game-day-verify-wallet.js <role>`

---

## Launch day — mainnet deploy (WSL)

```bash
solana config set --url mainnet-beta
anchor build
anchor deploy --provider.cluster mainnet
# Repeat per program if deploying stack: game_registry, pepball_token, lottery, tax_harvest, lp_manager
```

### Initialize (once)

```bash
SOLANA_CLUSTER=mainnet-beta JACKPOT_SOL=10 node scripts/init-lottery-game-day.js
node scripts/initialize-game-registry-devnet.js   # rename/adapt for mainnet mints
# --seal only when ALL mints final — irreversible
```

### Token

- Token-2022 @ 250 bps → `jackpot_tax` as withdraw authority  
- Or Pump.fun CA → set `VITE_PEPEBALL_MINT`  
- See [DEPLOY_MINT_TAX_AUTOMATION.md](./DEPLOY_MINT_TAX_AUTOMATION.md)

### LP

- One pool minimum: SOL / your mint on Orca  
- Full plan: [LIQUIDITY_PAIRING_PLAN.md](./LIQUIDITY_PAIRING_PLAN.md)

### First draw

1. Entries live (holders qualify via USD tiers)  
2. `take_snapshot` — **admin** signer only (after hardened build)  
3. ODD → index winners → `set_winners` → **jackpot_tax sends SOL** → `payout_winners`  
4. Script path: `node scripts/run-game-day-preflight.js` (adapt RPC to mainnet)

---

## Post-launch (first 24h)

- [ ] Tax cron: `tax:withdraw` + `tax:drip` every 15–30 min  
- [ ] Monitor jackpot_tax balance  
- [ ] Emergency pause tested on devnet (`emergency_pause_lottery`)  
- [ ] No private keys in logs / GitHub / Vercel  

---

## Do not

- Fund legacy `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje` without keypair proof  
- Seal registry with wrong mint  
- Use devnet program IDs on mainnet env  
- Skip preflight ODD payout proof  

---

## Quick links

- [MAINNET_DEPLOY_AND_SOL.md](./MAINNET_DEPLOY_AND_SOL.md) — deploy commands  
- [MASTER_LAUNCH_ARCHITECTURE.md](./MASTER_LAUNCH_ARCHITECTURE.md) — full stack  
- [NEVER_SEND_SOL_WITHOUT_KEYPAIR.md](./NEVER_SEND_SOL_WITHOUT_KEYPAIR.md)  

# RPC resilience and Helius AirShip

## If Helius goes down, you're exposed

Right now payout-related code and the app default to a **single RPC** (Helius). If that endpoint is down or rate-limits you, payouts and balance checks can fail.

### What we did

- **App (v2turbo):** `VITE_RPC_URL` is used as the single RPC. Set a backup in Vercel: e.g. `VITE_RPC_FALLBACK_URL` and use it in a future build if we add fallback logic in the frontend.
- **Scripts:** `scripts/lib/get-rpc-connection.js` exports `getRpcConnection()`: it tries `RPC_URL`, then `HELIUS_RPC_URL`, then `RPC_FALLBACK_URL`, then `VITE_RPC_URL`, then public `api.mainnet.solana.com`. Payout scripts (`send-sol-to-jackpot.js`, `harmonized-drip-settlement.js`) use it so they are not dependent on one provider.

### What you should do

1. **Add a second RPC in Vercel**  
   e.g. `VITE_RPC_FALLBACK_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_OTHER_KEY` or another provider (QuickNode, Triton, public). Use it when/if we add frontend fallback.
2. **Scripts:** Set env so at least two RPCs are available:
   - `RPC_URL` = primary (e.g. Helius)
   - `RPC_FALLBACK_URL` or `HELIUS_RPC_URL` = backup
3. **Cron payout jobs:** Run with fallback list so one failing RPC doesn’t block payouts.

---

## Helius AirShip and “decompress”

**AirShip** ([airship.helius.dev](https://airship.helius.dev), [decompress](https://airship.helius.dev/decompress)) is Helius’s tool for **ZK-compressed token airdrops** and for users to **view/claim compressed tokens** (see [Helius AirShip overview](https://helius.dev/docs/airship/overview)). It uses ZK compression so you can airdrop to many recipients at much lower cost (Merkle root, ~0.01 SOL for 10k recipients vs ~20 SOL for normal accounts).

- **Using AirShip / decompress** does **not** by itself make your **current SOL payout game** more “battle-tested.” It’s a different flow (compressed token claims vs. SOL or normal SPL payouts).
- It **does** make **token payouts** (e.g. airdropping your game token to many winners) cheaper and more scalable. So:
  - **SOL payouts (current):** Battle-test by using **multiple RPCs** (fallbacks above) and good error handling/retries.
  - **Token payouts (future):** If you switch to ZK-compressed token rewards, then using AirShip (and an RPC that supports DAS + ZK compression) would make those token payouts cheaper and more robust at scale; the “decompress” UI is for recipients to claim.

**Bottom line:** To avoid being exposed when “something dies at Helius,” add **RPC fallbacks** everywhere (app + scripts). Use **AirShip** when you want **compressed token** airdrops/claims; it doesn’t replace making your SOL payout path resilient with multiple RPCs.

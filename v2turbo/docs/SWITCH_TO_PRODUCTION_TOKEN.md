# Switch to production token (final site)

When you’re done testing mechanics with the proof token and have **minted your real game token**, the site uses it by **env only** — no code change, no PR. Same idea for the **jackpot/tax wallet**: point env at your new wallet so you’re locked and loaded and not reusing the old one.

---

## 1. You need

- **Production token mint address (CA)** — the contract address of the token you just minted.
- **New jackpot / tax wallet address** — the wallet that receives tax and holds jackpot SOL. Use a **new** wallet for production so you’re not reusing the old one (e.g. the 150 SOL you saw was from the previous setup).

---

## 2. Set env and redeploy

### Vercel (recommended for final site)

1. **Vercel** → your project → **Settings** → **Environment Variables**.
2. Add or edit **both**:
   - **`VITE_PEPEBALL_MINT`** = your new token CA (e.g. `Abc123...xyz`).
   - **`VITE_TAX_RECIPIENT`** = your **new** jackpot/tax wallet address (SOL payouts and tax go here). Using a fresh wallet for production avoids reusing the old one and keeps you secure.
3. **Redeploy** the Production deployment (Deployments → ⋮ → Redeploy).

That’s it. The app uses `VITE_PEPEBALL_MINT` everywhere (swap links, copy CA, token price, eligibility) and `VITE_TAX_RECIPIENT` for jackpot/tax destination. If unset, they fall back to proof mint and the current default wallet.

### Local / .env

In `v2turbo` create or edit `.env.production` (or `.env` for dev):

```bash
VITE_PEPEBALL_MINT=YourNewTokenMintAddressHere
VITE_TAX_RECIPIENT=YourNewJackpotTaxWalletAddress
```

Then run your usual build/deploy.

---

## 3. Optional (only if your token differs)

| Variable | When to set | Example |
|----------|-------------|--------|
| `VITE_TOKEN_DECIMALS` | Token is not 6 decimals | `9` |
| `VITE_MIN_HOLDING_TOKENS` | Min raw units to enter (default 1M) | `5000000` |
| `VITE_TOKEN_TAX_BPS` | Token has different tax (default 250 = 2.5%) | `300` |
| `VITE_TAX_RECIPIENT` | Jackpot/tax wallet is different | `YourWallet...` |

---

## 4. Checklist

- [ ] Mint production token and copy the **mint address (CA)**.
- [ ] Create or choose a **new** jackpot/tax wallet (don’t reuse the old one).
- [ ] Set **`VITE_PEPEBALL_MINT`** to the new token CA in Vercel (or .env).
- [ ] Set **`VITE_TAX_RECIPIENT`** to the new jackpot/tax wallet address.
- [ ] Redeploy.
- [ ] Confirm site: “Get $PBALL”, swap widget, and copy CA use the new token.
- [ ] Ensure whatever updates Tarobase `jackpot/main` uses the new wallet/PDA so the displayed jackpot is correct.
- [ ] Admin panel will show “Production (locked)” when mint ≠ proof mint.

No code changes and no need to “add the new contract to the code” — the token and jackpot wallet are wired through these env vars.

---

## 5. Where does “150 SOL” (jackpot) come from?

The **displayed** jackpot on the site is read from the **Tarobase** collection `jackpot/main` (balance in lamports). That document is updated by your backend/cron or by a script that pushes the real balance (e.g. lottery PDA or your jackpot wallet) into Tarobase. When you switch to your **new** jackpot wallet and new token:

- Set **`VITE_TAX_RECIPIENT`** to the new wallet so the app and scripts know where payouts go.
- Ensure whatever **writes** the `jackpot/main` document (e.g. partyserver, API, or a sync script) uses the **new** wallet or lottery PDA balance so the number on the site matches reality. The frontend does not read the chain directly for the big jackpot number — it only shows what’s in Tarobase.

---

## 6. Keypairs and “exotic” storage

In this repo, **no keypair is stored in exotic or hidden places**. Scripts that need a signer load keypairs only from:

- Default Solana CLI: `~/.config/solana/id.json` (or `%USERPROFILE%\.config\solana\id.json` on Windows), or
- Explicit paths like `wallet.json`, `ANCHOR_WALLET`, or files under `wallet-backups/` / `speed-run-wallets/`.

The **jackpot/tax wallet** is only a **public address** in env (`VITE_TAX_RECIPIENT`). The site and app never have its private key. If that wallet was created in Phantom (or elsewhere), the keypair exists only where you exported or backed it up — not in the codebase. The “automated wallet function” you used before would have written the keypair only to whatever path that script used (e.g. a JSON file); there is no secret stash in the repo.

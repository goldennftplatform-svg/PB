# Mainnet go-live: new coin → CA → program deploy (WSL)

Use this order so your new token and lottery are live on mainnet. **Assume WSL on your PC** for building and deploying the program.

---

## 1. Commit & push (done)

Your latest changes (configurable tiers, test-coin support) are committed and pushed.

---

## 2. Create your new coin (Pump.fun)

1. **Open Pump.fun**  
   https://pump.fun  

2. **Connect wallet**  
   Use the wallet you want as creator (can be the same as jackpot admin or a separate one).

3. **Create token**  
   - **Name** – e.g. PEPEBALL  
   - **Symbol** – e.g. PBALL or $PBALL  
   - **Description** – short blurb  
   - **Image** – upload your logo (square works best)  
   - **Token type** – standard SPL (or Token-2022 if you want transfer fee)  
   - **Tax (if supported)** – 2.5% (250 bps) to your **jackpot/tax wallet**:  
     `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje`  

4. **Launch / create**  
   Pump.fun will mint the token and set up the bonding curve. After creation you get:
   - **Token mint address (CA)** – copy this; you’ll use it everywhere below.
   - **Token page URL** – for “Buy” links and socials.

5. **Note**
   - If Pump.fun doesn’t let you set a custom tax recipient, you may need to use a token with **no tax** on Pump.fun and handle tax elsewhere, or use a different token creator that supports a fee receiver. Your lottery program is **token-agnostic**; it only cares about the mint address you put in config.

---

## 3. Put the new CA into config (“upload CA into the program”)

The lottery **program** does not store the token mint on-chain. You “upload” the CA by **config** only.

### A. Scripts (Node, cron, backend)

Set env (or `.env` in repo root / where you run scripts):

```bash
# New token mint (CA from Pump.fun)
export PEPEBALL_MINT=<YOUR_NEW_MINT_ADDRESS>
# Or for scripts that read VITE_*:
export VITE_PEPEBALL_MINT=<YOUR_NEW_MINT_ADDRESS>

# Jackpot = tax recipient (unchanged if same wallet)
export TAX_RECIPIENT_ADDRESS=FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje
export VITE_TAX_RECIPIENT=FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje

# Optional: match your token
export TOKEN_TAX_BPS=250
export TOKEN_DECIMALS=6
```

Scripts that use `scripts/lib/token-config.js` will pick these up.

### B. Frontend (v2turbo / Vercel)

In **Vercel** (or your host) set **Environment Variables** for Production:

| Variable               | Value                          |
|------------------------|--------------------------------|
| `VITE_PEPEBALL_MINT`   | **Your new token CA**          |
| `VITE_TAX_RECIPIENT`   | `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje` |
| `VITE_TOKEN_TAX_BPS`   | `250`                          |
| `VITE_TOKEN_DECIMALS`  | `6` or `9`                     |
| `VITE_LOTTERY_PROGRAM_ID` | `8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7` (after deploy) |
| `VITE_LOTTERY_PDA`     | `ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb` |

Then **redeploy** the frontend so it uses the new CA.

### C. Optional: hardcode for a single mainnet token

If you prefer not to rely on env in code:

- **Scripts:** edit `scripts/lib/token-config.js` and set `defaultMint` to your new CA.
- **v2turbo:** edit `v2turbo/src/lib/constants.ts` and set `PROOF_MINT` / `PEPEBALL_MINT` (and related) to your new CA.

---

## 4. Build and deploy the program (WSL)

Do this **from WSL** on your PC.

### 4.1 Open WSL and go to repo

```bash
cd /mnt/c/Users/PreSafu/Desktop/POWERsol
```

### 4.2 Solana CLI → mainnet

```bash
solana config set --url mainnet-beta
solana address
solana balance
```

Use the keypair that will **pay for deploy** (e.g. `~/.config/solana/id.json`). Ensure it has enough SOL (~2–3 SOL for deploy).

### 4.3 Anchor version

```bash
anchor --version
# Use 0.30.x / 0.31.x to match Anchor.toml
```

If you need a specific version, install it in WSL (see project WSL/Anchor docs).

### 4.4 Build

```bash
anchor clean
anchor build
```

If build fails, see `WSL_BUILD_INSTRUCTIONS.md` and `WSL_BUILD_TROUBLESHOOTING.md`.

### 4.5 Deploy lottery program to mainnet

```bash
anchor deploy --provider.cluster mainnet
```

If your `Anchor.toml` lists multiple programs, deploy only lottery:

```bash
anchor deploy --program-name lottery --provider.cluster mainnet
```

Confirm the program ID in the output (e.g. `8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7` if you reused the same program keypair).

### 4.6 (Optional) Deploy other programs

If you have `lp-manager`, `pepball-token`, etc., deploy them the same way:

```bash
anchor deploy --program-name lp-manager --provider.cluster mainnet
# etc.
```

---

## 5. Initialize lottery on mainnet (once)

If this is a **fresh** mainnet deploy, initialize the lottery **once** with the **admin** = jackpot wallet (so that wallet can run snapshot/payout).

From WSL or from Windows (with same env):

```bash
# Use mainnet RPC
export RPC_URL=https://api.mainnet.solana.com
# Or Helius: export RPC_URL=https://mainnet.helius-rpc.com/?api_key=YOUR_KEY

# Admin = jackpot wallet keypair (must sign init)
export ANCHOR_WALLET=/path/to/jackpot-wallet-keypair.json

# From repo root (Node; requires IDL from anchor build)
node scripts/simple-init-lottery.js
```

Or with Anchor/TS and mainnet:

- Pass `entry_min_cents: 2000`, `tier2_min_cents: 10000`, `tier3_min_cents: 50000` for **production** tiers ($20 / $100 / $500 → 1 / 4 / 10 tickets).

If the lottery is **already** initialized (e.g. you closed and re-initialized before), skip this step.

---

## 6. Send SOL to jackpot and run scripts

- Send SOL to **FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje** (or your jackpot wallet).
- Run snapshot/payout with **mainnet RPC** and the **jackpot wallet keypair** as signer (see `docs/MAINNET_DEPLOY_AND_SOL.md`).

---

## Quick checklist

| Step | Action |
|------|--------|
| 1 | Commit & push ✅ |
| 2 | Create new coin on Pump.fun → copy **CA** |
| 3a | Set `PEPEBALL_MINT` / `VITE_PEPEBALL_MINT` (and related) for scripts |
| 3b | Set Vercel env `VITE_PEPEBALL_MINT` (and related) → redeploy app |
| 4 | In WSL: `anchor build` then `anchor deploy --provider.cluster mainnet` |
| 5 | Initialize lottery on mainnet once (if needed) with admin = jackpot wallet |
| 6 | Fund jackpot wallet, run snapshot/payout on mainnet |

---

## Summary

- **New coin** = create on Pump.fun (or other), get **mint address (CA)**.
- **“Upload CA into the program”** = set CA in **env and frontend config** (and optionally in `token-config.js` / `constants.ts`); no on-chain program change.
- **Upload program** = in **WSL**: `anchor build` then `anchor deploy --provider.cluster mainnet`, then once init lottery with admin = jackpot wallet.

After that, your new token and lottery are live on mainnet.

# One Program Deploy, Pivot to New Token via Config

You only deploy the **lottery program once** to mainnet. The program is token-agnostic (no mint or tax on-chain). To switch to your new token you change config and point scripts/app at the new mint — no second program deploy.

## Cost order

1. **Once:** Deploy lottery program to mainnet (~1.5–2.5 SOL).
2. **When ready:** Create your new token (e.g. Pump.fun or Metaplex) with **2.5% tax** (250 bps) to your jackpot wallet `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje` (or your chosen tax recipient). Token creation cost is separate and small.
3. **Pivot:** Set env vars and redeploy the **app** (Vercel) and/or set env for scripts. No second **program** deploy.

## Pivot to new token

### Frontend (Vercel / v2turbo)

In Vercel (or `.env.production`), set:

- `VITE_PEPEBALL_MINT` = your new token contract address  
- `VITE_TAX_RECIPIENT` = wallet that receives tax (can stay `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje`)  
- `VITE_TOKEN_TAX_BPS` = `250` (2.5%)  
- `VITE_TOKEN_DECIMALS` = `6` or `9` (your token decimals)  
- `VITE_MIN_HOLDING_TOKENS` = min raw units to enter (e.g. `1000000` for 1 token at 6 decimals)

Redeploy the app. Same program, new token.

### Scripts (drip, send-sol, etc.)

Set env when running scripts (or in a `.env` file):

- `PEPEBALL_MINT` or `VITE_PEPEBALL_MINT` = new token CA  
- `TAX_RECIPIENT_ADDRESS` or `VITE_TAX_RECIPIENT` = jackpot/tax wallet  
- `TOKEN_TAX_BPS` = `250`  
- `TOKEN_DECIMALS` = `6` or `9`

Scripts under `scripts/` that use `scripts/lib/token-config.js` (e.g. `harmonized-drip-settlement.js`, `send-sol-to-jackpot.js`) will use these values.

### Party server / backend

If you run partyserver or any backend that has its own constants, point its token mint and tax recipient to the new CA and wallet (env or config). Same idea: config change, no program redeploy.

## New token checklist

- Create token with **2.5% tax** (250 bps) to your chosen tax recipient (e.g. `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje`).  
- Deploy lottery program **once** to mainnet.  
- Test with current (600+ holder) token if you want; same program.  
- When ready: create new token, set `VITE_PEPEBALL_MINT` (and optional env above), redeploy app and run scripts with new env. No second program deploy, so you keep total cost to one deploy plus token creation.

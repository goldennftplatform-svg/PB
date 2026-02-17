# v2turbo / POOF build status & live-token test plan

## Build status

| Area | Status | Notes |
|------|--------|--------|
| **Data layer** | ✅ Done | jackpot, drawings, vrfDrawings, vrfEntries, vrfReveals, vrfSettlements, lotteryHouse, transfers, feeHarvests, etc. |
| **Policy (poof.policy.json)** | ✅ Done | Entry gated by `PEPEBALL_MINT` + `MIN_HOLDING_TOKENS`; admin settlement; VRF create/update rules |
| **Constants** | ✅ Done | `src/lib/constants.ts` + `partyserver/src/constants.ts` — mint, min holding, intervals, percents |
| **Static value** | ✅ Polished | `STATIC_USD_PER_TOKEN`, `tokensToStaticUsd()`, `staticUsdToTokenRaw()` in `src/lib/constants.ts` for display/eligibility |
| **Queries** | ✅ Done | tokenBalance, usdcBalance, jupiterSwapQuote, meteoraSwapQuote (ready for live price when you want it) |
| **Frontend** | ⚠️ Minimal | HomePage + WalletButton; no lottery UI yet — add screens that use the hooks/collections |

**Summary:** Backend and policy are in place. Static value is a single place to tweak; you can later switch to live (Jupiter/Meteora) by replacing uses of `tokensToStaticUsd` with a quote-based helper.

---

## What to test before launch

1. **Entry** – User holds ≥ `MIN_HOLDING_TOKENS` of the lottery token → can call `setVrfEntries(drawId_wallet, { wallet, idx })`. Policy checks balance on `PEPEBALL_MINT` (or whatever mint you set).
2. **Drawing** – Admin creates vrfDrawing; VRF reveal writes result; settlement pays winner + fees.
3. **Static value** – In UI: show balance in tokens and “~$X” via `tokensToStaticUsd(rawBalance)`. Tune `STATIC_USD_PER_TOKEN` for the token you use.

---

## Testing with a live token (sneaky / low-cost)

Goal: prove flow with a real token and small spend.

1. **Pick the token**  
   **Done.** Live test mint: `3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump` — wired in both `src/lib/constants.ts` and `partyserver/src/constants.ts`. “their coin” — paste the **mint address** (and optionally DexScreener/other link). We’ll wire that mint everywhere the app currently uses PEPEBALL.

2. **Swap constants to the live token**  
   - **Current (live test):** `PEPEBALL_MINT` / `TOKEN_MINT_ADDRESS` = `3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump`; `MIN_HOLDING_TOKENS` = `1000000` (1 token at 6 decimals); `TOKEN_DECIMALS` = 6; `STATIC_USD_PER_TOKEN` = 0.0001 (tune to real price if needed).
   - If this token uses different decimals, change `TOKEN_DECIMALS` and `MIN_HOLDING_TOKENS` in `src/lib/constants.ts` only (partyserver uses the string; frontend uses decimals for display).

3. **Static value for that token**  
   - In `src/lib/constants.ts` set **`STATIC_USD_PER_TOKEN`** to the approximate USD value of 1 token (so “~$X” and eligibility make sense).  
   - Optional: use **live price** (Jupiter or Meteora quote) instead of `tokensToStaticUsd()` when you’re ready.

4. **Sneaky / cheap**  
   - Use a small `MIN_HOLDING_TOKENS` so one small buy is enough to enter.  
   - Run one full cycle: enter → draw → reveal → settle, with minimal SOL/token spend.

5. **Revert for production**  
   - Switch mints and `MIN_HOLDING_TOKENS` back to your real token/levels when done testing.

---

## Where to change the mint (quick ref)

| File | What to change |
|------|----------------|
| `v2turbo/src/lib/constants.ts` | `PEPEBALL_MINT`, `TOKEN_MINT_ADDRESS`, `STATIC_USD_PER_TOKEN`, `MIN_HOLDING_TOKENS` |
| `v2turbo/partyserver/src/constants.ts` | `PEPEBALL_MINT`, `TOKEN_MINT_ADDRESS`, `MIN_HOLDING_TOKENS` |
| `v2turbo/src/lib/poof.policy.json` | Uses `@constants.PEPEBALL_MINT` and `@constants.MIN_HOLDING_TOKENS` — no edit if constants are updated. |
| `v2turbo/partyserver/src/poof.policy.json` | Same as above. |

Once you paste the coin (mint address or link), we can set the exact values and, if you want, a one-line “test mode” flag that uses the live token + low min **Live token is wired.** If the token uses other than 6 decimals, update TOKEN_DECIMALS and MIN_HOLDING_TOKENS; tune STATIC_USD_PER_TOKEN from DexScreener for accurate display.

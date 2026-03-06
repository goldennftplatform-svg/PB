# Deploy, Mint 1B, Tax, and Automation — Recap & Costs

---

## 1. Recap: Before deploy (test vs real coin)

- **Mint the 1B token** (Token-2022 or current SPL) with your chosen decimals (e.g. 6). That mint is your “test” or “real” coin depending on what you point the app at.
- **Hardcode that mint** in the app/scripts as the “current” token (e.g. `PEPEBALL_MINT` in env or constants). Frontend and lottery use this for price, eligibility, etc.
- **Flip to “real” later** = use a **different** mint (new 1B supply mint) and update config (env / constants) to that new mint. No need to change the lottery program; just point the site and scripts at the new mint. So: one program deploy, swap mint in config when you go from test → real.

---

## 2. Cost to mint 1 billion tokens (with 2.5% tax)

- **Minting itself** (create mint + mint 1B to supply): **Rent + tx fees only** — typically **&lt; 0.1 SOL** (often ~0.01–0.05 SOL). No “per-token” cost; it’s one (or a few) transactions.
- The **2.5% buy/sell tax** is **not** a cost you pay at mint. It’s taken **on each transfer/trade** (2.45% to jackpot, 0.05% creator). So there is no extra “cost to mint” for having that tax; the tax is applied when users trade.

**Summary:** Mint cost ≈ **&lt; 0.1 SOL**. The 2.5% is ongoing tax on volume, not a one-time fee.

---

## 3. Are the 2.5% taxes auto-deposited or manual?

It depends how the token is implemented.

### Option A: Current **pepball-token** (custom `transfer_with_tax`)

- Tax is sent to **`jackpot_pool`** (a token account you pass in) **only when** someone uses the program’s **`transfer_with_tax`** instruction.
- **DEXs (Jupiter, Meteora, etc.)** usually use **standard SPL transfer** (or their own AMM logic), **not** your custom instruction. So **on DEX trades, tax is often not applied** unless the DEX/router explicitly uses your program.
- There is **nothing to “withdraw” from Jupiter/Meteora** for this design — those UIs don’t hold your tax; your tax only exists when `transfer_with_tax` is used. So: **no “click to withdraw fees” on Jupiter/Meteora** for this path; the issue is that DEX volume may bypass the tax entirely.

### Option B: **Token-2022** with **Transfer Fee** extension

- The **token program** applies the fee **on every transfer** (including DEX swaps that move the token). So tax is **automatically** withheld; no one has to “click” on Jupiter/Meteora to get it.
- Withheld fees are tracked in Token-2022; a **withdraw authority** can **harvest** them (e.g. into a single token account or the mint). So:
  - **Tax collection:** automatic on every transfer.
  - **Moving withheld into your “jackpot” vault:** one or more **harvest/withdraw** transactions (by authority or a bot), not “withdraw from Jupiter/Meteora.”

**Conclusion:** With **Token-2022 transfer fee**, taxes are **auto** (no manual withdraw from DEX UIs). With **current pepball-token**, taxes only apply when your instruction is used, and DEX volume may not be taxed unless integrated.

---

## 4. Anticipating tax and a “sales bot” (randomizer, 10% slippage max)

You can anticipate tax accumulating and **automate selling** that token for SOL so the jackpot grows in SOL.

### On-chain: **tax-harvest** program (recommended)

- **`programs/tax-harvest`** is intended to: take token from the **vault** (authority = program PDA), **swap token → SOL**, then send **SOL to the jackpot address**. Right now the **DEX swap is a TODO** (no Meteora/Raydium CPI yet).
- Once DEX CPI is implemented:
  - Tax lands in the vault (from pepball-token’s `jackpot_pool` or from Token-2022 fee receiver pointed at this vault).
  - A **keeper/bot** (or anyone) calls **`process_harvest(amount)`**. The program does the swap and sends SOL to `jackpot_sol_dest`. No need to “click” anywhere; you just trigger the instruction.
- **Randomizer “sales bot”** can be **off-chain**:
  - Bot wakes every X minutes (e.g. 30–120, with some randomness).
  - Reads vault token balance; chooses an amount (e.g. 10–50% of balance, or a random % within a range).
  - Calls **`process_harvest(amount)`** (on-chain). The **on-chain** swap can use a **max slippage** (e.g. 10%) by passing a minimum SOL amount or using a DEX instruction that supports it.
  - So: **random timing + random-ish size**, **10% slippage max** in the swap logic — all doable once `process_harvest` has the DEX integration and a min_out or slippage parameter.

### Off-chain only (no harvest program)

- A bot holds (or signs for) the jackpot **token** account and calls **Jupiter/Meteora API** to swap token → SOL, with **10% slippage**, and sends SOL to the lottery/jackpot address. That’s “anticipating” tax by selling what’s already in the wallet. You can add randomness (e.g. random interval, random % of balance) in the bot. Automation = cron + script; no on-chain harvest program, but you need to secure the key that holds the tokens.

**Recommendation:** Implement the DEX CPI in **tax-harvest** and use a **small bot** that calls `process_harvest` with a random-ish amount and schedule; set **10% max slippage** in the swap (e.g. min SOL out).

---

## 5. How to automate end-to-end

| Step | How to automate |
|------|------------------|
| **Tax → jackpot token account** | **Token-2022 transfer fee**: automatic on every transfer. **pepball-token**: only when `transfer_with_tax` is used (DEX may bypass). Prefer Token-2022 for “tax auto-deposited.” |
| **Withdraw fees (Token-2022)** | Withdraw authority (or bot) calls Token-2022 **harvest/withdraw** so withheld fees end up in your vault (e.g. the same vault used by tax-harvest). Can be scripted/cron. |
| **Token → SOL for jackpot** | **Option 1:** Complete **tax-harvest** DEX CPI; bot calls **`process_harvest(amount)`** on a schedule (e.g. random 1–4 h), amount = random % of vault balance, 10% slippage max. **Option 2:** Off-chain bot that swaps via Jupiter/Meteora API, 10% slippage, SOL to jackpot. |
| **No manual “click on Jupiter/Meteora”** | With Token-2022 + harvest program + bot: tax is auto, harvest of withheld is scripted, swap is via `process_harvest` or API — no manual withdraw in the DEX UI. |

---

## 6. Short answers

- **Mint 1B + 2.5% tax:** Mint cost ≈ **&lt; 0.1 SOL**. The 2.5% is per-trade, not a one-time cost.
- **Tax auto or manual?** **Token-2022** → auto on every transfer; **current pepball-token** → only when your instruction is used (DEX often bypasses). Nothing is “withdrawn from Jupiter/Meteora” in the sense of a DEX UI button; with Token-2022, fees are withheld by the program and then harvested.
- **Randomizer sales bot, 10% slippage:** Yes. Implement swap in **tax-harvest** with 10% max slippage; run a bot that calls **`process_harvest`** with a random-ish amount and schedule. Alternatively, off-chain bot using Jupiter/Meteora API with 10% slippage.
- **Automate everything:** Use **Token-2022** for auto tax → vault; script harvest of withheld if needed; complete **tax-harvest** and run a **keeper** that calls **`process_harvest`** (or use an off-chain swap bot) so token is converted to SOL for the jackpot without you clicking anything.

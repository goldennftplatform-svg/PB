# Jackpot Wallet & Locked Harvest (Tax → SOL)

How tax gets to the jackpot **automatically** and how we make the conversion to SOL a **locked on-chain function** from that wallet.

---

## 1. How funds get to the jackpot wallet (automated)

### Option A: Current pepball-token program

- `transfer_with_tax` sends **jackpot_tax** (2.45%) to the account you pass as **`jackpot_pool`**.
- So tax is “auto sent” whenever anyone does a taxed transfer: they pass **`jackpot_pool`** = the token account that should receive the tax.
- To make that the “jackpot wallet” for a **locked** flow, **`jackpot_pool`** must be a token account whose **authority** is a PDA of a **harvest program** (see below). Then only that program can move tokens out.

### Option B: Token-2022 with transfer fee

- With Token-2022 **transfer fee** extension, the token program itself sends a % to a **fee receiver** on every transfer. No custom transfer needed.
- You set the fee receiver to the **same** token account used as the harvest vault (authority = harvest program PDA). Tax accumulation is then fully automatic; the harvest program only converts token → SOL.

---

## 2. Locked function from the jackpot wallet

Idea: the **jackpot wallet** (token account that holds the tax) is the **only** place that holds that token for the jackpot, and the **only** thing that can move it is one instruction: **sell token → SOL and send SOL to the jackpot**.

- **Who can move from the wallet:** only the **harvest program**, via a PDA that is the **authority** of that token account.
- **What that program does:** a single instruction, e.g. `process_harvest(amount)`:
  1. Check `amount` ≤ token balance of the vault.
  2. **CPI to a DEX** (Meteora DLMM, Raydium, etc.): sell `amount` of project token for SOL.
  3. **Transfer** the received SOL to a fixed **jackpot SOL address** (e.g. lottery vault or your designated wallet).

So the “locked” part is: **from the jackpot wallet, the only possible use of funds is this one function** (token → SOL → jackpot address). No other withdrawal or arbitrary transfer.

---

## 3. Who can trigger it

- **Permissionless:** anyone can call `process_harvest(amount)` (e.g. a crank, bot, or user). The program still only does the one thing: swap and send SOL to the fixed jackpot address.
- **Optional:** you can add a “harvest manager” or admin that must sign, but it’s not required for “locked” behavior; the important part is that the **only** thing the program does with the vault is this conversion.

---

## 4. Implementation in this repo

- **New program: `tax-harvest`** (in `programs/tax-harvest/`).
  - **Config account (PDA):** `jackpot_sol_dest` (where SOL is sent), optional `min_harvest_amount`, optional DEX/pool IDs.
  - **Instruction:** `process_harvest(amount)`.
  - **Accounts:** tax vault (token account, authority = program PDA), mint, DEX pool/route accounts, `jackpot_sol_dest`, system program, token program.
- **Setup:**
  1. Deploy `tax-harvest`.
  2. Create the **tax vault** token account (project token mint) with **authority = `tax_harvest` PDA** (e.g. `["vault"]`).
  3. Point pepball-token’s **`jackpot_pool`** (or Token-2022 fee receiver) at this vault. From then on, tax is auto-sent to this wallet.
  4. Implement the DEX CPI inside `process_harvest` (Meteora/Raydium) to swap token → SOL, then `system_program::transfer` SOL to `jackpot_sol_dest`.

Once that’s live, **automation** is:

- **Tax → jackpot wallet:** automatic (pepball-token or Token-2022).
- **Jackpot wallet → SOL jackpot:** only via the locked `process_harvest` instruction; you can run it on a schedule (cron/crank) or let anyone call it.

No need to “code it from the jackpot wallet” in the sense of running a bot that holds keys; the wallet is a **program-owned vault** and the only code that can move funds is the harvest program’s single instruction.

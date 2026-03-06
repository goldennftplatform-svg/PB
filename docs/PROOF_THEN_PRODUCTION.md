# Proof Phase → Production (One-Way Lock)

You use **one proof token** and **one production token**. No separate "test" coin.

---

## 1. Proof phase (now)

- **Token:** `3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump` (already set as default in the app).
- **Goal:** Prove the game works with super low stakes ($0.50 / $1 / $5).
- **App:** Uses this mint for eligibility, price, display. No code change needed; it’s the default.

---

## 2. Production phase (after you’re ready)

- **Token:** Your **final/production** coin (e.g. the 1B supply Token-2022 you mint with 2.5% tax).
- **Switch:** One-time, **one-way** move from proof mint → production mint. After that, the app **only** uses the production mint and must **never** switch back (so everyone can see you can’t cheat).

---

## 3. Do we need a second “test” coin?

**No.** You have:

| Phase     | Token        | Purpose                          |
|----------|--------------|-----------------------------------|
| **Proof**    | `3X36...` (existing) | Low-stakes proof the game works   |
| **Production** | **New** mint you create | Final coin, locked in forever     |

You are **not** minting a separate “test” token. The **proof** token is the existing contract (`3X36...`). The **production** token is the new one you mint when you go live. One-way button = “lock in that new mint and never use proof again.”

---

## 4. One-way button (can never go back)

To make the switch **provably** one-way and transparent:

### Option A: On-chain lock (best)

- A small program (or an account in the lottery program) holds:
  - `proof_mint` = `3X36...`
  - `production_mint` = optional (set once)
  - `locked` = false until lock, then true forever
- Single instruction: **`lock_production_mint(new_mint)`**
  - Allowed only when `locked == false`.
  - Sets `production_mint = new_mint` and `locked = true`.
  - No instruction can ever change `production_mint` or set `locked` back to false.
- App (and anyone) reads this account: if `locked` then use `production_mint`, else use `proof_mint`.
- **Button in the app:** “Lock production token (irreversible)” → admin enters new mint → wallet signs `lock_production_mint(new_mint)`. After that, the whole app uses production mint and there is no way to revert. Everyone can verify on-chain.

### Option B: Config + discipline (simpler, less trustless)

- **Proof:** App uses default mint `3X36...` (no env override).
- **Production:** Set **`VITE_PEPEBALL_MINT`** to the new mint and redeploy. From then on the app uses that mint. “One-way” = you never change that env back (operational commitment only; not on-chain provable).

---

## 5. Recommended flow

1. **Now:** Run with proof token `3X36...` ($0.50 / $1 / $5) and show the game works.
2. **When ready:** Mint your 1B production token (Token-2022, 2.5% tax, etc.).
3. **One-way lock:**
   - **If you add the on-chain lock:** Admin clicks “Lock production token”, enters the new mint, signs the transaction. Program sets production mint and locks it forever. App reads the account and switches to production mint.
   - **If you use env only:** Set `VITE_PEPEBALL_MINT` to the new mint, redeploy, and never change it back.
4. **After lock:** App and all scripts use **only** the production mint. No way to “go back” to proof (on-chain) or you commit not to (env).

---

## 6. Summary

- **Proof token:** `3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump` (no second test coin).
- **Production token:** Your new mint (1B, 2.5% tax, etc.).
- **One-way:** On-chain lock (one instruction, irreversible) is best so people can see you can’t cheat; env-only is simpler but not provable.

Next step can be: add the on-chain **mint lock** (tiny program or account in lottery) and the admin “Lock production token” button that calls it once.

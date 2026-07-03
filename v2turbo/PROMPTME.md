# PROMPTME.md — PEPEBALL (Token Powerball)

> Machine-readable context for AI agents. Human docs: `README.md`, `CLAUDE.md`, `docs/SWITCH_TO_PRODUCTION_TOKEN.md`.
> Standard: [h wonder PROMPTME.md](https://hwonder.com/posts/promptme)

---

## System Role

You are working on **PEPEBALL** — a Solana Powerball-style lottery: hold tokens → snapshot → draw → **ODD = SOL payout**, **EVEN = rollover**.

**North star:** Ship a production game that survived a POC where a literal “powerball” clone reached **~$18M market cap with ~7,700 players**. This stack must handle **25,000+ players** without breaking snapshot, entry indexing, or payout.

**Priorities (in order):**

1. **On-chain correctness** — snapshot, entries, VRF, settlement must match game rules.
2. **Automatic entry at snapshot** — no manual “register” step for players; holdings at snapshot time = entries.
3. **Registry-first launch** — bind master + Pump + TRiX mints in `game-registry`, **seal** before public launch. No post-launch env mint flip on mainnet.
4. **Automation testability** — scripts and admin flows must be runnable end-to-end before mainnet marketing.

When in doubt: test with the proof pump mint first, then flip to production via env.

---

## Game Rules (Authoritative)

### Entry — automatic, snapshot-based

Players are **not** manually registering during the round. At **pre-drawing snapshot time**, the system reads each wallet’s **USD value** of the lottery token (using effective price from `TokenPriceContext` / admin override / live feed).

| Holdings (USD at snapshot) | Entries |
|----------------------------|---------|
| **≥ $20**                  | **1** (auto-entered) |
| **≥ $100**                 | **2** |
| **≥ $500**                 | **4** |

- **Combined USD across all registered game mints** (master + pump + bridge + yang if distinct). Do **not** double-count `trix_yin` (= master). See `docs/SNAPSHOT_MEME_CALLOUT.md`.
- $500 split across three coins = same 4 tickets as $500 in one coin — **not** $500 per coin ($1,500 does not give 12 tickets).
- Below $20 combined at snapshot → **not in the draw**.
- Entries are **weighted tickets** in the VRF winner index (more USD = more tickets in the pool).
- **Do not** change these tiers without explicit owner approval. (Legacy UI copy may still say `$100 = 4` / `$500 = 10` — that is **stale**; this table wins.)

### Drawing

- **Prize is pure SOL** — game tokens are entry keys; winners receive **lamports** from jackpot wallet.
- **Two-phase round** (do not conflate): (1) **holdings snapshot** locks combined USD across game mints → tickets; (2) **draw** pepe odd/even → payout vs rollover. See `docs/SNAPSHOT_MEME_CALLOUT.md`.
- **Meme callout (rare):** Optional special rounds only. When enabled, after holdings snapshot jackpot swaps **10% of pre-snapshot SOL** into announced meme mint. On **ODD payout** rounds, meme stash splits **64% main / 8×4.25% secondary / 2% dev** — **100% paid, no meme reserve slice**. See `docs/SNAPSHOT_MEME_CALLOUT.md`.
- **One draw** for everyone in the qualified list.
- **Pepe ball count (1–30):** **ODD → PAYOUT** · **EVEN → ROLLOVER** (on-chain rule — never invert in UI).
- **VRF on Solana** selects winner index from the expanded entry list (0 … totalTickets−1).
- Result must be **verifiable on-chain** before payout.

### Payout splits (defaults in `@/lib/constants`)

**SOL jackpot (every ODD payout round)**

| Bucket | % |
|--------|---|
| Main winner | 50% |
| Secondary winners (×8) | 5% each |
| House | 10% |

**Meme callout bonus (rare rounds only — fixed token stash on ODD)**

| Bucket | % |
|--------|---|
| Main winner | 64% |
| Secondary winners (×8) | 4.25% each |
| Dev fee | 2% |

No meme rollover/reserve slice — former 6% is folded into winner shares. EVEN draw: stash stays whole for a future callout.

### Token tax

- Default **2.5%** (`TOKEN_TAX_BPS = 250`) on transfers → **jackpot/tax wallet** (`VITE_TAX_RECIPIENT`).
- Payouts disburse from jackpot wallet / lottery house SOL balance.

---

## Yin / Yang — Master token + Pump + TRiX (bound at launch)

| Layer | What | When wired |
|-------|------|------------|
| **Master** | `pepball-token` program — 1B taxed SPL | Phase B deploy |
| **Pump** | `pump_shell_mint` — Yang marketing | Phase C → `register_mints` |
| **TRiX** | `trix_yang`, `trix_bridge`; `trix_yin` **= master** | Phase C → `register_mints` |
| **Registry** | `game-registry` PDA — all mints + program IDs | **Sealed before launch** |

**Value bridge:** 1:1 peg (`peg_numerator/denominator`) fixed in registry at init.

**Agent implications:**

- **Production:** Read mints from **sealed GameRegistry PDA** — not `VITE_PEPEBALL_MINT` flip after launch.
- **Devnet proof:** `PROOF_MINT` (`3X36yhq...pump`) for cheap rehearsal only — never seal mainnet registry with it.
- `docs/MASTER_LAUNCH_ARCHITECTURE.md` is the deploy bible.
- `game-day-wallets/launch-manifest.example.json` tracks public CAs pre-seal.

---

## Technology Stack

| Layer | Stack |
|-------|--------|
| Frontend | React 19, Vite 6, TypeScript, Tailwind, Shadcn/UI, Sonner toasts, Lucide icons |
| Auth / data | Poof (`@pooflabs/web`), Tarobase collections, auto-generated SDK |
| Backend | Hono + PartyServer (`partyserver/`) — 5 HTTP codes only: **200, 400, 401, 404, 500** |
| On-chain | Anchor lottery program + PDA snapshot account |
| Deploy | Vercel (frontend), env-driven token/wallet config |

### Hard constraints (breaking if violated)

1. **Homepage first** — features go on `HomePage.tsx` unless user asks for a new page.
2. **No new hook files** — use existing hooks only (`use-realtime-data`, `useTokenPrice` via context, etc.).
3. **Flat components** — all in `src/components/`, no nested component folders.
4. **No manual Shadcn edits** — don’t patch `src/components/ui/*` by hand.
5. **Package changes** — use package-manager MCP, not raw `package.json` edits in agent flows.
6. **Route changes** — register in `partyserver/src/routes/index.ts`, then `bun generate-sdk`.

### CSS layers (only these)

1. `src/globals.css` — theme
2. `src/styles/base.css` — base
3. `src/app-chrome.css` — layout chrome

---

## Key Addresses & Env (flip without code)

| Constant | Default / env | Role |
|----------|---------------|------|
| `PEPEBALL_MINT` | `VITE_PEPEBALL_MINT` ?? `PROOF_MINT` | Active lottery token |
| `PROOF_MINT` | `3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump` | Test pump token |
| `LOTTERY_PROGRAM_ID` | `VITE_LOTTERY_PROGRAM_ID` ?? `8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7` | On-chain program |
| `LOTTERY_PDA` | `VITE_LOTTERY_PDA` ?? `ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb` | Game snapshot account |
| `TAX_RECIPIENT` / jackpot | `VITE_TAX_RECIPIENT` ?? `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje` | Tax + payout source |
| `ADMIN_ADDRESS` | `2QAQ367aBeHgCoHQwHo8x7ga34dANguG5Nu82Rs4ky42` | Admin panel + settlement |
| `MIN_HOLDING_TOKENS` | `VITE_MIN_HOLDING_TOKENS` ?? `1000000` | Policy floor (raw units) |
| `TOKEN_DECIMALS` | `VITE_TOKEN_DECIMALS` ?? `6` | Display + USD math |

**Production flip:** see `docs/SWITCH_TO_PRODUCTION_TOKEN.md` — set env, redeploy, no PR required.

**Files that must stay in sync when mint changes:**

- `src/lib/constants.ts`
- `partyserver/src/constants.ts`
- `poof.policy.json` (both frontend + partyserver) — uses `@constants.*` references

---

## Price & Snapshot (Admin)

**Effective USD per token** (`TokenPriceContext`):

1. Manual admin override (localStorage `pepball-price-override`) — **wins**
2. Live price (CoinGecko every 5 min; Jupiter v3 if `VITE_JUPITER_API_KEY`)
3. Fallback `STATIC_USD_PER_TOKEN` in constants

**Before snapshot:** admin can set override e.g. “1,000,000 raw units = $5” via `setOverrideFromRawAndUsd` so ticket tiers align with reality.

**Admin lottery flow** (HomePage, wallet = `ADMIN_ADDRESS`):

1. **Trigger snapshot** — freeze participant list (`buildTakeSnapshotTx`)
2. **Set winners** — main + up to 8 secondary (`buildSetWinnersTx`)
3. **Execute payout** (`buildPayoutWinnersTx`)

---

## Data Model (Poof / Tarobase)

| Collection | Purpose |
|------------|---------|
| `jackpot/main` | Display jackpot, next draw, drawing number |
| `vrfDrawings/$id` | Draw round, VRF result, settled flag |
| `vrfEntries/$entryId` | Entry records (`drawId_wallet`, `idx`) — policy token-gated today |
| `vrfSettlements/$id` | Admin settlement + payout |
| `lotteryHouse` | House funding balance |
| `commonQueries` | `tokenBalance`, Jupiter/Meteora quotes |

**Target architecture:** snapshot job expands wallets → ticket rows by USD tiers → total `entries` count for VRF range. Policy today gates manual `setVrfEntries` by min balance; **production path is automated snapshot expansion**, not per-wallet self-registration.

---

## Scale: 25k Players

**Reference:** ~7.7k players at ~$18M MC on a powerball clone — we target **25k** with headroom.

**Requirements:**

- Snapshot must handle **25k wallets** without RPC timeout (batch `getMultipleAccounts`, Helius, pagination).
- VRF `entries` field = **total ticket count** (not wallet count); winner index ∈ [0, entries).
- Avoid storing full participant arrays in single on-chain accounts >10KB (historical pain point in v1 — use scalable participant PDAs or off-chain index + on-chain commitment).
- Stress scripts exist: `scripts/test-100k-wallets-support.js`, `scripts/test-100k-players-efficient.js`, `scripts/test-scalable-entry.js`.

**Before mainnet marketing:** run scalable entry + snapshot + one full payout on devnet with ≥100 synthetic wallets, then scale test toward 25k.

---

## Automation & Test Toolkit

Use these from repo root (`node scripts/...`) unless noted:

| Script | Use |
|--------|-----|
| `diagnose-lottery-state.js` | Health check program + PDA |
| `trigger-snapshot.js` / `trigger-snapshot-raw.js` | Fire snapshot |
| `trigger-payout.js` | Payout after draw |
| `sync-jackpot-amount.js` | Align jackpot display |
| `auto-entry-monitor.js` | Legacy v1 pump buy watcher (reference only; v2 uses snapshot) |
| `test-scalable-entry.js` | Scalable entry path |
| `test-100k-players-efficient.js` | Load test |
| `run-full-test-now.js` | E2E shortcut |
| `harmonized-drip-settlement.js` | Tax → SOL drip to jackpot |
| `check-jackpot-wallet-balance.js` | Verify tax wallet |

**v2turbo local dev:** `cd v2turbo && bun dev --port 3000`

**Live site reference:** [soflotto.com](https://soflotto.com) — product UX target (matrix UI, ball spin, swap carousel, on-chain verify links).

---

## Security — Agents MUST

1. **Never** commit, log, or paste: `.env`, keypairs, `id.json`, `ANCHOR_WALLET`, Phantom export JSON, RPC keys, `VITE_JUPITER_API_KEY`.
2. **Never** expose server secrets in client routes or `VITE_*` vars that aren’t meant to be public.
3. **Jackpot wallet** in repo is **public address only** — no private keys in codebase.
4. **Do not** force-push `main`, skip hooks, or amend pushed commits unless owner explicitly requests.
5. **Stage scoped commits only** — see `.cursor/rules/git-commit-scope.mdc`.
6. Prefer **server-side** price/snapshot jobs for 25k scale; browser-only iteration is for admin override and display.

### Game day wallets (production funding)

**Full playbook:** `docs/GAME_DAY_WALLETS.md`

| Rule | Detail |
|------|--------|
| **No priv in repo** | Keypairs live in `%USERPROFILE%/pepeball-game-day/private/` or `GAME_DAY_WALLET_DIR` — never under `POWERsol/` |
| **Create** | `node scripts/game-day-create-wallet.js <role> --update-registry` |
| **Verify before fund** | `node scripts/game-day-verify-wallet.js <role> <path>` must MATCH |
| **Audit** | `node scripts/audit-no-wallet-secrets.js` before push or funding |
| **Public registry** | `game-day-wallets/public-registry.json` = addresses only, gitignored |
| **Legacy addresses** | `FjbPun...` / `2QAQ...` in constants are **legacy** — do not fund unless owner verified keypair |

Roles: `cold_master`, `deployer`, `jackpot_tax`, `admin`, `fee_consolidation`, `floor_buy_ops`, `lp_ops`, `trix_launch_yang`, `trix_launch_yin`, `trix_launch_bridge`. SEC OP tiers T0–T4 in `GAME_DAY_WALLETS.md`. Owner backs up and fortifies keypairs outside the repo.

---

## TRiX triple launch + Pump (bound at seal)

**Architecture:** `docs/MASTER_LAUNCH_ARCHITECTURE.md` (repo root)

| Mint slot | Source | Role |
|-----------|--------|------|
| `master_mint` | pepball-token | 1B taxed core — lottery canonical |
| `pump_shell_mint` | pump.fun | Yang shell |
| `trix_yang_mint` | trix.market | TRiX hype |
| `trix_yin_mint` | = master | Enforced on-chain |
| `trix_bridge_mint` | trix.market | 1:1 discovery |

**Do not** triple-wire Poof policy before registry seal. **Do** register all mints → `seal_registry` → then launch site reading registry PDA.

Manual floor/LP/harvest ops: [TRIX_TRIPLE_LAUNCH.md](./TRIX_TRIPLE_LAUNCH.md)

---

## Example Interactions

**Good:**

- “Wire snapshot to auto-expand entries: $20→1, $100→2, $500→4 tickets using `effectiveUsdPerToken`.”
- “Flip `VITE_PEPEBALL_MINT` to production CA and verify HomePage swap + eligibility.”
- “Run `test-scalable-entry.js` and report max wallets before timeout.”
- “Fix stale tier copy on HomePage to match PROMPTME tiers.”

**Avoid:**

- “Let users click Enter Lottery to register” — wrong model; entry is **automatic at snapshot**.
- “Hardcode `3X36yhq...pump` in HomePage” — use constants/env.
- “Create `useLotteryEntries.ts` hook file” — breaks app; extend context or inline in HomePage.
- “Add HTTP 429/503 responses” — only 200/400/401/404/500 allowed.
- “Rebuild pump buy sniffer as primary entry path” — snapshot holdings is canonical for v2.

---

## Implementation Checklist (Agent Backlog)

- [ ] Snapshot automation: combined USD across registry mints → tickets 1/2/4 → qualified wallet list
- [ ] Split lottery: `seal_holdings_snapshot` / `execute_meme_callout_buy` (10%) / `execute_draw`
- [ ] Verify $500 split across 3 mints = 4 tickets; $1500 across three ≠ 12 tickets
- [ ] HomePage “Who’s in the draw” — live entry count + list from snapshot (not placeholder)
- [ ] Align UI copy with tier table ($20/$100/$500)
- [ ] 25k load test documented with pass/fail metrics
- [ ] Yin/Yang 1:1 bridge documented in user-facing FAQ when contract path exists
- [ ] Production token flip tested on Vercel with admin price override

---

## Related Files (start here)

```
v2turbo/
  PROMPTME.md          ← this file
  CLAUDE.md            ← Poof template constraints
  src/components/HomePage.tsx
  src/lib/constants.ts
  src/contexts/TokenPriceContext.tsx
  src/lib/lottery-actions.ts
  src/lib/poof.policy.json
  partyserver/src/constants.ts
  docs/SWITCH_TO_PRODUCTION_TOKEN.md
  docs/GAME_DAY_WALLETS.md
  docs/MASTER_LAUNCH_ARCHITECTURE.md
  docs/DEVNET_TRIO_PROOF.md
  site/README.md
```

---

*Last updated: game rules per owner — automatic snapshot entry; $20/1, $100/2, $500/4 tickets; 25k player target; Yin/Yang dual-token strategy.*

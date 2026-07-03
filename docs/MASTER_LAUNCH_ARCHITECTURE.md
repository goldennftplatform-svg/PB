# Master launch architecture — no patch after launch

**Principle:** Deploy your **custom master stack** once. Bind **Pump** and **TRiX** mints into an on-chain **GameRegistry** before anyone trades. **Seal** the registry — then launch. No post-launch env flipping, no “we’ll wire trix later.”

Related: [GAME_DAY_WALLETS.md](../v2turbo/docs/GAME_DAY_WALLETS.md), [PROMPTME.md](../v2turbo/PROMPTME.md), `game-day-wallets/launch-manifest.example.json`

---

## What you own (custom programs)

| Program | Role |
|---------|------|
| **game-registry** | Master config PDA — all mints + program IDs; **sealed** at launch |
| **pepball-token** | Your 1B taxed SPL token (2.5% → jackpot + creator) |
| **lottery** | Snapshot, tiers, even/odd draw, payouts |
| **tax-harvest** | Locked path: tax vault → SOL → jackpot only |
| **lp-manager** | LP funding, fee conversion, jackpot drip |

Pump.fun and TRiX are **launchpads** — they produce **external SPL mints**. Your programs **register and bind** those mints; you do not patch the app after the fact.

---

## Architecture diagram

```
                    ┌─────────────────────────────────────┐
                    │     game-registry (SEALED PDA)      │
                    │  master | pump | trix_yang/yin/bridge │
                    │  peg 1:1 | jackpot | program IDs    │
                    └──────────────┬──────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │ pepball-token│         │   lottery    │         │ tax-harvest  │
  │  MASTER 1B   │         │ draw/snapshot│         │ fee → SOL    │
  └──────┬───────┘         └──────────────┘         └──────┬───────┘
         │                                                  │
         │    ┌─────────────┐    ┌─────────────┐           │
         └───►│ pump_shell  │    │ trix_yang   │           │
              │ (pump.fun)  │    │ trix_bridge │───────────┘
              └─────────────┘    │ trix_yin    │
                                 │ (= master)  │
                                 └─────────────┘
```

**Yin rule (on-chain):** `trix_yin_mint` **must equal** `master_mint` at `register_mints`. One canonical game token.

---

## Deploy order (game day)

### Phase A — Programs (devnet test → mainnet once)

1. Generate **new** program keypairs (SEC OP — outside repo).
2. Deploy all five programs to mainnet.
3. Record program IDs in `launch-manifest.json` (local, public only).

### Phase B — Master token

4. `pepball_token::initialize_token` — 1B supply, 2.5% tax, jackpot + creator destinations.
5. Create SPL mint + metadata tied to **your** program (not a random pump CA as “the game token”).

### Phase C — External launches (Pump + TRiX)

6. Launch **Pump shell** (Yang) on pump.fun → save mint CA.
7. Launch **TRiX triple** on trix.market → save yang + bridge mint CAs.
8. **Yin** on TRiX = same mint as **master** (or launch master as the TRiX Yin listing).

Manual ops (floor buy, LP) use T4 hot wallets — same as before — but **mints are final** before seal.

### Phase D — Registry bind + seal (critical)

9. `initialize_registry` — jackpot wallet, all five program IDs.
10. `register_mints` — master, pump_shell, trix_yang, trix_yin (= master), trix_bridge.
11. **`seal_registry`** — irreversible. After this, no mint changes on-chain.
12. `initialize_lottery` with tiers **2000 / 10000 / 50000** cents → **1 / 2 / 4** tickets.
13. Initialize tax-harvest + lp-manager with jackpot destination from registry.

### Phase E — App

14. Frontend reads **GameRegistry PDA** for mints (not a post-launch env pivot).
15. Vercel env: `VITE_GAME_REGISTRY_PDA` + program IDs only — set **once** at deploy.

---

## Snapshot eligibility (design)

At pre-draw snapshot, aggregate **USD value** across registered mints:

| Mint | Weight in snapshot |
|------|-------------------|
| `master_mint` | Full USD value |
| `pump_shell_mint` | Full USD (or via 1:1 peg to master — product choice) |
| `trix_bridge_mint` | Full USD with 1:1 peg to master |
| `trix_yang_mint` | Marketing surface — include if you want triple-door entries |

Registry defines **which mints count**; snapshot job reads registry once per draw. No patching.

**Ticket tiers (lottery program, pre-launch):**

| USD at snapshot | Tickets |
|-----------------|---------|
| ≥ $20 | 1 |
| ≥ $100 | 2 |
| ≥ $500 | 4 |

---

## What “no patch after launch” means

| ❌ Old thinking | ✅ Master launch |
|----------------|------------------|
| Deploy lottery, flip `VITE_PEPEBALL_MINT` later | All mints in sealed GameRegistry |
| TRiX added as manual ops only | TRiX mints registered before seal |
| Pump is separate experiment | pump_shell_mint bound at init |
| Tier copy ≠ on-chain math | Lottery `calculate_tickets` = 1/2/4 before mainnet |

**Proof token** (`3X36yhq...pump`) stays for **devnet rehearsal only**. Production never seals with proof mint.

---

## SEC OP at launch

- **New** program keypairs + **new** game-day wallets (T0–T4).
- Registry `admin` = T2 admin wallet; transfer admin to multisig before seal if desired.
- After `seal_registry`, even admin **cannot** change mints — only lottery ops (snapshot/payout) continue.

---

## Liquidity (Orca + Jupiter)

Six-pool launch topology, snapshot oracle rules, and devnet rehearsal scope: [LIQUIDITY_PAIRING_PLAN.md](./LIQUIDITY_PAIRING_PLAN.md).

---

## Code locations

```
programs/game-registry/src/lib.rs   ← seal + register_mints
programs/pepball-token/src/lib.rs   ← master taxed token
programs/lottery/src/lib.rs         ← tiers 1/2/4
programs/tax-harvest/src/lib.rs     ← harvest lock
programs/lp-manager/src/lib.rs      ← LP + fee conversion
game-day-wallets/launch-manifest.example.json
```

---

## Still to build (before mainnet seal)

- [ ] Devnet go/no-go complete — [DEVNET_GO_NO_GO.md](./DEVNET_GO_NO_GO.md)
- [ ] Mainnet launch — [MAINNET_GO_LIVE_CHECKLIST.md](./MAINNET_GO_LIVE_CHECKLIST.md)
- [ ] IDL + `initialize-game-registry` script (devnet dry run)
- [ ] Frontend: read `GameRegistry` account instead of env-only mint
- [ ] **Holdings snapshot:** multi-mint combined USD → qualified list ([SNAPSHOT_MEME_CALLOUT.md](./SNAPSHOT_MEME_CALLOUT.md))
- [ ] **Meme callout buy:** 10% pre-snapshot SOL → announced mint, once per round
- [ ] Split `take_snapshot` into holdings / callout / draw phases
- [ ] tax-harvest DEX CPI (Meteora/Raydium) — currently stub
- [ ] 1:1 bridge instruction (peg enforced by registry ratio)

---

*Deploy once. Register everything. Seal. Launch. No patch.*

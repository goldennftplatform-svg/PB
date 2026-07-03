# Snapshot, combined eligibility & meme callouts

**Jackpot prize: pure SOL.** Hold game tokens across the registry trio → qualify → **ODD = payout**, **EVEN = rollover**.

**ODD = PAYOUT · EVEN = ROLLOVER** — Pepe ball count (1–30), on-chain and in all UI copy.

Related: [MASTER_LAUNCH_ARCHITECTURE.md](./MASTER_LAUNCH_ARCHITECTURE.md), [DEVNET_TRIO_PROOF.md](./DEVNET_TRIO_PROOF.md), [ROUND_LEDGER.md](./ROUND_LEDGER.md)

---

## Meme callout — **rare** (not every round)

Most rounds: **SOL only**. Meme callout is a **special event** (partner coin, viral moment, milestone) — admin enables explicitly per round.

| Default | Rare callout round |
|---------|-------------------|
| No meme buy | Admin sets `meme_callout_enabled = true` + announces mint |
| SOL payout only | SOL + meme bags on **ODD** payout |

Do not imply every draw has a meme coin. Marketing copy: *"Rare bonus rounds — SOL jackpot every time."*

---

## Round phases

| Phase | What | Outcome |
|-------|------|---------|
| **A — Holdings snapshot** | Combined USD across game mints | Qualified wallets + tickets |
| **B — Meme buy** *(only if callout enabled)* | 10% pre-snapshot SOL → meme mint | Meme stash for split payout |
| **C — Draw** | Pepe count 1–30 | **ODD → payout** · **EVEN → rollover** |
| **D — Settlement** | Winners | SOL (+ meme split on ODD if callout ran) |

If no callout: skip B entirely.

---

## Combined eligibility ($500 across 3 mints)

Sum USD across `master_mint`, `pump_shell_mint`, `trix_bridge_mint`, `trix_yang_mint` (dedupe `trix_yin` = master).

| Combined USD | Tickets |
|--------------|---------|
| ≥ $20 | 1 |
| ≥ $100 | 2 |
| ≥ $500 | 4 |

$200 + $200 + $100 = **4 tickets**. $500 in each mint ($1,500) = **still 4**.

---

## Meme stash payout split (one-and-done on ODD)

On **ODD** payout rounds when a callout ran, **100%** of meme tokens pay out — no reserve slice:

| Recipient | % of meme stash |
|-----------|-----------------|
| Main winner | 64% |
| Secondary ×8 | 4.25% each |
| Dev | 2% |

*(Former 6% “rollover reserve” is folded into winner shares — avoids a floating meme carry that could glitch rounds.)*

**EVEN draw rollover:** No meme split that round — entire stash stays for a future callout (draw mechanic only, not a partial % reserve).

---

## Meme buy rules (when enabled)

- **10%** of `pre_snapshot_sol` only — once per round.
- Only into admin-announced `meme_callout_mint`.
- After holdings snapshot, before draw (outcome unknown).
- ~90% SOL remains for payout path if ODD.

---

## On-chain build list

- [ ] `meme_callout_enabled` per round (default false)
- [ ] `execute_meme_callout_buy` — 10% cap, optional
- [ ] `payout_winners` + `payout_meme_stash` — same % split
- [ ] Split holdings snapshot vs `execute_draw` (pepe odd/even)

---

*SOL every round. Meme callout = rare spice. ODD pays. EVEN rolls.*

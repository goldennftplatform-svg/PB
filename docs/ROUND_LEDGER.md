# Round ledger — fixed SOL + meme callout accounting

**Jackpot prize = SOL (lamports committed per round).** Meme callout = **fixed raw token stash** on rare rounds. They never share one fuzzy number.

Related: [SNAPSHOT_MEME_CALLOUT.md](./SNAPSHOT_MEME_CALLOUT.md), [GAME_DAY_WALLETS.md](../v2turbo/docs/GAME_DAY_WALLETS.md)

---

## Where the file lives

| Path | Purpose |
|------|---------|
| `%USERPROFILE%/pepeball-game-day/round-ledger.json` | **Your ledger** (outside repo) |
| `v2turbo/public/round-ledger-public.json` | Public summary for the site (no secrets) |

Override: `ROUND_LEDGER_PATH=...`

---

## Round phases

| Phase | Action | Ledger command |
|-------|--------|----------------|
| **Open** | Lock SOL commitment for this draw | `open --sol 10` |
| **A** | Holdings snapshot | (on-chain) |
| **B** | Meme buy *(callout only)* | `record-meme-buy --raw … --sol …` |
| **C** | Pepe draw | `record-snapshot --pepe 7 --seed …` |
| **D** | Settlement | `record-settlement --main …` |

---

## CLI cheat sheet

```bash
# Open a $10k-style round (10 SOL on devnet, scale on mainnet)
node scripts/round-ledger.js open --sol 10

# Rare meme callout round
node scripts/round-ledger.js open --sol 10 --callout --mint <MEME_MINT>

# After you buy meme tokens (fixed raw amount — never re-price)
node scripts/round-ledger.js record-meme-buy --raw 1200000000 --sol 1 --tx <SIG>

# After take_snapshot
node scripts/round-ledger.js record-snapshot --pepe 7 --seed 843930448394710746 --tx <SIG>

# Preview splits before paying winners
node scripts/round-ledger.js splits --sol 10
node scripts/round-ledger.js splits --meme-raw 1200000000

# After SOL + on-chain payout_winners
node scripts/round-ledger.js record-settlement --main <WINNER> --sol-tx <SIG> --payout-tx <SIG>

# EVEN rollover — stash carries forward
node scripts/round-ledger.js mark-rolled

# Push summary to website
node scripts/round-ledger.js export-public
```

---

## Fixed split math (auditable)

### SOL jackpot (every ODD payout)

| Recipient | % |
|-----------|---|
| Main winner | 50% |
| 8 minors | 5% each (40% total) |
| House reserve | 10% |

### Meme stash (callout rounds only — **% of token count**, one-and-done)

| Recipient | % |
|-----------|---|
| Main winner | 64% |
| 8 minors | 4.25% each (34% total) |
| Dev | 2% |

**100% paid on ODD** — no meme reserve / carry slice. EVEN draw: stash stays whole (no split).

Meme **USD value floats**; **token amounts do not**. SOL commitment does not change when meme price pumps.

---

## EVEN rollover

- SOL commitment rolls (participants stay on-chain)
- Meme stash stays in reserve — `mark-rolled` records carry-forward
- Next round: `open` only after previous is `settled` or `rolled`

---

## Website

`export-public` writes `v2turbo/public/round-ledger-public.json`. The homepage shows:

- **SOL committed** (fixed prize bucket)
- **Meme stash raw** (bonus bucket, if callout enabled)
- **ODD / EVEN** outcome when recorded

Redeploy Vercel after `export-public` on mainnet game days.

---

*SOL every round. Meme = rare fixed-token bonus. Ledger keeps them honest.*

# PEPEBALL info site (GitHub Pages)

Marketing + docs hub for PEPEBALL — Cary0x-style card layout, matrix theme. **No build step.**

**Live after push:** `https://goldennftplatform-svg.github.io/PB/`

## Local preview

```bash
cd site
npx --yes serve .
# http://localhost:3000
```

## Configure

Edit **`site/assets/config.js`** (public only):

- `playUrl` — live app (`https://pb-n7kx.vercel.app`)
- `infoSiteUrl` — this hub (`https://goldennftplatform-svg.github.io/PB/`)
- `repoUrl`, `discordUrl`, `twitterUrl`
- `publicWallets` — admin + jackpot_tax pubkeys
- `pillars`, `talkingPoints`, `mediaKit` — marketing copy
- Program IDs / devnet mints for verify page

## Deploy

**GitHub Actions:** `.github/workflows/github-pages.yml` — auto-deploys `site/` on push to `main`.

Or: **Settings → Pages → Deploy from branch → `/site`**

## Pages

| Path | Content |
|------|---------|
| `/` | Hero, pillars, talking points, card hub |
| `/guides/` | How to play (5 steps) |
| `/guides/rules.html` | ODD/EVEN, tiers, SOL + meme splits, tax |
| `/guides/round-ledger.html` | Fixed SOL + meme accounting |
| `/guides/brand.html` | Brand kit — soundbites, hashtags, video arc |
| `/guides/tokens.html` | Yin/Yang / TRiX |
| `/guides/liquidity.html` | Tax + LP |
| `/guides/devnet.html` | Rehearsal checklist |
| `/leaderboard/` | Hall of Fame — winners, lore timeline, draw archive |
| `/verify/` | Programs, PDAs, public wallets |
| `/community/` | Links + safety |

## For your media

Use **`guides/brand.html`** for launch threads, spaces, and video scripts. Add Discord/X URLs to `config.js` when ready.

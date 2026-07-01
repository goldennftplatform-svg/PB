# PEPEBALL info site (GitHub Pages)

Cary0x-style static hub for guides, rules, verify links, and play CTA. Lives in **`site/`** in this repo.

## Local preview

```bash
cd site
npx --yes serve .
# open http://localhost:3000
```

Or open `site/index.html` in a browser (some links work best with a local server).

## Configure

Edit **`site/assets/config.js`** (public only):

- `playUrl` — live game (e.g. `https://soflotto.com`)
- `repoUrl`, `discordUrl`, `twitterUrl`
- Program IDs / cluster for verify page

## Deploy to GitHub Pages

### Option A — GitHub UI (simplest)

1. Push `site/` to `main`
2. Repo **Settings → Pages**
3. **Build and deployment → Source:** Deploy from a branch
4. Branch: `main`, folder: **`/site`**
5. Save — site at `https://<user>.github.io/<repo>/`

For a **user site** (`cary0x.github.io` style): use a repo named `<username>.github.io` and set Pages root to `/site` or move contents to repo root.

### Option B — GitHub Actions

Workflow: `.github/workflows/github-pages.yml` (uploads `site/` on push).

## Pages

| Path | Content |
|------|---------|
| `/` | Card hub (like cary0x home) |
| `/guides/` | How to play |
| `/guides/rules.html` | ODD/EVEN, tiers, meme callout |
| `/guides/tokens.html` | Yin/Yang |
| `/guides/devnet.html` | Devnet proof |
| `/verify/` | Solscan links |
| `/community/` | Social + safety |

## Theme

Matrix green / gold — matches v2turbo live app. No build step required.

# Deploy v2turbo to Vercel (test admin features)

Get the v2turbo app live on Vercel so you can test admin features (drawings, settlements, etc.) from a real URL.

## Option A: New Vercel project (recommended – keeps existing pb-n7kx site)

1. **Vercel dashboard**  
   Go to [vercel.com/dashboard](https://vercel.com/dashboard) → **Add New** → **Project**.

2. **Import the same repo**  
   Select your **POWERsol** GitHub repo.  
   Before deploying, click **Configure** / **Edit**.

3. **Root Directory**  
   Set **Root Directory** to **`v2turbo`** (so only v2turbo is built).

4. **Build settings** (should be picked up from `v2turbo/vercel.json`)  
   - **Framework Preset:** Other  
   - **Build Command:** `bun run vercel-build`  
   - **Output Directory:** `dist`  
   - **Install Command:** `bun install --frozen-lockfile`  
   The app build uses **Bun**. If Vercel fails with `bun: command not found`, in Project Settings → General enable **Bun** (or set Install Command to `npm i -g bun && bun install --frozen-lockfile`).

5. **Environment variables** (Vercel → Project → Settings → Environment Variables)  
   Add these for **Production** (and Preview if you want same behavior):

   | Name | Value | Notes |
   |------|--------|--------|
   | `VITE_TAROBASE_APP_ID` | `697010c4c6f87869899205a3` | Your Poof/Tarobase app ID |
   | `VITE_ENV` | `PREVIEW` | Use `LIVE` when on mainnet |
   | `VITE_CHAIN` | `offchain` | Or `solana` for mainnet |
   | `VITE_RPC_URL` | `https://celestia-cegncv-fast-mainnet.helius-rpc.com` | Or your Helius RPC |
   | `VITE_WS_API_URL` | `wss://api.tarobase.com/ws/v2` | Leave default if unsure |
   | `VITE_API_URL` | `https://api.tarobase.com` | Leave default if unsure |
   | `VITE_AUTH_API_URL` | `https://auth.tarobase.com` | Leave default if unsure |

   Optional: `VITE_PARTYSERVER_URL`, `VITE_AUTH_METHOD`, `VITE_DEPLOYMENT_TIER`.

6. **Deploy**  
   Save and deploy. You’ll get a URL like `https://powersol-v2turbo-xxx.vercel.app` (or whatever name you give the project).

7. **Test admin**  
   Open the URL, connect wallet (admin = `ADMIN_ADDRESS` in constants), and use the app to trigger drawings and settlements.

---

## Option B: Replace current Vercel project with v2turbo

If you want the **same** Vercel URL to serve v2turbo instead of the current `app/` site:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → your **POWERsol** project.
2. **Settings** → **General** → **Root Directory** → set to **`v2turbo`**.
3. Add the **Environment Variables** from the table above (Production + Preview).
4. **Redeploy** (Deployments → … on latest → Redeploy).

The existing `vercel.json` in the repo root will be ignored when Root Directory is `v2turbo`, and Vercel will use `v2turbo/vercel.json` and `v2turbo/package.json`.

---

## After deploy

- **Admin features** (create drawing, run settlement) are available in the app when the connected wallet is `ADMIN_ADDRESS` (`2QAQ367aBeHgCoHQwHo8x7ga34dANguG5Nu82Rs4ky42` in constants).
- **Auto-deploy:** Pushes to your connected GitHub branch will trigger new Vercel builds.
- To change env (e.g. switch to mainnet or another app ID), update the variables in Vercel and redeploy.

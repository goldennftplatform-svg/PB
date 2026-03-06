# Stop Vercel Asking for Login to View Your Site

The "log in to Vercel" screen is **Deployment Protection**. It is turned on in the **Vercel Dashboard**. Repo config (`vercel.json`) cannot turn it off.

## Fix (do this once)

1. Go to **[Vercel Dashboard](https://vercel.com/dashboard)** and log in.
2. Open your **team** (e.g. **goldens-projects**).
3. Open the **project** that deploys this repo (e.g. **PB** or **POWERsol**).
4. In the left sidebar click **Settings**.
5. Click **Deployment Protection**.
6. Set **Protection scope** to **None** (or whatever option means "no protection" / "all deployments public").
7. Save.

After that, both production and preview URLs (like `https://pb-n7kx-6ueughoch-goldens-projects-2d3d6c88.vercel.app/`) will load without a Vercel login.

## If you don’t see "None"

- **Team default:** In **Team → Settings**, check if there’s a **default Deployment Protection** for new projects and set it to **None** so new projects stay public.
- **This project only:** In **Project → Settings → Deployment Protection**, turn off **Vercel Authentication** and set the scope so preview deployments are **not** protected.

## Optional: Only make one preview public (Pro/Enterprise)

If you have **Deployment Protection Exceptions** (Pro add-on or Enterprise), you can add a specific preview domain (e.g. `pb-n7kx-6ueughoch-goldens-projects-2d3d6c88.vercel.app`) to the **Unprotected Domains** list instead of turning off protection for the whole project.

---

**TL;DR:** Vercel Dashboard → Your project → **Settings → Deployment Protection** → set to **None** (or disable protection for previews). No code change will fix the login prompt.

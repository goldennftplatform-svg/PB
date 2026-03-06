# Privy: Solana-only so wallets connect

If **no wallets connect** (Phantom, etc.), the Privy app is often set up for **Ethereum** by default. Fix it in the dashboard and in code.

## 1. Privy Dashboard (dashboard.privy.io)

1. Open your app → **Settings** / **Login methods**.
2. **Enable “Wallet”** and ensure **Sign in with Solana (SIWS)** is enabled for wallet login. If you see “Sign in with Ethereum (SIWE)” only, add or switch to Solana.
3. **Chains / Networks:** Set **default chain** (or supported chains) to **Solana** (mainnet). Remove or don’t rely on Ethereum-only.
4. **Allowed domains:** Add your site URL (e.g. `https://your-app.vercel.app`) and `https://localhost:5173`.

If the app was created for Ethereum, create a new app for Solana or change this app to support Solana wallet login and Solana as the chain.

## 2. This codebase

We send `walletChainType: 'solana-only'` in Privy config. We do not pass `externalWallets.solana.connectors` here because importing `@privy-io/react-auth/solana` breaks the Vite build on Vercel (module resolve failure). So the **client** is set to Solana-only; the **dashboard** must have Solana (SIWS) enabled. If wallet connect still fails, use **Connect with Phantom** on the site (Phantom-only fallback).

## 3. Quick check

After changing the dashboard:

- Hard refresh the site (or clear cache).
- Connect again; Phantom (or other Solana wallet) should be offered.

If it still fails, use **Connect with Phantom** (Phantom fallback) on the site; that bypasses Privy and uses Phantom directly.

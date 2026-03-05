# Privy: Solana-only so wallets connect

If **no wallets connect** (Phantom, etc.), the Privy app is often set up for **Ethereum** by default. Fix it in the dashboard and in code.

## 1. Privy Dashboard (dashboard.privy.io)

1. Open your app → **Settings** / **Login methods**.
2. **Enable “Wallet”** and ensure **Sign in with Solana (SIWS)** is enabled for wallet login. If you see “Sign in with Ethereum (SIWE)” only, add or switch to Solana.
3. **Chains / Networks:** Set **default chain** (or supported chains) to **Solana** (mainnet). Remove or don’t rely on Ethereum-only.
4. **Allowed domains:** Add your site URL (e.g. `https://your-app.vercel.app`) and `https://localhost:5173`.

If the app was created for Ethereum, create a new app for Solana or change this app to support Solana wallet login and Solana as the chain.

## 2. This codebase

We already send:

- `walletChainType: 'solana-only'`
- `externalWallets.solana.connectors` from `@privy-io/react-auth/solana` when available

So the **client** is Solana-only. If the **dashboard** is still Ethereum-only, Privy will still show ETH behavior and wallets can fail to connect.

## 3. Quick check

After changing the dashboard:

- Hard refresh the site (or clear cache).
- Connect again; Phantom (or other Solana wallet) should be offered.

If it still fails, use **Connect with Phantom** (Phantom fallback) on the site; that bypasses Privy and uses Phantom directly.

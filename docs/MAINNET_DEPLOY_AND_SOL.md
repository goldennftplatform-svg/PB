# Deploy to Mainnet + Where to Send REAL SOL

## Address to send REAL SOL to (jackpot / payouts)

**One wallet for everything (tax, manual top-ups, and payouts):**

```
FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje
```

- Token tax from the PEPEBALL token (3X36...) lands here.
- Any manual SOL you send (e.g. 0.01 SOL from users or your own top-up) should go here.
- Payout scripts use the **keypair** that controls this address to sign `set_winners` and `payout_winners` and to send SOL to winners. So this wallet must hold the SOL that gets paid out.

**You need the private key for this address** on the machine that runs snapshot/payout scripts (or use a secure signer). The keypair is what you set as `ANCHOR_WALLET` or `TAX_RECIPIENT_KEYPAIR` when running scripts on mainnet.

---

## Next steps to deploy on mainnet

### 1. Prerequisites

- Solana CLI and Anchor 0.31.0 (or whatever your `Anchor.toml` uses).
- A **mainnet** wallet with enough SOL to:
  - Pay for program deploy (several SOL).
  - Optionally fund the jackpot wallet above for payouts.

### 2. Use the right keypairs

- **Deployer:** The keypair you use for `solana` / `anchor deploy` (e.g. `~/.config/solana/id.json`). This pays for deployment.
- **Jackpot / admin:** The keypair for `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje`. For mainnet, scripts (snapshot, set_winners, payout) must use this keypair as the signer. Keep this keypair secure and back it up.

### 3. Point Solana CLI to mainnet

```bash
solana config set --url mainnet-beta
solana address   # confirm it’s the deployer you want
solana balance   # confirm you have SOL
```

### 4. (Optional) Override Anchor provider for this deploy

Your `Anchor.toml` has `cluster = "devnet"`. To deploy to mainnet without editing the file every time:

```bash
anchor deploy --provider.cluster mainnet
```

Or temporarily set in `Anchor.toml`:

```toml
[provider]
cluster = "mainnet"
wallet = "~/.config/solana/id.json"
```

Then:

```bash
anchor build
anchor deploy
```

### 5. Deploy the lottery program

From the repo root:

```bash
anchor build
anchor deploy --provider.cluster mainnet
```

If you use the **same program keypair** as on devnet (e.g. `target/deploy/lottery-keypair.json`), the program ID will stay:

- **Lottery program:** `8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7`

The game snapshot PDA will be the same as on devnet (e.g. `ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb`) because it’s derived from the program ID + seeds.

### 6. Verify deployment

```bash
node scripts/check-program-deployed.js
```

(Uses mainnet RPC by default if `RPC_URL` / `HELIUS_RPC_URL` are unset or point to mainnet.) You should see “DEPLOYED on mainnet” for the lottery program.

### 7. Initialize lottery on mainnet (if needed)

If this is a fresh deploy, you must run `initialize_lottery` once on mainnet (same as you did on devnet), with the **admin** set to the pubkey that will run snapshot/payout (typically the jackpot wallet `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje`). Use your existing init script or Anchor CLI with `--provider.cluster mainnet` and the admin keypair.

### 8. Run scripts on mainnet

For snapshot, set_winners, and payout scripts:

- Set `RPC_URL` (or `HELIUS_RPC_URL`) to a **mainnet** RPC.
- Use the **jackpot wallet keypair** as the signer (e.g. `ANCHOR_WALLET` or `TAX_RECIPIENT_KEYPAIR` pointing to the keypair for `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje`).

Example (conceptually):

```bash
export RPC_URL=https://api.mainnet.solana.com
# or your Helius mainnet URL
export ANCHOR_WALLET=/path/to/jackpot-wallet-keypair.json
node scripts/trigger-snapshot-raw.js
# ... then set_winners / payout when you have an odd snapshot
```

---

## Summary

| What | Value |
|------|--------|
| **Send REAL SOL to (jackpot / tax / payouts)** | `FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje` |
| **Lottery program ID (after mainnet deploy)** | `8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7` (if same keypair) |
| **Game snapshot PDA** | `ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb` (same seeds as devnet) |
| **Check if deployed** | `node scripts/check-program-deployed.js` (mainnet RPC) |

Once the program is deployed and the lottery is initialized on mainnet, send REAL SOL to **FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje** and run your snapshot/payout flow with that wallet’s keypair and mainnet RPC.

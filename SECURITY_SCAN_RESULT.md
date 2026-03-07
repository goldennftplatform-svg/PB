# 🔴 Security scan result – action required

**Scan date:** Quick scan of repo for private keys / secrets.

---

## ⚠️ What was found (tracked in git and pushed)

These files **contain or are keypairs** and are **currently in your git history** (committed and pushed):

| File | Risk |
|------|------|
| **speed-run-wallets/wallets.json** | Contains `secretKey` arrays for many wallets (test wallets). **Private keys exposed.** |
| **wallet-backups/admin-wallet-imported-2025-11-08T23-18-11.json** | Keypair backup. Address in info file: **Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ** (not the yje address). |
| **wallet-backups/old-wallet-backup-2025-11-08T23-18-11.json** | Keypair backup. Assume private key exposed. |
| **wallet-backups/wallet-backup-2025-11-08T23-15-09.json** | Keypair backup. Assume private key exposed. |
| **~/pball-new-keypair.json** | Keypair file. Assume private key exposed. |

Your **jackpot wallet** (`FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje`) was **not** listed in the admin-wallet-info file (that one was Hefy8...). So the yje keypair might not be in these backups — but **any wallet that ever had a backup or keypair committed is at risk**.

---

## 🚨 Do this first (you said you just sent 2.5 SOL)

1. **Where did you send the 2.5 SOL?**
   - If to **FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje** (yje): that address was not in the backup info we saw, but **to be safe**, move the 2.5 SOL to a **new wallet** (new keypair, never committed) until the repo is cleaned.
   - If to **Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ** or any other address that has a backup in this repo: **move the 2.5 SOL immediately** to a new wallet. That keypair is in git history and must be treated as compromised.

2. **Create a new keypair** (never put it in git):
   ```bash
   solana-keygen new -o ~/new-jackpot-keypair.json
   solana address -k ~/new-jackpot-keypair.json
   ```
   Send the 2.5 SOL to this new address, then update your scripts/docs to use this new “jackpot” address and keypair going forward (or keep using yje only if you’re sure yje was never in any committed file).

3. **Stop using** any wallet whose keypair or backup is in the repo until you’ve rotated (new keypair + moved funds).

---

## 🔧 Clean the repo (so this doesn’t stay in history)

Removing the files from the working tree is not enough — they remain in **git history**. Anyone who has cloned the repo could have the keys.

### Option A – Remove from tracking and rewrite history (recommended)

Use **git filter-repo** (or BFG) to delete these paths from **all** commits, then force-push. After that, treat any keypair that was ever in those files as compromised and don’t use them.

```bash
# Install git-filter-repo (pip install git-filter-repo) then from repo root:
git filter-repo --path speed-run-wallets/wallets.json --invert-paths
git filter-repo --path wallet-backups/ --invert-paths
git filter-repo --path '~/pball-new-keypair.json' --invert-paths
# Then force-push (coordinate with anyone else who uses the repo)
git push --force
```

### Option B – At least stop tracking now and ignore

So at least **new** commits don’t contain the files:

```bash
git rm --cached speed-run-wallets/wallets.json
git rm --cached wallet-backups/admin-wallet-imported-2025-11-08T23-18-11.json
git rm --cached wallet-backups/old-wallet-backup-2025-11-08T23-18-11.json
git rm --cached wallet-backups/wallet-backup-2025-11-08T23-15-09.json
git rm --cached "~/pball-new-keypair.json"
git rm --cached wallet-backups/*.txt
git commit -m "Remove sensitive wallet/keypair files from tracking (security)"
git push
```

**Note:** With Option B the files **remain in history**. Anyone with a clone can still see the old commits and extract keys. Option A is the only way to remove them from history.

---

## ✅ What looks safe

- **.env** and **.env.\*** are in `.gitignore` and not tracked (no `.env` in `git ls-files`).
- **bots/wallets/*.json** are in `.gitignore`; only `bots/wallets/bot*-address.txt` (addresses only) are tracked.
- No hardcoded raw private keys were found in source code (constants.ts, token-config.js use public addresses/mint only).

---

## Summary

- **Private key material is in the repo** in `speed-run-wallets/wallets.json`, `wallet-backups/*.json`, and `~/pball-new-keypair.json`.
- **Immediate:** Move 2.5 SOL to a new wallet if it’s in any address that might have been backed up or committed; treat those keys as compromised.
- **Next:** Remove these paths from git (Option A: history rewrite + force-push; Option B: at least untrack and ignore), and harden `.gitignore` so they can’t be re-added.

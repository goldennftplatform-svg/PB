# 🔧 Fix Anchor Version Mismatch

## The Issue
- **Anchor.toml expects:** 0.32.1
- **You have:** 0.31.0
- **Solution:** Update Anchor CLI

## Quick Fix (In WSL)

```bash
# Update Anchor CLI to latest (will get 0.32.1 or higher)
sudo npm install -g @coral-xyz/anchor-cli@latest

# Verify it updated
anchor --version

# Should now show 0.32.x or higher
```

## Alternative: Install Specific Version

```bash
# Install exact version 0.32.1
sudo npm install -g @coral-xyz/anchor-cli@0.32.1

# Verify
anchor --version
```

## Alternative: Use Cargo

```bash
# Install via Cargo (might work better)
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force

# Verify
anchor --version
```

## After Update

```bash
# Navigate to project
cd /mnt/c/Users/PreSafu/Desktop/POWERsol

# Load Rust environment
source "$HOME/.cargo/env"

# Clean and build
anchor clean
anchor build
```

## If Update Fails

If npm update fails, try:
1. Uninstall first: `sudo npm uninstall -g @coral-xyz/anchor-cli`
2. Then install: `sudo npm install -g @coral-xyz/anchor-cli@latest`

Or use Cargo method above.


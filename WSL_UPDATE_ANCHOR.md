# 🔄 Update Anchor CLI to Match Project Version

## The Issue
- **Project expects:** Anchor 0.32.1 (from Anchor.toml)
- **You have:** Anchor 0.31.0
- **Error:** Version mismatch warning

## Solution: Update Anchor CLI

### Option 1: Update via npm (Quick)
```bash
sudo npm install -g @coral-xyz/anchor-cli@0.32.1
```

### Option 2: Update to latest (Recommended)
```bash
sudo npm install -g @coral-xyz/anchor-cli@latest
```

### Option 3: Install via Cargo
```bash
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force
```

## After Update

```bash
# Verify version
anchor --version

# Should show 0.32.1 or higher

# Then build
cd /mnt/c/Users/PreSafu/Desktop/POWERsol
source "$HOME/.cargo/env"
anchor clean
anchor build
```

## Note
The warning says it will "try globally installed anchor" - this should work, but updating to match is better to avoid any compatibility issues.


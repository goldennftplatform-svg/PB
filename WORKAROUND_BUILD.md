# 🔧 Workaround: Build Despite Version Warning

## The Problem
Anchor version mismatch keeps happening even after updates.

## Solution 1: Update Anchor.toml to Match Your Version

If you have Anchor 0.31.0, update Anchor.toml to match:

```toml
[toolchain]
anchor_version = "0.31.0"  # Change from 0.32.1 to match your version
```

Then build:
```bash
anchor clean
anchor build
```

## Solution 2: Ignore the Warning and Build Anyway

The warning says "Trying globally installed anchor" - this means it WILL use your installed version. Just proceed:

```bash
cd /mnt/c/Users/PreSafu/Desktop/POWERsol
source "$HOME/.cargo/env"
anchor clean
anchor build
```

The warning is just a warning - the build should still work!

## Solution 3: Use Anchor from Cargo Instead

```bash
# Remove npm version
sudo npm uninstall -g @coral-xyz/anchor-cli

# Install via Cargo
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force

# Add to PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Verify
which anchor
anchor --version

# Build
anchor clean
anchor build
```

## Solution 4: Test Without Building (Recommended!)

**The program is already deployed!** We don't need to build to test:

```powershell
# From PowerShell - works RIGHT NOW:
node scripts/trigger-snapshot-raw.js
```

This tests the 50/50 rollover without needing the IDL!

## Quick Fix: Just Change Anchor.toml

The easiest fix - just match Anchor.toml to your installed version:

1. Open `Anchor.toml`
2. Change `anchor_version = "0.32.1"` to `anchor_version = "0.31.0"`
3. Run `anchor build`

This should work!


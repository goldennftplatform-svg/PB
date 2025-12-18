# 🔧 WSL Build Troubleshooting Guide

## Common Errors & Solutions

### Error 1: "command not found: anchor"
**Solution:**
```bash
# Install Anchor CLI
npm install -g @coral-xyz/anchor-cli

# Or use cargo
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force
```

### Error 2: "command not found: cargo" or "rustc"
**Solution:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Verify installation
rustc --version
cargo --version
```

### Error 3: "Can't get home directory path: environment variable not found"
**Solution:**
```bash
# Set HOME variable
export HOME=$HOME
# Or if that doesn't work:
export HOME=/home/$(whoami)

# Then try build again
anchor build
```

### Error 4: "error: could not compile serde_core"
**Solution:**
```bash
# Update Rust toolchain
rustup update stable
rustup default stable

# Clean and rebuild
cargo clean
anchor clean
anchor build
```

### Error 5: "Permission denied" or file access issues
**Solution:**
```bash
# Fix permissions (if needed)
chmod +x build-in-wsl.sh

# Or copy project to WSL home directory
cp -r /mnt/c/Users/PreSafu/Desktop/POWERsol ~/POWERsol
cd ~/POWERsol
anchor build
```

### Error 6: "No such file or directory" for target/idl
**Solution:**
```bash
# Create target directory if missing
mkdir -p target/idl

# Then build
anchor build
```

### Error 7: Solana CLI not found
**Solution:**
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Add to PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify
solana --version
```

### Error 8: Version mismatch warnings
**Solution:**
```bash
# Check Anchor version
anchor --version

# Update Anchor CLI
npm install -g @coral-xyz/anchor-cli@latest

# Or match version in Anchor.toml
# Edit Anchor.toml to match your CLI version
```

## Quick Diagnostic Script

Run this to check your environment:

```bash
echo "=== Environment Check ==="
echo "Rust: $(rustc --version 2>&1 || echo 'NOT INSTALLED')"
echo "Cargo: $(cargo --version 2>&1 || echo 'NOT INSTALLED')"
echo "Anchor: $(anchor --version 2>&1 || echo 'NOT INSTALLED')"
echo "Solana: $(solana --version 2>&1 || echo 'NOT INSTALLED')"
echo "Node: $(node --version 2>&1 || echo 'NOT INSTALLED')"
echo "HOME: $HOME"
echo "PWD: $(pwd)"
echo "========================="
```

## Step-by-Step Fresh Setup

If nothing works, do a fresh setup:

```bash
# 1. Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 2. Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# 3. Install Anchor CLI
npm install -g @coral-xyz/anchor-cli

# 4. Navigate to project
cd /mnt/c/Users/PreSafu/Desktop/POWERsol

# 5. Set environment
export HOME=$HOME
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# 6. Clean and build
anchor clean
anchor build
```

## Alternative: Build in WSL Home Directory

If Windows file permissions are causing issues:

```bash
# Copy project to WSL home
cp -r /mnt/c/Users/PreSafu/Desktop/POWERsol ~/POWERsol
cd ~/POWERsol

# Build
anchor clean
anchor build

# Copy IDL back to Windows location (if needed)
cp target/idl/lottery.json /mnt/c/Users/PreSafu/Desktop/POWERsol/target/idl/
```

## Still Having Issues?

**Please share:**
1. The exact error message
2. Output of: `rustc --version && cargo --version && anchor --version`
3. Output of: `echo $HOME && pwd`

This will help diagnose the specific issue!


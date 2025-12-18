# 🔧 Installing Anchor CLI in WSL (Permission Fix)

## The Problem
`EACCES: permission denied` when installing Anchor CLI globally.

## Solution 1: Use sudo (Quick Fix)
```bash
sudo npm install -g @coral-xyz/anchor-cli
```

## Solution 2: Fix npm Permissions (Recommended)
```bash
# Create a directory for global packages
mkdir ~/.npm-global

# Configure npm to use this directory
npm config set prefix '~/.npm-global'

# Add to PATH (add this to ~/.bashrc or ~/.zshrc)
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Now install without sudo
npm install -g @coral-xyz/anchor-cli
```

## Solution 3: Install via Cargo (Alternative)
```bash
# Install via Rust/Cargo instead of npm
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force
```

## After Installation
```bash
# Verify installation
anchor --version

# Source cargo env (if you just installed Rust)
source "$HOME/.cargo/env"

# Navigate to project
cd /mnt/c/Users/PreSafu/Desktop/POWERsol

# Try building
anchor clean
anchor build
```


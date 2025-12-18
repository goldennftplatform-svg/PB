#!/bin/bash
# Fix Anchor version mismatch

echo "🔧 Fixing Anchor Version Mismatch"
echo "=================================="
echo ""

# Check current Anchor version
echo "📦 Current Anchor version:"
anchor --version
echo ""

# Check Anchor.toml version
PROJECT_DIR="/mnt/c/Users/PreSafu/Desktop/POWERsol"
cd "$PROJECT_DIR" || exit 1

if [ -f "Anchor.toml" ]; then
    echo "📄 Checking Anchor.toml..."
    if grep -q "anchor_version" Anchor.toml; then
        EXPECTED_VERSION=$(grep "anchor_version" Anchor.toml | head -1 | sed 's/.*= *"\(.*\)".*/\1/')
        echo "   Expected: $EXPECTED_VERSION"
    fi
    echo ""
fi

echo "💡 Options:"
echo "   1. Update Anchor CLI to match project (recommended)"
echo "   2. Update Anchor.toml to match installed version"
echo ""

# Option 1: Update Anchor CLI
echo "🔄 Updating Anchor CLI..."
echo "   This may take a few minutes..."
echo ""

# Try npm first
if command -v npm &> /dev/null; then
    echo "   Trying npm..."
    sudo npm install -g @coral-xyz/anchor-cli@latest 2>&1 | grep -E "(added|changed|removed|error)" || true
fi

# Try cargo as backup
if command -v cargo &> /dev/null; then
    echo "   Trying cargo..."
    cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force 2>&1 | tail -5 || true
fi

echo ""
echo "✅ Verification:"
anchor --version
echo ""

echo "🚀 Now try building:"
echo "   cd /mnt/c/Users/PreSafu/Desktop/POWERsol"
echo "   anchor clean"
echo "   anchor build"


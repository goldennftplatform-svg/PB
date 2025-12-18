#!/bin/bash
# Diagnose Anchor version issues

echo "🔍 Anchor Version Diagnosis"
echo "============================"
echo ""

echo "1. Checking which anchor is being used:"
which anchor
echo ""

echo "2. Anchor version:"
anchor --version 2>&1
echo ""

echo "3. All anchor installations:"
find /usr -name "anchor" 2>/dev/null
find ~/.cargo -name "anchor" 2>/dev/null
find ~/.npm -name "anchor" 2>/dev/null
echo ""

echo "4. npm global packages:"
npm list -g @coral-xyz/anchor-cli 2>/dev/null || echo "Not found via npm"
echo ""

echo "5. Cargo installed binaries:"
cargo install --list | grep anchor || echo "Not found via cargo"
echo ""

echo "6. PATH:"
echo $PATH | tr ':' '\n' | grep -E "(cargo|npm|anchor)"
echo ""

echo "7. Anchor.toml expected version:"
grep "anchor_version" Anchor.toml 2>/dev/null || echo "Not found"
echo ""


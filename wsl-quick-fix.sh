#!/bin/bash
# Quick fix: Update Anchor and build

echo "🔄 Updating Anchor CLI..."
echo ""

# Update Anchor to latest
sudo npm install -g @coral-xyz/anchor-cli@latest

echo ""
echo "✅ Updated! Checking version..."
anchor --version

echo ""
echo "🚀 Now building..."
echo ""

# Navigate to project
cd /mnt/c/Users/PreSafu/Desktop/POWERsol

# Source cargo env
source "$HOME/.cargo/env" 2>/dev/null || true

# Clean and build
echo "🧹 Cleaning..."
anchor clean

echo ""
echo "🔨 Building (this may take a few minutes)..."
echo ""
anchor build

# Check result
if [ $? -eq 0 ] && [ -f "target/idl/lottery.json" ]; then
    echo ""
    echo "✅ SUCCESS! IDL generated!"
    echo "   Location: target/idl/lottery.json"
    echo ""
    echo "🎉 You can now run the test from PowerShell:"
    echo "   node scripts/run-full-test-now.js"
else
    echo ""
    echo "⚠️  Build completed but check for errors above"
fi








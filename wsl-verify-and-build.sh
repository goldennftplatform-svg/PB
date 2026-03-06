#!/bin/bash
# Verify Anchor installation and build

echo "🔍 Verifying Installation"
echo "========================="
echo ""

# Check if Anchor is installed
if command -v anchor &> /dev/null; then
    echo "✅ Anchor CLI found!"
    anchor --version
    echo ""
else
    echo "❌ Anchor CLI not found in PATH"
    echo ""
    echo "💡 Try one of these:"
    echo "   1. sudo npm install -g @coral-xyz/anchor-cli"
    echo "   2. cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force"
    echo ""
    exit 1
fi

# Source cargo env
echo "📦 Loading Rust environment..."
source "$HOME/.cargo/env" 2>/dev/null || true
echo ""

# Navigate to project
PROJECT_DIR="/mnt/c/Users/PreSafu/Desktop/POWERsol"
if [ -d "$PROJECT_DIR" ]; then
    echo "📁 Navigating to project..."
    cd "$PROJECT_DIR"
    echo "   ✅ In: $(pwd)"
    echo ""
else
    echo "❌ Project directory not found: $PROJECT_DIR"
    exit 1
fi

# Check if Anchor.toml exists
if [ ! -f "Anchor.toml" ]; then
    echo "❌ Anchor.toml not found!"
    exit 1
fi

# Clean previous build
echo "🧹 Cleaning previous build..."
anchor clean
echo ""

# Build
echo "🔨 Building programs..."
echo "   This may take a few minutes..."
echo ""
anchor build

# Check result
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ BUILD SUCCESSFUL!"
    echo ""
    
    # Check if IDL was generated
    if [ -f "target/idl/lottery.json" ]; then
        echo "✅ IDL generated: target/idl/lottery.json"
        
        # Check for new fields
        if grep -q "rollover_count" target/idl/lottery.json; then
            echo "   ✅ rollover_count found in IDL"
        fi
        if grep -q "pepe_ball_count" target/idl/lottery.json; then
            echo "   ✅ pepe_ball_count found in IDL"
        fi
        echo ""
        echo "🎉 Ready to test! Run from PowerShell:"
        echo "   node scripts/run-full-test-now.js"
    else
        echo "⚠️  IDL file not found (but build succeeded)"
    fi
else
    echo ""
    echo "❌ BUILD FAILED"
    echo "   Check the error messages above"
    exit 1
fi








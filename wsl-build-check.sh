#!/bin/bash
# Quick diagnostic script for WSL build issues

echo "🔍 WSL Build Environment Check"
echo "=============================="
echo ""

# Check Rust
echo "📦 Rust:"
if command -v rustc &> /dev/null; then
    echo "   ✅ $(rustc --version)"
else
    echo "   ❌ NOT INSTALLED"
    echo "   Install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
fi
echo ""

# Check Cargo
echo "📦 Cargo:"
if command -v cargo &> /dev/null; then
    echo "   ✅ $(cargo --version)"
else
    echo "   ❌ NOT INSTALLED"
fi
echo ""

# Check Anchor
echo "📦 Anchor:"
if command -v anchor &> /dev/null; then
    echo "   ✅ $(anchor --version)"
else
    echo "   ❌ NOT INSTALLED"
    echo "   Install: npm install -g @coral-xyz/anchor-cli"
fi
echo ""

# Check Solana
echo "📦 Solana CLI:"
if command -v solana &> /dev/null; then
    echo "   ✅ $(solana --version)"
else
    echo "   ❌ NOT INSTALLED"
    echo "   Install: sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
fi
echo ""

# Check Node
echo "📦 Node.js:"
if command -v node &> /dev/null; then
    echo "   ✅ $(node --version)"
else
    echo "   ❌ NOT INSTALLED"
fi
echo ""

# Check environment
echo "🌍 Environment:"
echo "   HOME: $HOME"
echo "   PWD: $(pwd)"
echo "   USER: $(whoami)"
echo ""

# Check project directory
echo "📁 Project:"
if [ -f "Anchor.toml" ]; then
    echo "   ✅ Anchor.toml found"
    echo "   📍 Location: $(pwd)"
else
    echo "   ❌ Anchor.toml not found"
    echo "   💡 Make sure you're in the project directory"
    echo "   💡 Try: cd /mnt/c/Users/PreSafu/Desktop/POWERsol"
fi
echo ""

# Check target directory
echo "📁 Build Directories:"
if [ -d "target" ]; then
    echo "   ✅ target/ exists"
    if [ -d "target/idl" ]; then
        echo "   ✅ target/idl/ exists"
        if [ -f "target/idl/lottery.json" ]; then
            echo "   ✅ IDL file exists"
        else
            echo "   ⚠️  IDL file missing (needs build)"
        fi
    else
        echo "   ⚠️  target/idl/ missing"
    fi
else
    echo "   ⚠️  target/ missing (will be created on build)"
fi
echo ""

# Check permissions
echo "🔐 Permissions:"
if [ -w "." ]; then
    echo "   ✅ Current directory is writable"
else
    echo "   ❌ Current directory is NOT writable"
    echo "   💡 Try: chmod u+w ."
fi
echo ""

echo "=============================="
echo "✅ Check complete!"
echo ""
echo "💡 If anything is missing, see WSL_BUILD_TROUBLESHOOTING.md"
echo ""








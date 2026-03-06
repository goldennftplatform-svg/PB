#!/bin/bash
# Build script for WSL to fix IDL generation

echo "🔧 Building in WSL..."
echo "===================="
echo ""

# Navigate to project directory (adjust path if needed)
cd /mnt/c/Users/PreSafu/Desktop/POWERsol || cd ~/POWERsol

echo "📁 Current directory: $(pwd)"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
anchor clean
echo ""

# Build
echo "🔨 Building programs..."
anchor build

# Check if IDL was generated
if [ -f "target/idl/lottery.json" ]; then
    echo ""
    echo "✅ IDL generated successfully!"
    echo "   Location: target/idl/lottery.json"
    echo ""
    echo "📊 Checking for new fields..."
    if grep -q "rollover_count" target/idl/lottery.json; then
        echo "   ✅ rollover_count found in IDL"
    fi
    if grep -q "pepe_ball_count" target/idl/lottery.json; then
        echo "   ✅ pepe_ball_count found in IDL"
    fi
else
    echo ""
    echo "❌ IDL generation failed"
    echo "   Check build errors above"
fi

echo ""
echo "✅ Build complete!"


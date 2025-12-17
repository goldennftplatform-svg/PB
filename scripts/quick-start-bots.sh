#!/bin/bash
# Quick start script for bot testing

echo "🤖 PEPEBALL Bot Testing - Quick Start"
echo "========================================"
echo ""

# Check if Solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Please install it first."
    exit 1
fi

# Create wallets
echo "Step 1: Creating bot wallets..."
node scripts/create-bot-wallets.js

if [ $? -ne 0 ]; then
    echo "❌ Failed to create wallets"
    exit 1
fi

echo ""
echo "Step 2: Funding bot wallets with devnet SOL..."
echo "⚠️  This may take a few minutes due to rate limits..."
node scripts/fund-bot-wallets.js

if [ $? -ne 0 ]; then
    echo "⚠️  Some bots may not have been funded. You can run this again."
fi

echo ""
echo "Step 3: Ready to run bots!"
echo ""
echo "To run all bots:"
echo "  node scripts/run-all-bots.js"
echo ""
echo "To run a single bot:"
echo "  node scripts/bot-trader.js 1"
echo ""



















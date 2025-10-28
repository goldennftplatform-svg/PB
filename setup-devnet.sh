#!/bin/bash

# PEPEBALL Devnet Setup Script
# Run this script to quickly set up devnet testing environment

echo "🎰 PEPEBALL Devnet Setup Starting..."
echo "=================================="

# Step 1: Check Solana installation
echo ""
echo "📋 Step 1: Checking Solana CLI..."
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found!"
    echo "Install from: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
else
    echo "✅ Solana CLI found: $(solana --version)"
fi

# Step 2: Check Anchor installation
echo ""
echo "📋 Step 2: Checking Anchor..."
if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor not found!"
    echo "Install with: npm install -g @coral-xyz/anchor-cli"
    exit 1
else
    echo "✅ Anchor found: $(anchor --version)"
fi

# Step 3: Set Solana to devnet
echo ""
echo "📋 Step 3: Configuring Solana for devnet..."
solana config set --url devnet
echo "✅ Solana configured for devnet"

# Step 4: Display current configuration
echo ""
echo "📋 Step 4: Current Solana configuration:"
solana config get

# Step 5: Check and request devnet SOL
echo ""
echo "📋 Step 5: Checking devnet SOL balance..."
BALANCE=$(solana balance 2>/dev/null | awk '{print $1}')
echo "Current balance: $BALANCE SOL"

if [ "$BALANCE" -lt 1 ]; then
    echo "⚠️  Low balance. Requesting devnet SOL..."
    solana airdrop 2
    echo "Waiting for airdrop to confirm..."
    sleep 5
    BALANCE=$(solana balance 2>/dev/null | awk '{print $1}')
    echo "New balance: $BALANCE SOL"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Build programs: anchor build"
echo "2. Deploy to devnet: anchor deploy --provider.cluster devnet"
echo "3. Run tests: anchor test --cluster devnet"
echo "4. Read DEVNET_TESTING_GUIDE.md for detailed instructions"
echo ""


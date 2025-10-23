#!/bin/bash

# PEPEBALL Testnet Token Creation
echo "🐸 Creating PEPEBALL Testnet Token..."

# Set to devnet
solana config set --url devnet

# Token metadata
TOKEN_NAME="PEPEBALL"
TOKEN_SYMBOL="PEPE"
TOKEN_DECIMALS=9
TOKEN_SUPPLY=1000000000  # 1 billion tokens

# Create token mint
echo "Creating token mint..."
TOKEN_MINT=$(spl-token create-token --decimals $TOKEN_DECIMALS)
echo "Token Mint: $TOKEN_MINT"

# Create token account
echo "Creating token account..."
TOKEN_ACCOUNT=$(spl-token create-account $TOKEN_MINT)
echo "Token Account: $TOKEN_ACCOUNT"

# Mint initial supply
echo "Minting initial supply..."
spl-token mint $TOKEN_MINT $TOKEN_SUPPLY

# Create metadata
echo "Creating token metadata..."
cat > token-metadata.json << EOF
{
    "name": "$TOKEN_NAME",
    "symbol": "$TOKEN_SYMBOL",
    "description": "PEPEBALL - The Ultimate Powerball Lottery Token",
    "image": "https://your-image-url.com/pepeball.png",
    "attributes": [
        {
            "trait_type": "Type",
            "value": "Lottery Token"
        },
        {
            "trait_type": "Tax Rate",
            "value": "2.5%"
        },
        {
            "trait_type": "Creator Fund",
            "value": "0.05%"
        }
    ]
}
EOF

echo "✅ Testnet token created!"
echo "🔗 Token Mint: $TOKEN_MINT"
echo "💰 Token Account: $TOKEN_ACCOUNT"
echo "📊 Supply: $TOKEN_SUPPLY tokens"
echo "🌐 View on Solana Explorer: https://explorer.solana.com/address/$TOKEN_MINT?cluster=devnet"

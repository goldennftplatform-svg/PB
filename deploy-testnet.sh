#!/bin/bash

# PEPEBALL Testnet Deployment Script
echo "🐸 PEPEBALL Testnet Deployment Starting..."

# Set Solana to devnet
solana config set --url devnet

# Check if wallet exists, create if not
if [ ! -f ~/.config/solana/id.json ]; then
    echo "Creating new wallet..."
    solana-keygen new --outfile ~/.config/solana/id.json --no-bip39-passphrase
fi

# Get wallet address
WALLET_ADDRESS=$(solana address)
echo "Wallet Address: $WALLET_ADDRESS"

# Request airdrop
echo "Requesting SOL airdrop..."
solana airdrop 2 $WALLET_ADDRESS

# Check balance
BALANCE=$(solana balance)
echo "Current Balance: $BALANCE SOL"

# Build the program
echo "Building PEPEBALL contracts..."
anchor build

# Deploy to devnet
echo "Deploying to devnet..."
anchor deploy --provider.cluster devnet

echo "✅ Testnet deployment complete!"
echo "🔗 Program IDs saved to target/deploy/"
echo "💰 Use this wallet for testing: $WALLET_ADDRESS"
echo "🌐 Devnet Explorer: https://explorer.solana.com/?cluster=devnet"

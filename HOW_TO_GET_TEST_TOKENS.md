# 🪙 How to Get Test Tokens on Devnet

## Quick Answer

**Yes, you can use the Contract Address (CA) from the website to buy/swap tokens on devnet!**

The token contract address is: `HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR`

## Methods to Obtain Test Tokens

### Method 1: Using Jupiter Aggregator (Easiest) ⭐

1. **Switch Phantom to Devnet**
   - Open Phantom wallet
   - Settings → Developer Mode
   - Toggle "Test Mode" ON
   - Change network to **Devnet**

2. **Get Devnet SOL**
   - Visit: https://faucet.solana.com/
   - Enter your wallet address
   - Request 2 SOL (can repeat if needed)
   - OR use CLI: `solana airdrop 2 YOUR_ADDRESS`

3. **Swap SOL for Tokens on Jupiter**
   - Visit: https://jup.ag/swap
   - **Important**: Make sure you're on Devnet!
   - Select SOL as input
   - Paste token address: `HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR`
   - Enter amount to swap
   - Connect wallet and swap

4. **Alternative: Direct Jupiter Link**
   ```
   https://jup.ag/swap/SOL-HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR?cluster=devnet
   ```

### Method 2: Using Pump.Fun (If Available on Devnet)

1. **Visit Pump.Fun**
   - Go to: https://pump.fun/
   - **Switch to Devnet** (if option available)
   - Search for token address: `HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR`

2. **Buy Tokens**
   - Connect wallet (make sure it's on Devnet!)
   - Enter amount
   - Buy tokens

### Method 3: Using Raydium (Devnet)

1. **Visit Raydium Devnet**
   - Go to: https://devnet.raydium.io/swap
   - Connect wallet (Devnet mode)
   - Select SOL → Token
   - Paste token address: `HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR`
   - Swap

### Method 4: Direct Program Interaction (Advanced)

If you have the token minted and liquidity added, you can interact directly:

```bash
# Using Solana CLI
spl-token swap \
  --input-mint So11111111111111111111111111111111111111112 \
  --output-mint HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR \
  --amount 1000000000 \
  --output-owner YOUR_WALLET_ADDRESS
```

## Important Notes

### ⚠️ Network Must Match!

- **Website shows**: Devnet contract address
- **Your wallet must be**: On Devnet
- **DEX must be**: On Devnet
- **All must match!**

### 🔍 Verify Token Address

The token contract address from your website:
```
Token: HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR
```

View on Explorer:
- https://explorer.solana.com/address/HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR?cluster=devnet
- https://solscan.io/token/HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR?cluster=devnet

### 💡 For Non-Test Wallets

If you want to use a **real wallet** (not test wallet):

1. **Create a new wallet** for testing (recommended)
   - Don't use your mainnet wallet
   - Create a separate Phantom profile
   - Switch that profile to Devnet

2. **Or use a different wallet app**
   - Solflare
   - Backpack
   - Create new wallet just for devnet testing

3. **Import wallet to Devnet**
   - Export private key from your wallet
   - Import to Phantom (Devnet mode)
   - **WARNING**: Only do this with a test wallet, never with real funds!

## Step-by-Step: Complete Flow

### 1. Setup Wallet for Devnet

```bash
# Check current network
solana config get

# Switch to devnet
solana config set --url devnet

# Get devnet SOL
solana airdrop 2

# Verify balance
solana balance
```

### 2. Add Token to Wallet

**In Phantom:**
1. Open Phantom wallet
2. Click "+" to add token
3. Paste: `HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR`
4. Click "Add"

**Or use the website:**
- Visit your frontend
- Click "Add to Wallet" button
- It will automatically add the token

### 3. Swap SOL for Tokens

**Option A: Via Website**
1. Visit your frontend (make sure it's on devnet)
2. Click "Buy Tokens"
3. It will open Jupiter/Pump.Fun
4. Complete the swap

**Option B: Direct Jupiter**
1. Go to: https://jup.ag/swap
2. Make sure URL shows `?cluster=devnet`
3. Swap SOL → Token

### 4. Verify Tokens Received

```bash
# Check token balance
spl-token accounts --owner YOUR_WALLET_ADDRESS

# Or check in Phantom wallet
# Token should appear in your wallet
```

## Troubleshooting

### "Token not found"
- Make sure you're on **Devnet**, not Mainnet
- Verify the contract address is correct
- Token might not have liquidity yet

### "Insufficient liquidity"
- Token might need liquidity added first
- Check if there's a liquidity pool
- You might need to add liquidity yourself (if you're the deployer)

### "Transaction failed"
- Check you have enough SOL for fees
- Verify network is Devnet
- Check token program is deployed

### "Can't find token on Jupiter"
- Jupiter might not have the token listed yet
- Try Raydium or direct swap
- Token might need to be added to DEX aggregators

## For Developers: Adding Liquidity

If you need to add liquidity for testing:

```bash
# Create liquidity pool (if using Raydium)
# Or use the LP Manager program
# See scripts/add-liquidity.js
```

## Quick Reference

| Item | Value |
|------|-------|
| **Token Address** | `HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR` |
| **Network** | Devnet |
| **Jupiter Link** | https://jup.ag/swap/SOL-HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR?cluster=devnet |
| **Explorer** | https://explorer.solana.com/address/HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR?cluster=devnet |
| **Solscan** | https://solscan.io/token/HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR?cluster=devnet |

## Summary

✅ **Yes, you can use the CA from the website**
✅ **Switch wallet to Devnet first**
✅ **Use Jupiter/Raydium to swap SOL → Token**
✅ **Create separate wallet for testing (recommended)**

The token address `HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR` works on devnet - just make sure everything is on the same network!



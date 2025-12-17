# ⚖️ Auto-Balancing LP with Delta-Neutral Hedging

## Overview

This system implements automatic rebalancing of Orca Whirlpool positions to maintain delta-neutral exposure. It monitors your LP position and automatically adjusts it when delta deviation exceeds the threshold.

## Features

- ✅ **Delta-Neutral Hedging**: Maintains zero net delta exposure
- ✅ **Auto-Rebalancing**: Automatically adjusts positions when needed
- ✅ **Orca Whirlpool Integration**: Works with Orca's concentrated liquidity pools
- ✅ **Real-time Monitoring**: Continuously monitors position and price
- ✅ **Flexible Configuration**: Adjustable thresholds and target delta

## Architecture

### On-Chain (Rust Program)

The `lp-manager` program now includes:

1. **`initialize_orca_position`**: Sets up Orca position with tick range
2. **`calculate_delta`**: Calculates current delta exposure
3. **`auto_rebalance`**: Executes rebalancing when needed
4. **`update_position_ticks`**: Shifts position ticks to adjust exposure
5. **`set_target_delta`**: Sets target delta (0 = delta-neutral)

### Off-Chain (JavaScript Scripts)

1. **`auto-rebalance-lp.js`**: Main monitoring and rebalancing script
2. **`initialize-orca-position.js`**: Sets up initial Orca position
3. **`orca-whirlpool-utils.js`**: Helper utilities for Orca calculations

## Setup

### 1. Build the Program

```bash
anchor build
```

### 2. Deploy the Program

```bash
anchor deploy --provider.cluster devnet
```

### 3. Initialize Orca Position

```bash
# Initialize with optimal 10% range (recommended)
node scripts/initialize-orca-position.js init 0.1

# Or initialize with custom ticks
node scripts/initialize-orca-position.js ticks -1000 1000
```

### 4. Start Auto-Rebalancer

```bash
node scripts/auto-rebalance-lp.js
```

## Usage

### Initialize Position

```bash
# Initialize with 10% price range (default)
node scripts/initialize-orca-position.js init 0.1

# Initialize with 20% price range
node scripts/initialize-orca-position.js init 0.2

# Initialize with custom ticks
node scripts/initialize-orca-position.js ticks -500 500
```

### Update Position

```bash
# Update tick range
node scripts/initialize-orca-position.js update -800 800

# Set target delta (0 = delta-neutral)
node scripts/initialize-orca-position.js delta 0
```

### Monitor and Rebalance

```bash
# Start auto-rebalancer (runs continuously)
node scripts/auto-rebalance-lp.js
```

The rebalancer will:
- Check position every 30 seconds
- Calculate current delta
- Rebalance if deviation exceeds threshold (default: 1000)
- Log all actions

## Configuration

### Rebalance Threshold

Edit `scripts/auto-rebalance-lp.js`:

```javascript
const REBALANCE_THRESHOLD = 1000; // Minimum delta deviation to trigger rebalance
```

### Check Interval

```javascript
const CHECK_INTERVAL = 30000; // Check every 30 seconds
```

### Price Update Interval

```javascript
const PRICE_UPDATE_INTERVAL = 10000; // Update price every 10 seconds
```

## How Delta-Neutral Hedging Works

### Delta Calculation

Delta measures your exposure to price movements:
- **Positive Delta**: Long exposure (profit when price goes up)
- **Negative Delta**: Short exposure (profit when price goes down)
- **Zero Delta**: Delta-neutral (minimal price exposure)

### Rebalancing Strategy

1. **Monitor**: Continuously calculate current delta
2. **Compare**: Compare current delta to target delta (0 for delta-neutral)
3. **Rebalance**: If deviation > threshold, adjust position:
   - Positive deviation: Reduce long exposure (shift ticks down)
   - Negative deviation: Reduce short exposure (shift ticks up)

### Tick Range Management

The system uses Orca's concentrated liquidity model:
- **Tick Lower/Upper**: Define the price range for your position
- **Current Price**: Where the token is trading now
- **Position in Range**: Determines delta exposure

## Example Workflow

1. **Initial Setup**:
   ```bash
   # Initialize position with 10% range around current price
   node scripts/initialize-orca-position.js init 0.1
   ```

2. **Start Monitoring**:
   ```bash
   # Start auto-rebalancer
   node scripts/auto-rebalance-lp.js
   ```

3. **Monitor Output**:
   ```
   📊 Position Status:
      Current Price: 1.000000 SOL
      Current Delta: 50000
      Target Delta: 0
      Deviation: 50000
      Threshold: 1000
   
   ⚠️  Delta deviation exceeds threshold! Rebalancing...
   🔄 Executing rebalance...
   ✅ Rebalance executed. Tx: 5xK...
   ```

## Advanced Features

### Custom Target Delta

You can set a non-zero target delta for directional hedging:

```bash
# Set target delta to +10000 (slight long bias)
node scripts/initialize-orca-position.js delta 10000
```

### Dynamic Tick Adjustment

The system can automatically adjust tick ranges to maintain delta-neutral exposure:

```bash
# Update ticks to shift exposure
node scripts/initialize-orca-position.js update -1200 800
```

## Integration with Orca

The system is designed to work with Orca Whirlpool positions. To fully integrate:

1. **Create Orca Position**: Use Orca UI or SDK to create a Whirlpool position
2. **Link Position**: Update `orca_whirlpool` and `orca_position_nft` in LP Manager
3. **Monitor**: The auto-rebalancer will monitor and adjust as needed

## Troubleshooting

### "Orca position not initialized"

Run the initialization script:
```bash
node scripts/initialize-orca-position.js init 0.1
```

### "IDL not found"

Build the program first:
```bash
anchor build
```

### Price fetching errors

The script uses Jupiter API for prices. If it fails, it falls back to a default price. For production, integrate with Orca's price oracle.

## Security Considerations

- ⚠️ **Admin Only**: Only the admin wallet can execute rebalancing
- ⚠️ **Thresholds**: Set appropriate thresholds to avoid over-trading
- ⚠️ **Gas Costs**: Rebalancing incurs transaction fees
- ⚠️ **Slippage**: Large rebalances may experience slippage

## Next Steps

1. **Full Orca Integration**: Integrate with Orca SDK for direct position management
2. **Price Oracle**: Use on-chain price oracles for more reliable pricing
3. **Multi-Pool Support**: Extend to support multiple pools
4. **Advanced Strategies**: Implement more sophisticated hedging strategies

## Resources

- [Orca Whirlpool Docs](https://docs.orca.so/whirlpools/)
- [Delta-Neutral Hedging Explained](https://www.investopedia.com/terms/d/deltaneutral.asp)
- [Concentrated Liquidity](https://docs.uniswap.org/concepts/protocol/concentrated-liquidity)

---

**Built with ❤️ for POWERsol**








// Orca Whirlpool Utilities for LP Management
// Helper functions for interacting with Orca Whirlpool positions

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Orca Whirlpool Program IDs
const ORCA_WHIRLPOOL_PROGRAM_DEVNET = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');
const ORCA_WHIRLPOOL_PROGRAM_MAINNET = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');

class OrcaWhirlpoolUtils {
    constructor(connection, network = 'devnet') {
        this.connection = connection;
        this.network = network;
        this.programId = network === 'mainnet' 
            ? ORCA_WHIRLPOOL_PROGRAM_MAINNET 
            : ORCA_WHIRLPOOL_PROGRAM_DEVNET;
    }

    /**
     * Calculate tick from price
     * tick = log_1.0001(price)
     */
    priceToTick(price) {
        // price = 1.0001^tick
        // tick = log(price) / log(1.0001)
        return Math.floor(Math.log(price) / Math.log(1.0001));
    }

    /**
     * Calculate price from tick
     * price = 1.0001^tick
     */
    tickToPrice(tick) {
        return Math.pow(1.0001, tick);
    }

    /**
     * Calculate tick spacing based on fee tier
     * Orca uses different tick spacings for different fee tiers
     */
    getTickSpacing(feeTier = 64) {
        // Common tick spacings: 1, 8, 64, 128
        return feeTier;
    }

    /**
     * Calculate optimal tick range for delta-neutral position
     * Centers range around current price
     */
    calculateOptimalTickRange(currentPrice, rangePercentage = 0.1) {
        const currentTick = this.priceToTick(currentPrice);
        const tickSpacing = this.getTickSpacing(64);
        
        // Calculate range in ticks
        const rangeTicks = Math.floor((currentTick * rangePercentage) / tickSpacing) * tickSpacing;
        
        const tickLower = currentTick - rangeTicks;
        const tickUpper = currentTick + rangeTicks;
        
        return {
            tickLower: Math.floor(tickLower / tickSpacing) * tickSpacing,
            tickUpper: Math.ceil(tickUpper / tickSpacing) * tickSpacing,
            currentTick,
            rangePercentage
        };
    }

    /**
     * Calculate liquidity amount for a given position
     */
    calculateLiquidity(amount0, amount1, tickLower, tickUpper, currentTick) {
        // Simplified liquidity calculation
        // In reality, Orca uses more complex formulas
        if (currentTick < tickLower) {
            // All in token0
            return amount0;
        } else if (currentTick > tickUpper) {
            // All in token1
            return amount1;
        } else {
            // Split between both tokens
            const priceLower = this.tickToPrice(tickLower);
            const priceUpper = this.tickToPrice(tickUpper);
            const currentPrice = this.tickToPrice(currentTick);
            
            // Calculate proportional liquidity
            const liquidity0 = amount0 * (currentPrice - priceLower) / (priceUpper - priceLower);
            const liquidity1 = amount1 * (priceUpper - currentPrice) / (priceUpper - priceLower);
            
            return liquidity0 + liquidity1;
        }
    }

    /**
     * Calculate delta for a concentrated liquidity position
     */
    calculatePositionDelta(liquidity, tickLower, tickUpper, currentTick, currentPrice) {
        const priceLower = this.tickToPrice(tickLower);
        const priceUpper = this.tickToPrice(tickUpper);
        
        if (currentPrice < priceLower) {
            // Below range - no exposure
            return 0;
        } else if (currentPrice > priceUpper) {
            // Above range - full long exposure
            return liquidity;
        } else {
            // In range - proportional exposure
            const priceRange = priceUpper - priceLower;
            const priceInRange = currentPrice - priceLower;
            const exposureRatio = priceInRange / priceRange;
            
            // Delta is proportional to position in range
            return liquidity * exposureRatio;
        }
    }

    /**
     * Get position info from Orca Whirlpool
     * Note: This requires the Orca SDK or direct program interaction
     */
    async getPositionInfo(positionNftMint) {
        try {
            // This would require the Orca SDK
            // For now, return a placeholder structure
            console.log('⚠️  Position info fetching requires Orca SDK');
            console.log(`   Position NFT: ${positionNftMint.toString()}`);
            
            return {
                positionNft: positionNftMint.toString(),
                whirlpool: null,
                tickLower: null,
                tickUpper: null,
                liquidity: null,
                token0Amount: null,
                token1Amount: null
            };
        } catch (error) {
            console.error('Error fetching position info:', error.message);
            throw error;
        }
    }

    /**
     * Calculate rebalance parameters
     */
    calculateRebalanceParams(currentDelta, targetDelta, currentTick, tickLower, tickUpper) {
        const deviation = currentDelta - targetDelta;
        const tickSpacing = this.getTickSpacing(64);
        
        // Calculate how much to shift ticks
        const tickShift = Math.floor((deviation / 1000) * tickSpacing); // Simplified
        
        const newTickLower = tickLower - tickShift;
        const newTickUpper = tickUpper - tickShift;
        
        return {
            deviation,
            tickShift,
            newTickLower: Math.floor(newTickLower / tickSpacing) * tickSpacing,
            newTickUpper: Math.ceil(newTickUpper / tickSpacing) * tickSpacing,
            shouldRebalance: Math.abs(deviation) > 1000 // Threshold
        };
    }

    /**
     * Format price for display
     */
    formatPrice(price, decimals = 6) {
        return price.toFixed(decimals);
    }

    /**
     * Format tick for display
     */
    formatTick(tick) {
        return tick.toString();
    }
}

// Example usage
async function example() {
    console.log('🌊 Orca Whirlpool Utilities\n');
    console.log('='.repeat(70) + '\n');
    
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const utils = new OrcaWhirlpoolUtils(connection, 'devnet');
    
    // Example: Calculate optimal tick range
    const currentPrice = 1.0; // 1 SOL = 1 token
    const range = utils.calculateOptimalTickRange(currentPrice, 0.1); // 10% range
    
    console.log('📊 Optimal Tick Range Calculation:');
    console.log(`   Current Price: ${currentPrice}`);
    console.log(`   Current Tick: ${range.currentTick}`);
    console.log(`   Tick Lower: ${range.tickLower}`);
    console.log(`   Tick Upper: ${range.tickUpper}`);
    console.log(`   Range: ${range.rangePercentage * 100}%\n`);
    
    // Example: Calculate delta
    const liquidity = 1000000;
    const currentTick = range.currentTick;
    const delta = utils.calculatePositionDelta(
        liquidity,
        range.tickLower,
        range.tickUpper,
        currentTick,
        currentPrice
    );
    
    console.log('⚖️  Delta Calculation:');
    console.log(`   Liquidity: ${liquidity}`);
    console.log(`   Current Delta: ${delta}`);
    console.log(`   Delta Percentage: ${(delta / liquidity * 100).toFixed(2)}%\n`);
}

if (require.main === module) {
    example()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = { OrcaWhirlpoolUtils };








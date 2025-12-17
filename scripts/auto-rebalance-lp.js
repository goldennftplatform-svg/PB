// Auto-Rebalancing LP with Delta-Neutral Hedging
// Monitors LP positions and automatically rebalances to maintain delta-neutral exposure

const { Connection, PublicKey, Keypair, clusterApiUrl } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = process.env.NETWORK || 'devnet';
const RPC_URL = process.env.RPC_URL || clusterApiUrl(NETWORK);

// Program IDs
const LP_MANAGER_PROGRAM_ID = new PublicKey('G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG');
const TOKEN_MINT = new PublicKey('CXcoVCAuQB2XigJmyGz162aj1MCgJxC9Hgo5SEuRuFto');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Orca Whirlpool Program (Devnet)
const ORCA_WHIRLPOOL_PROGRAM = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');

// Configuration
const REBALANCE_THRESHOLD = 1000; // Minimum delta deviation to trigger rebalance (in basis points)
const CHECK_INTERVAL = 30000; // Check every 30 seconds
const PRICE_UPDATE_INTERVAL = 10000; // Update price every 10 seconds

class AutoRebalancer {
    constructor(adminKeypair, connection) {
        this.admin = adminKeypair;
        this.connection = connection;
        this.program = null;
        this.lpManagerPDA = null;
        this.currentPrice = null;
        this.isRunning = false;
    }

    async initialize() {
        console.log('🚀 Initializing Auto-Rebalancer...\n');
        
        // Load IDL
        const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lp_manager.json');
        if (!fs.existsSync(idlPath)) {
            throw new Error(`IDL not found at ${idlPath}. Please build the program first.`);
        }
        
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        
        // Create program instance
        const provider = new anchor.AnchorProvider(
            this.connection,
            new anchor.Wallet(this.admin),
            { commitment: 'confirmed' }
        );
        
        this.program = new anchor.Program(idl, LP_MANAGER_PROGRAM_ID, provider);
        
        // Derive LP Manager PDA
        [this.lpManagerPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lp_manager')],
            this.program.programId
        );
        
        console.log(`✅ Program loaded: ${this.program.programId.toString()}`);
        console.log(`✅ LP Manager PDA: ${this.lpManagerPDA.toString()}`);
        console.log(`✅ Admin: ${this.admin.publicKey.toString()}\n`);
        
        // Check if LP manager is initialized
        try {
            const lpManager = await this.program.account.lpManager.fetch(this.lpManagerPDA);
            console.log('📊 LP Manager State:');
            console.log(`   Initialized: ${lpManager.isInitialized}`);
            console.log(`   Orca Position Initialized: ${lpManager.orcaPositionInitialized}`);
            console.log(`   Current Delta: ${lpManager.currentDelta}`);
            console.log(`   Target Delta: ${lpManager.targetDelta}`);
            console.log(`   Rebalance Count: ${lpManager.rebalanceCount}`);
            console.log(`   Tick Range: [${lpManager.tickLower}, ${lpManager.tickUpper}]\n`);
            
            if (!lpManager.orcaPositionInitialized) {
                console.log('⚠️  Orca position not initialized. Please initialize it first.\n');
            }
        } catch (error) {
            console.error('❌ Error fetching LP Manager:', error.message);
            throw error;
        }
    }

    async getCurrentPrice() {
        try {
            // Get price from Jupiter API or Orca
            // For now, we'll use a simplified approach
            // In production, fetch from Orca Whirlpool or Jupiter
            
            const response = await fetch(
                `https://price.jup.ag/v4/price?ids=${TOKEN_MINT.toString()}&vsToken=SOL`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.data && data.data[TOKEN_MINT.toString()]) {
                    const price = data.data[TOKEN_MINT.toString()].price;
                    // Convert to basis points (multiply by 10000)
                    return Math.floor(price * 10000);
                }
            }
            
            // Fallback: use mock price or fetch from on-chain
            console.log('⚠️  Using fallback price calculation');
            return 10000; // 1 SOL = 1 token (example)
        } catch (error) {
            console.error('Error fetching price:', error.message);
            return null;
        }
    }

    async calculateDelta(currentPrice, liquidityAmount) {
        try {
            const tx = await this.program.methods
                .calculateDelta(
                    new anchor.BN(currentPrice),
                    new anchor.BN(liquidityAmount)
                )
                .accounts({
                    lpManager: this.lpManagerPDA,
                })
                .rpc();
            
            console.log(`✅ Delta calculated. Tx: ${tx}`);
            
            // Fetch updated state
            const lpManager = await this.program.account.lpManager.fetch(this.lpManagerPDA);
            return lpManager.currentDelta.toNumber();
        } catch (error) {
            console.error('Error calculating delta:', error.message);
            throw error;
        }
    }

    async rebalance(currentPrice, currentDelta) {
        try {
            console.log('🔄 Executing rebalance...');
            
            const tx = await this.program.methods
                .autoRebalance(
                    new anchor.BN(currentPrice),
                    new anchor.BN(currentDelta),
                    new anchor.BN(REBALANCE_THRESHOLD)
                )
                .accounts({
                    lpManager: this.lpManagerPDA,
                    admin: this.admin.publicKey,
                })
                .signers([this.admin])
                .rpc();
            
            console.log(`✅ Rebalance executed. Tx: ${tx}`);
            
            // Fetch updated state
            const lpManager = await this.program.account.lpManager.fetch(this.lpManagerPDA);
            console.log(`   New rebalance count: ${lpManager.rebalanceCount}`);
            console.log(`   Last rebalance amount: ${lpManager.lastRebalanceAmount.toString()}`);
            console.log(`   Last rebalance direction: ${lpManager.lastRebalanceDirection}\n`);
            
            return true;
        } catch (error) {
            console.error('❌ Error during rebalance:', error.message);
            return false;
        }
    }

    async checkAndRebalance() {
        try {
            // Get current price
            const price = await this.getCurrentPrice();
            if (!price) {
                console.log('⚠️  Could not fetch price, skipping check...');
                return;
            }
            
            this.currentPrice = price;
            
            // Get liquidity amount (simplified - in production, fetch from Orca position)
            const liquidityAmount = 1000000; // Example: 1M tokens
            
            // Calculate delta
            const delta = await this.calculateDelta(price, liquidityAmount);
            
            // Fetch LP manager state
            const lpManager = await this.program.account.lpManager.fetch(this.lpManagerPDA);
            const targetDelta = lpManager.targetDelta.toNumber();
            const deviation = Math.abs(delta - targetDelta);
            
            console.log(`\n📊 Position Status:`);
            console.log(`   Current Price: ${(price / 10000).toFixed(6)} SOL`);
            console.log(`   Current Delta: ${delta}`);
            console.log(`   Target Delta: ${targetDelta}`);
            console.log(`   Deviation: ${deviation}`);
            console.log(`   Threshold: ${REBALANCE_THRESHOLD}`);
            
            if (deviation >= REBALANCE_THRESHOLD) {
                console.log(`\n⚠️  Delta deviation exceeds threshold! Rebalancing...`);
                await this.rebalance(price, delta);
            } else {
                console.log(`✅ Delta within threshold, no rebalance needed\n`);
            }
        } catch (error) {
            console.error('❌ Error in check and rebalance:', error.message);
        }
    }

    async start() {
        if (this.isRunning) {
            console.log('⚠️  Rebalancer is already running');
            return;
        }
        
        this.isRunning = true;
        console.log('🤖 Starting auto-rebalancer...');
        console.log(`   Check interval: ${CHECK_INTERVAL / 1000} seconds`);
        console.log(`   Rebalance threshold: ${REBALANCE_THRESHOLD}`);
        console.log(`   Press Ctrl+C to stop\n`);
        
        // Initial check
        await this.checkAndRebalance();
        
        // Set up interval
        const interval = setInterval(async () => {
            if (!this.isRunning) {
                clearInterval(interval);
                return;
            }
            await this.checkAndRebalance();
        }, CHECK_INTERVAL);
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Stopping auto-rebalancer...');
            this.isRunning = false;
            clearInterval(interval);
            process.exit(0);
        });
    }
}

// Main execution
async function main() {
    console.log('⚖️  Auto-Rebalancing LP with Delta-Neutral Hedging\n');
    console.log('='.repeat(70) + '\n');
    
    // Load wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
        console.error('❌ Wallet not found!');
        console.error(`   Expected at: ${walletPath}`);
        process.exit(1);
    }
    
    const walletKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );
    
    const connection = new Connection(RPC_URL, 'confirmed');
    
    const rebalancer = new AutoRebalancer(walletKeypair, connection);
    
    try {
        await rebalancer.initialize();
        await rebalancer.start();
    } catch (error) {
        console.error('❌ Failed to start rebalancer:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { AutoRebalancer };








// Initialize Orca Whirlpool Position for Delta-Neutral Hedging
// Sets up the initial position with optimal tick range

const { Connection, PublicKey, Keypair, clusterApiUrl } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');
const { OrcaWhirlpoolUtils } = require('./orca-whirlpool-utils');

const NETWORK = process.env.NETWORK || 'devnet';
const RPC_URL = process.env.RPC_URL || clusterApiUrl(NETWORK);

// Program IDs
const LP_MANAGER_PROGRAM_ID = new PublicKey('G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG');
const TOKEN_MINT = new PublicKey('CXcoVCAuQB2XigJmyGz162aj1MCgJxC9Hgo5SEuRuFto');

class OrcaPositionInitializer {
    constructor(adminKeypair, connection) {
        this.admin = adminKeypair;
        this.connection = connection;
        this.program = null;
        this.lpManagerPDA = null;
        this.orcaUtils = new OrcaWhirlpoolUtils(connection, NETWORK);
    }

    async initialize() {
        console.log('🚀 Initializing Orca Position Setup...\n');
        
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
    }

    async getCurrentPrice() {
        try {
            const response = await fetch(
                `https://price.jup.ag/v4/price?ids=${TOKEN_MINT.toString()}&vsToken=SOL`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.data && data.data[TOKEN_MINT.toString()]) {
                    return parseFloat(data.data[TOKEN_MINT.toString()].price);
                }
            }
            
            // Fallback: default price
            console.log('⚠️  Using default price: 1.0');
            return 1.0;
        } catch (error) {
            console.log('⚠️  Using default price: 1.0');
            return 1.0;
        }
    }

    async initializePosition(tickLower, tickUpper) {
        try {
            console.log('📝 Initializing Orca position...');
            console.log(`   Tick Lower: ${tickLower}`);
            console.log(`   Tick Upper: ${tickUpper}\n`);
            
            const tx = await this.program.methods
                .initializeOrcaPosition(tickLower, tickUpper)
                .accounts({
                    lpManager: this.lpManagerPDA,
                    admin: this.admin.publicKey,
                })
                .signers([this.admin])
                .rpc();
            
            console.log(`✅ Position initialized!`);
            console.log(`   Transaction: ${tx}\n`);
            
            // Fetch updated state
            const lpManager = await this.program.account.lpManager.fetch(this.lpManagerPDA);
            console.log('📊 Updated LP Manager State:');
            console.log(`   Orca Position Initialized: ${lpManager.orcaPositionInitialized}`);
            console.log(`   Tick Lower: ${lpManager.tickLower}`);
            console.log(`   Tick Upper: ${lpManager.tickUpper}`);
            console.log(`   Target Delta: ${lpManager.targetDelta}\n`);
            
            return tx;
        } catch (error) {
            console.error('❌ Error initializing position:', error.message);
            throw error;
        }
    }

    async initializeWithOptimalRange(rangePercentage = 0.1) {
        try {
            console.log('🎯 Calculating optimal tick range...\n');
            
            // Get current price
            const currentPrice = await this.getCurrentPrice();
            console.log(`   Current Price: ${currentPrice} SOL per token\n`);
            
            // Calculate optimal range
            const range = this.orcaUtils.calculateOptimalTickRange(currentPrice, rangePercentage);
            
            console.log('📊 Optimal Range Calculation:');
            console.log(`   Current Price: ${currentPrice}`);
            console.log(`   Current Tick: ${range.currentTick}`);
            console.log(`   Tick Lower: ${range.tickLower}`);
            console.log(`   Tick Upper: ${range.tickUpper}`);
            console.log(`   Range: ${(range.rangePercentage * 100).toFixed(1)}%\n`);
            
            // Initialize position
            return await this.initializePosition(range.tickLower, range.tickUpper);
        } catch (error) {
            console.error('❌ Error:', error.message);
            throw error;
        }
    }

    async updateTicks(newTickLower, newTickUpper) {
        try {
            console.log('🔄 Updating position ticks...');
            console.log(`   New Tick Lower: ${newTickLower}`);
            console.log(`   New Tick Upper: ${newTickUpper}\n`);
            
            const tx = await this.program.methods
                .updatePositionTicks(newTickLower, newTickUpper)
                .accounts({
                    lpManager: this.lpManagerPDA,
                    admin: this.admin.publicKey,
                })
                .signers([this.admin])
                .rpc();
            
            console.log(`✅ Ticks updated!`);
            console.log(`   Transaction: ${tx}\n`);
            
            return tx;
        } catch (error) {
            console.error('❌ Error updating ticks:', error.message);
            throw error;
        }
    }

    async setTargetDelta(targetDelta) {
        try {
            console.log(`🎯 Setting target delta: ${targetDelta}\n`);
            
            const tx = await this.program.methods
                .setTargetDelta(new anchor.BN(targetDelta))
                .accounts({
                    lpManager: this.lpManagerPDA,
                    admin: this.admin.publicKey,
                })
                .signers([this.admin])
                .rpc();
            
            console.log(`✅ Target delta set!`);
            console.log(`   Transaction: ${tx}\n`);
            
            return tx;
        } catch (error) {
            console.error('❌ Error setting target delta:', error.message);
            throw error;
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'init';
    
    console.log('🌊 Orca Position Initializer\n');
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
    const initializer = new OrcaPositionInitializer(walletKeypair, connection);
    
    try {
        await initializer.initialize();
        
        if (command === 'init') {
            // Initialize with optimal range (10% by default)
            const rangePercentage = parseFloat(args[1]) || 0.1;
            await initializer.initializeWithOptimalRange(rangePercentage);
        } else if (command === 'ticks') {
            // Set custom ticks
            const tickLower = parseInt(args[1]);
            const tickUpper = parseInt(args[2]);
            if (!tickLower || !tickUpper) {
                console.error('❌ Usage: node initialize-orca-position.js ticks <tickLower> <tickUpper>');
                process.exit(1);
            }
            await initializer.initializePosition(tickLower, tickUpper);
        } else if (command === 'update') {
            // Update existing ticks
            const tickLower = parseInt(args[1]);
            const tickUpper = parseInt(args[2]);
            if (!tickLower || !tickUpper) {
                console.error('❌ Usage: node initialize-orca-position.js update <tickLower> <tickUpper>');
                process.exit(1);
            }
            await initializer.updateTicks(tickLower, tickUpper);
        } else if (command === 'delta') {
            // Set target delta
            const targetDelta = parseInt(args[1]);
            if (isNaN(targetDelta)) {
                console.error('❌ Usage: node initialize-orca-position.js delta <targetDelta>');
                process.exit(1);
            }
            await initializer.setTargetDelta(targetDelta);
        } else {
            console.log('Usage:');
            console.log('  node initialize-orca-position.js [command] [args]');
            console.log('');
            console.log('Commands:');
            console.log('  init [rangePercentage]  - Initialize with optimal range (default: 0.1 = 10%)');
            console.log('  ticks <lower> <upper>   - Initialize with custom ticks');
            console.log('  update <lower> <upper>  - Update existing ticks');
            console.log('  delta <targetDelta>      - Set target delta (0 = delta-neutral)');
        }
    } catch (error) {
        console.error('❌ Failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { OrcaPositionInitializer };








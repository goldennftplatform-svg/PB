// Simplified Automated Payout Testing Tool
// Uses direct Solana web3.js calls instead of Anchor Program
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, clusterApiUrl } = require('@solana/web3.js');
const { 
    createInitializeInstruction, 
    TOKEN_PROGRAM_ID 
} = require('@solana/spl-token');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Configuration
const LOTTERY_PROGRAM_ID = new PublicKey('6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb');
const NETWORK = 'devnet';
const RESULTS_DIR = path.join(__dirname, '..', 'bots', 'results');

// Create results directory
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Load IDL for instruction building
const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
if (!fs.existsSync(IDL_PATH)) {
    console.error('❌ IDL not found. Run: anchor build');
    process.exit(1);
}
const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

class SimplePayoutTester {
    constructor(adminKeypair, connection) {
        this.admin = adminKeypair;
        this.connection = connection;
        this.lotteryPDA = null;
        this.program = null;
    }

    async initialize() {
        console.log('🔧 Initializing payout tester...\n');
        
        // Derive lottery PDA
        [this.lotteryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );

        // Set up Anchor provider
        const wallet = new Anchor.Wallet(this.admin);
        const provider = new Anchor.AnchorProvider(
            this.connection,
            wallet,
            { commitment: 'confirmed' }
        );
        Anchor.setProvider(provider);

        // Try to load program using IDL
        try {
            // Create a minimal program interface
            this.program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, provider);
        } catch (error) {
            console.log('⚠️  Note: Program initialization issue, but we can still test basic functionality');
            console.log('   Error:', error.message);
        }

        console.log(`✅ Program ID: ${LOTTERY_PROGRAM_ID.toString()}`);
        console.log(`✅ Lottery PDA: ${this.lotteryPDA.toString()}`);
        console.log(`✅ Admin: ${this.admin.publicKey.toString()}\n`);
    }

    async checkLotteryExists() {
        try {
            const accountInfo = await this.connection.getAccountInfo(this.lotteryPDA);
            return accountInfo !== null;
        } catch (error) {
            return false;
        }
    }

    async displayInfo() {
        console.log('📊 LOTTERY INFORMATION');
        console.log('='.repeat(60));
        console.log(`Program ID: ${LOTTERY_PROGRAM_ID.toString()}`);
        console.log(`Lottery PDA: ${this.lotteryPDA.toString()}`);
        console.log(`Admin: ${this.admin.publicKey.toString()}`);
        
        const exists = await this.checkLotteryExists();
        console.log(`Lottery Account: ${exists ? '✅ Exists' : '❌ Not Found'}`);
        
        if (exists) {
            const accountInfo = await this.connection.getAccountInfo(this.lotteryPDA);
            console.log(`Account Data Size: ${accountInfo.data.length} bytes`);
            console.log(`Owner: ${accountInfo.owner.toString()}`);
            console.log(`Lamports: ${accountInfo.lamports / 1e9} SOL`);
        }
        console.log('');
    }

    async simulatePayout() {
        console.log('💰 PAYOUT SIMULATION');
        console.log('='.repeat(60));
        console.log('This is a test of the payout workflow.\n');
        
        if (!await this.checkLotteryExists()) {
            console.log('⚠️  Lottery account not found!');
            console.log('   Initialize the lottery first before testing payouts.\n');
            return { success: false, error: 'Lottery not initialized' };
        }

        console.log('📝 Payout Process:');
        console.log('1. Check for winners in lottery account');
        console.log('2. Calculate payout amounts (60% main, 8% each minor)');
        console.log('3. Execute payout_winners instruction');
        console.log('4. Verify winners cleared\n');

        console.log('⚠️  NOTE: This is a simulation.');
        console.log('   To execute real payout, you need:');
        console.log('   - Winners selected (via take_snapshot)');
        console.log('   - Proper account structure in contract');
        console.log('   - Admin wallet with SOL for transaction fees\n');

        if (this.program) {
            try {
                // Try to fetch lottery state
                const lottery = await this.program.account.lottery.fetch(this.lotteryPDA);
                
                console.log('📊 CURRENT LOTTERY STATE:');
                console.log(`Jackpot: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL`);
                console.log(`Has Main Winner: ${lottery.winners.mainWinner ? '✅ Yes' : '❌ No'}`);
                
                if (lottery.winners.mainWinner) {
                    console.log(`Main Winner: ${lottery.winners.mainWinner.toString()}`);
                    
                    const jackpot = lottery.jackpotAmount;
                    const mainPayout = (jackpot * 60n) / 100n;
                    const minorPayout = (jackpot * 40n) / 100n / 5n;
                    
                    console.log('\n💰 CALCULATED PAYOUTS:');
                    console.log(`Main Winner: ${(mainPayout / 1e9).toFixed(4)} SOL (60%)`);
                    console.log(`Each Minor Winner: ${(minorPayout / 1e9).toFixed(4)} SOL (8%)`);
                    console.log(`Total Minor Payout: ${((minorPayout * 5n) / 1e9).toFixed(4)} SOL (40%)\n`);
                    
                    console.log('✅ Ready to execute payout!');
                    console.log('   Run with: node test-automated-payout-simple.js execute\n');
                    
                    return {
                        success: true,
                        hasWinners: true,
                        jackpot: Number(jackpot) / 1e9,
                        mainPayout: Number(mainPayout) / 1e9,
                        minorPayout: Number(minorPayout) / 1e9
                    };
                } else {
                    console.log('\n⚠️  No winners to payout!');
                    console.log('   Take a snapshot first to select winners.\n');
                    return { success: false, error: 'No winners' };
                }
            } catch (error) {
                console.log('⚠️  Could not fetch lottery state:', error.message);
                console.log('   Account exists but parsing failed.\n');
                return { success: false, error: error.message };
            }
        } else {
            console.log('⚠️  Program not loaded - cannot fetch detailed state');
            console.log('   But lottery account exists and can receive payouts.\n');
            return { success: false, error: 'Program not loaded' };
        }
    }

    async executePayout() {
        if (!this.program) {
            console.error('❌ Program not loaded. Cannot execute payout.');
            return { success: false, error: 'Program not loaded' };
        }

        try {
            console.log('💰 EXECUTING PAYOUT...\n');
            
            const lottery = await this.program.account.lottery.fetch(this.lotteryPDA);
            
            if (!lottery.winners.mainWinner) {
                console.log('❌ No winners to payout!');
                return { success: false, error: 'No winners' };
            }

            console.log(`Main Winner: ${lottery.winners.mainWinner.toString()}`);
            console.log(`Jackpot: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL\n`);

            console.log('📝 Calling payout_winners instruction...\n');
            
            const tx = await this.program.methods
                .payoutWinners()
                .accounts({
                    lottery: this.lotteryPDA,
                    admin: this.admin.publicKey,
                })
                .rpc();

            console.log(`✅ Transaction Signature: ${tx}`);
            console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}\n`);

            await this.connection.confirmTransaction(tx, 'confirmed');
            console.log('✅ Payout transaction confirmed!\n');

            const result = {
                success: true,
                transaction: tx,
                explorer: `https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`,
                timestamp: new Date().toISOString()
            };

            fs.writeFileSync(
                path.join(RESULTS_DIR, 'payout-execution.json'),
                JSON.stringify(result, null, 2)
            );

            return result;

        } catch (error) {
            console.error('❌ Payout execution failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

async function main() {
    console.log('🤖 Automated Payout Testing Tool (Simplified)');
    console.log('='.repeat(60) + '\n');

    // Load admin wallet
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('❌ Admin wallet not found!');
        console.error(`   Expected at: ${adminKeyPath}`);
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');
    const tester = new SimplePayoutTester(adminKeypair, connection);
    await tester.initialize();

    const command = process.argv[2] || 'info';

    switch (command) {
        case 'info':
            await tester.displayInfo();
            break;
        case 'simulate':
            await tester.simulatePayout();
            break;
        case 'execute':
            await tester.executePayout();
            break;
        default:
            console.log('Usage:');
            console.log('  node test-automated-payout-simple.js info      - Show lottery info');
            console.log('  node test-automated-payout-simple.js simulate - Simulate payout check');
            console.log('  node test-automated-payout-simple.js execute  - Execute payout');
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { SimplePayoutTester };


// Automated Payout Testing Tool
// Tests the payout_winners function on the lottery contract
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Configuration
const LOTTERY_PROGRAM_ID = new PublicKey('6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb');
const NETWORK = 'devnet';
const RESULTS_DIR = path.join(__dirname, '..', 'bots', 'results');

// Create results directory if it doesn't exist
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Load IDL
const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
if (!fs.existsSync(IDL_PATH)) {
    console.error('❌ IDL not found at:', IDL_PATH);
    console.error('   Run: anchor build first');
    process.exit(1);
}

const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

class AutomatedPayoutTester {
    constructor(adminKeypair, connection) {
        this.admin = adminKeypair;
        this.connection = connection;
        this.program = null;
        this.lotteryPDA = null;
    }

    async initialize() {
        console.log('🔧 Initializing payout tester...\n');
        
        // Set up Anchor provider
        const wallet = new Anchor.Wallet(this.admin);
        const provider = new Anchor.AnchorProvider(
            this.connection,
            wallet,
            { commitment: 'confirmed' }
        );
        Anchor.setProvider(provider);

        // Derive lottery PDA first
        [this.lotteryPDA] = Anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );

        // Load program - use workspace approach like tests
        try {
            // Try loading from workspace first (if tests have been run)
            const workspace = Anchor.workspace;
            if (workspace && workspace.Lottery) {
                this.program = workspace.Lottery;
                console.log('✅ Loaded program from workspace');
            } else {
                // Build instruction manually using IDL
                console.log('⚠️  Using manual instruction building (workspace not available)');
                this.program = null;
            }
        } catch (error) {
            console.error('⚠️  Could not load from workspace:', error.message);
            this.program = null;
        }

        console.log(`✅ Program ID: ${LOTTERY_PROGRAM_ID.toString()}`);
        console.log(`✅ Lottery PDA: ${this.lotteryPDA.toString()}`);
        console.log(`✅ Admin: ${this.admin.publicKey.toString()}\n`);
    }

    async checkLotteryState() {
        try {
            if (!this.program) {
                // Fallback: fetch account data directly
                const accountInfo = await this.connection.getAccountInfo(this.lotteryPDA);
                if (!accountInfo) return null;
                
                // Parse manually (simplified - would need proper deserialization)
                return {
                    error: 'Program not loaded - account exists but parsing requires program',
                    accountExists: true
                };
            }
            
            const lottery = await this.program.account.lottery.fetch(this.lotteryPDA);
            
            return {
                jackpotAmount: lottery.jackpotAmount,
                jackpotAmountSOL: lottery.jackpotAmount / 1e9,
                hasMainWinner: lottery.winners.mainWinner !== null,
                mainWinner: lottery.winners.mainWinner,
                minorWinners: lottery.winners.minorWinners || [],
                minorWinnersCount: (lottery.winners.minorWinners || []).length,
                isActive: lottery.isActive,
                feesCollected: lottery.feesCollected,
                feesCollectedSOL: lottery.feesCollected / 1e9,
                lastSnapshot: lottery.lastSnapshot,
                totalSnapshots: lottery.totalSnapshots,
                participants: lottery.participants?.length || 0
            };
        } catch (error) {
            if (error.message.includes('Account does not exist')) {
                console.error('❌ Lottery account not initialized!');
                console.error('   Initialize the lottery first before testing payouts.');
                return null;
            }
            throw error;
        }
    }

    async displayLotteryState(state) {
        console.log('📊 LOTTERY STATE');
        console.log('='.repeat(60));
        console.log(`Jackpot Amount: ${state.jackpotAmountSOL.toFixed(4)} SOL`);
        console.log(`Fees Collected: ${state.feesCollectedSOL.toFixed(4)} SOL`);
        console.log(`Is Active: ${state.isActive ? '✅' : '❌'}`);
        console.log(`Total Snapshots: ${state.totalSnapshots}`);
        console.log(`Current Participants: ${state.participants}`);
        console.log('\n🎯 WINNERS:');
        console.log(`Main Winner: ${state.hasMainWinner ? state.mainWinner.toString() : 'None'}`);
        console.log(`Minor Winners: ${state.minorWinnersCount} / 5`);
        
        if (state.minorWinnersCount > 0) {
            state.minorWinners.forEach((winner, idx) => {
                console.log(`  ${idx + 1}. ${winner.toString()}`);
            });
        }
        console.log('');
    }

    async calculatePayouts(jackpotAmount) {
        const mainPayout = (jackpotAmount * 60n) / 100n; // 60%
        const minorPayoutPerWinner = (jackpotAmount * 40n) / 100n / 5n; // 8% each (40% / 5)
        
        return {
            total: jackpotAmount,
            mainPayout: mainPayout,
            mainPayoutSOL: Number(mainPayout) / 1e9,
            minorPayoutPerWinner: minorPayoutPerWinner,
            minorPayoutPerWinnerSOL: Number(minorPayoutPerWinner) / 1e9,
            totalMinorPayout: minorPayoutPerWinner * 5n,
            totalMinorPayoutSOL: Number(minorPayoutPerWinner * 5n) / 1e9
        };
    }

    async executePayout() {
        console.log('💰 EXECUTING PAYOUT');
        console.log('='.repeat(60));
        
        try {
            // Check state before payout
            const stateBefore = await this.checkLotteryState();
            if (!stateBefore) {
                return { success: false, error: 'Lottery not initialized' };
            }

            if (!stateBefore.hasMainWinner) {
                console.log('⚠️  No winners to payout!');
                console.log('   Take a snapshot first to select winners.\n');
                return { success: false, error: 'No winners' };
            }

            // Calculate expected payouts
            const payouts = await this.calculatePayouts(stateBefore.jackpotAmount);
            
            console.log(`Total Jackpot: ${payouts.totalSOL.toFixed(4)} SOL`);
            console.log(`Main Winner Payout: ${payouts.mainPayoutSOL.toFixed(4)} SOL (60%)`);
            console.log(`Each Minor Winner: ${payouts.minorPayoutPerWinnerSOL.toFixed(4)} SOL (8%)`);
            console.log(`Total Minor Payout: ${payouts.totalMinorPayoutSOL.toFixed(4)} SOL (40%)`);
            console.log('\n📝 Calling payout_winners...\n');

            // Execute payout
            if (!this.program) {
                throw new Error('Program not loaded - cannot execute payout');
            }
            
            const tx = await this.program.methods
                .payoutWinners()
                .accounts({
                    lottery: this.lotteryPDA,
                    admin: this.admin.publicKey,
                })
                .rpc();

            console.log(`✅ Transaction Signature: ${tx}`);
            console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}\n`);

            // Wait for confirmation
            await this.connection.confirmTransaction(tx, 'confirmed');
            console.log('✅ Transaction confirmed!\n');

            // Check state after payout
            const stateAfter = await this.checkLotteryState();
            
            // Verify payout was successful
            const payoutSuccess = !stateAfter.hasMainWinner && stateAfter.minorWinnersCount === 0;
            
            console.log('📊 STATE AFTER PAYOUT:');
            console.log(`Main Winner: ${stateAfter.hasMainWinner ? stateAfter.mainWinner?.toString() : 'Cleared ✅'}`);
            console.log(`Minor Winners: ${stateAfter.minorWinnersCount} (should be 0) ${stateAfter.minorWinnersCount === 0 ? '✅' : '❌'}`);
            console.log(`Jackpot Amount: ${stateAfter.jackpotAmountSOL.toFixed(4)} SOL\n`);

            const result = {
                success: payoutSuccess,
                transaction: tx,
                explorer: `https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`,
                stateBefore,
                stateAfter,
                payouts: {
                    main: payouts.mainPayoutSOL,
                    minor: payouts.minorPayoutPerWinnerSOL,
                    total: payouts.totalSOL
                },
                timestamp: new Date().toISOString()
            };

            // Save results
            const resultsFile = path.join(RESULTS_DIR, 'payout-test.json');
            fs.writeFileSync(resultsFile, JSON.stringify(result, null, 2));
            console.log(`💾 Results saved to: ${resultsFile}\n`);

            return result;

        } catch (error) {
            console.error('❌ Payout failed:', error.message);
            
            const errorResult = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            
            const resultsFile = path.join(RESULTS_DIR, 'payout-test-error.json');
            fs.writeFileSync(resultsFile, JSON.stringify(errorResult, null, 2));
            
            return errorResult;
        }
    }

    async monitorAndPayout(intervalSeconds = 60) {
        console.log(`🤖 Starting automated payout monitoring...`);
        console.log(`   Check interval: ${intervalSeconds} seconds`);
        console.log(`   Press Ctrl+C to stop\n`);

        let checkCount = 0;

        const monitor = setInterval(async () => {
            checkCount++;
            console.log(`\n[Check #${checkCount}] ${new Date().toLocaleTimeString()}`);
            
            try {
                const state = await this.checkLotteryState();
                if (!state) {
                    console.log('⚠️  Lottery not initialized, skipping...');
                    return;
                }

                if (state.hasMainWinner) {
                    console.log('🎯 Winners detected! Executing payout...');
                    await this.executePayout();
                } else {
                    console.log('⏳ No winners yet. Waiting...');
                    console.log(`   Participants: ${state.participants}`);
                    console.log(`   Jackpot: ${state.jackpotAmountSOL.toFixed(4)} SOL`);
                }
            } catch (error) {
                console.error(`❌ Error during check:`, error.message);
            }
        }, intervalSeconds * 1000);

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Stopping monitor...');
            clearInterval(monitor);
            process.exit(0);
        });

        // Run initial check immediately
        const state = await this.checkLotteryState();
        if (state && state.hasMainWinner) {
            console.log('🎯 Winners detected on startup! Executing payout...');
            await this.executePayout();
        }
    }
}

// Main execution
async function main() {
    console.log('🤖 Automated Payout Testing Tool');
    console.log('='.repeat(60) + '\n');

    // Load admin wallet
    const adminKeyPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('❌ Admin wallet not found!');
        console.error(`   Expected at: ${adminKeyPath}`);
        console.error('   Set ANCHOR_WALLET environment variable or use default Solana CLI wallet');
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');
    
    const tester = new AutomatedPayoutTester(adminKeypair, connection);
    await tester.initialize();

    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'status';

    switch (command) {
        case 'status':
            console.log('📊 Checking lottery status...\n');
            const state = await tester.checkLotteryState();
            if (state) {
                await tester.displayLotteryState(state);
                
                if (state.hasMainWinner) {
                    const payouts = await tester.calculatePayouts(state.jackpotAmount);
                    console.log('💰 EXPECTED PAYOUTS:');
                    console.log(`Main Winner: ${payouts.mainPayoutSOL.toFixed(4)} SOL`);
                    console.log(`Each Minor Winner: ${payouts.minorPayoutPerWinnerSOL.toFixed(4)} SOL`);
                    console.log(`\n💡 Run with 'payout' command to execute payout\n`);
                }
            }
            break;

        case 'payout':
            await tester.executePayout();
            break;

        case 'monitor':
            const interval = parseInt(args[1]) || 60;
            await tester.monitorAndPayout(interval);
            break;

        default:
            console.log('Usage:');
            console.log('  node test-automated-payout.js status   - Check lottery status');
            console.log('  node test-automated-payout.js payout   - Execute payout now');
            console.log('  node test-automated-payout.js monitor [interval] - Monitor and auto-payout');
            console.log('\nExample:');
            console.log('  node test-automated-payout.js monitor 30  # Check every 30 seconds');
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { AutomatedPayoutTester };


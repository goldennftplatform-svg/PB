// Secure Automated Payout Tool with comprehensive security checks
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const LOTTERY_PROGRAM_ID = new PublicKey('6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb');
const NETWORK = 'devnet';
const RESULTS_DIR = path.join(__dirname, '..', 'bots', 'results');

if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

class SecurePayoutTool {
    constructor(adminKeypair, connection) {
        this.admin = adminKeypair;
        this.connection = connection;
        this.lotteryPDA = null;
        this.program = null;
        this.securityChecks = [];
    }

    async initialize() {
        console.log('🔒 Secure Payout Tool - Initializing...\n');
        
        // Security: Derive lottery PDA
        [this.lotteryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );

        // Set up Anchor provider
        const wallet = new Anchor.Wallet(this.admin);
        const provider = new Anchor.AnchorProvider(
            this.connection,
            wallet,
            { commitment: 'confirmed', skipPreflight: false }
        );
        Anchor.setProvider(provider);

        try {
            this.program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, provider);
        } catch (error) {
            console.log('⚠️  Program loading issue (non-critical):', error.message);
        }

        console.log(`✅ Program ID: ${LOTTERY_PROGRAM_ID.toString()}`);
        console.log(`✅ Lottery PDA: ${this.lotteryPDA.toString()}`);
        console.log(`✅ Admin: ${this.admin.publicKey.toString()}\n`);
    }

    async performSecurityChecks() {
        console.log('🔒 Performing Security Checks...\n');
        this.securityChecks = [];

        try {
            // Check 1: Verify lottery account exists
            const accountInfo = await this.connection.getAccountInfo(this.lotteryPDA);
            if (!accountInfo) {
                this.securityChecks.push({ check: 'Account Exists', passed: false, error: 'Lottery account not found' });
                return false;
            }
            this.securityChecks.push({ check: 'Account Exists', passed: true });

            // Check 2: Verify program ownership
            if (accountInfo.owner.toString() !== LOTTERY_PROGRAM_ID.toString()) {
                this.securityChecks.push({ check: 'Program Ownership', passed: false, error: 'Invalid owner' });
                return false;
            }
            this.securityChecks.push({ check: 'Program Ownership', passed: true });

            // Check 3: Fetch and verify lottery state
            if (!this.program) {
                this.securityChecks.push({ check: 'Program Loaded', passed: false, error: 'Program not loaded' });
                return false;
            }

            const lottery = await this.program.account.lottery.fetch(this.lotteryPDA);
            
            // Check 4: Verify admin matches
            if (lottery.admin.toString() !== this.admin.publicKey.toString()) {
                this.securityChecks.push({ 
                    check: 'Admin Authorization', 
                    passed: false, 
                    error: `Admin mismatch. Expected: ${this.admin.publicKey.toString()}, Found: ${lottery.admin.toString()}` 
                });
                return false;
            }
            this.securityChecks.push({ check: 'Admin Authorization', passed: true });

            // Check 5: Verify lottery is active
            if (!lottery.isActive) {
                this.securityChecks.push({ check: 'Lottery Active', passed: false, error: 'Lottery is paused' });
                return false;
            }
            this.securityChecks.push({ check: 'Lottery Active', passed: true });

            // Check 6: Verify winners exist
            if (!lottery.winners.mainWinner) {
                this.securityChecks.push({ check: 'Winners Selected', passed: false, error: 'No winners to payout' });
                return false;
            }
            
            // Check 6b: Verify we have 8 minor winners
            const minorWinnersCount = lottery.winners.minorWinners?.length || 0;
            if (minorWinnersCount < 8) {
                this.securityChecks.push({ check: 'Minor Winners Count', passed: false, error: `Expected 8 minor winners, found ${minorWinnersCount}` });
                return false;
            }
            this.securityChecks.push({ check: 'Winners Selected', passed: true });
            this.securityChecks.push({ check: 'Minor Winners Count', passed: true });

            // Check 7: Verify jackpot amount > 0
            if (lottery.jackpotAmount <= 0) {
                this.securityChecks.push({ check: 'Jackpot Amount', passed: false, error: 'Jackpot is zero' });
                return false;
            }
            this.securityChecks.push({ check: 'Jackpot Amount', passed: true });

            // Check 8: Verify admin has balance for fees
            const adminBalance = await this.connection.getBalance(this.admin.publicKey);
            if (adminBalance < 0.01 * 1e9) {
                this.securityChecks.push({ check: 'Admin Balance', passed: false, error: 'Insufficient balance for fees' });
                return false;
            }
            this.securityChecks.push({ check: 'Admin Balance', passed: true });

            return true;

        } catch (error) {
            this.securityChecks.push({ check: 'General', passed: false, error: error.message });
            return false;
        }
    }

    displaySecurityChecks() {
        console.log('📊 Security Check Results:');
        console.log('='.repeat(60));
        this.securityChecks.forEach((check, idx) => {
            const status = check.passed ? '✅' : '❌';
            console.log(`${idx + 1}. ${status} ${check.check}`);
            if (!check.passed && check.error) {
                console.log(`   Error: ${check.error}`);
            }
        });
        console.log('');
    }

    async calculateSecurePayouts(jackpotAmount) {
        // Security: Validate jackpot amount
        if (typeof jackpotAmount !== 'bigint' && typeof jackpotAmount !== 'number') {
            throw new Error('Invalid jackpot amount type');
        }

        const jackpot = BigInt(jackpotAmount);
        if (jackpot <= 0n) {
            throw new Error('Jackpot amount must be positive');
        }

        // NEW PAYOUT STRUCTURE: 68% Grand Prize, 8% Carry-over, 8 winners at 3% each
        // Calculate with overflow protection
        const grandPrize = (jackpot * 68n) / 100n; // 68% to grand prize winner
        const carryOver = (jackpot * 8n) / 100n; // 8% carry-over to next round
        const minorPayoutPerWinner = (jackpot * 3n) / 100n; // 3% to each of 8 minor winners
        const totalMinorPayout = minorPayoutPerWinner * 8n; // 24% total (8 winners × 3%)
        
        // Calculate remainder to handle rounding
        const total = grandPrize + carryOver + totalMinorPayout;
        const remainder = jackpot - total;
        
        // Security: Verify totals match (allow small remainder due to integer division)
        // For large jackpots, allow up to 10 lamports remainder for rounding
        const maxRemainder = jackpot > 1000n * 1_000_000_000n ? 10n : 8n;
        if (remainder > maxRemainder) {
            throw new Error(`Payout calculation error: Totals do not match. Remainder: ${remainder}, Max allowed: ${maxRemainder}`);
        }

        return {
            total: Number(jackpot),
            grandPrize: Number(grandPrize),
            grandPrizeSOL: Number(grandPrize) / 1e9,
            carryOver: Number(carryOver),
            carryOverSOL: Number(carryOver) / 1e9,
            minorPayoutPerWinner: Number(minorPayoutPerWinner),
            minorPayoutPerWinnerSOL: Number(minorPayoutPerWinner) / 1e9,
            totalMinorPayout: Number(totalMinorPayout),
            totalMinorPayoutSOL: Number(totalMinorPayout) / 1e9,
            minorWinnersCount: 8,
            validated: true
        };
    }

    async executeSecurePayout() {
        console.log('💰 SECURE PAYOUT EXECUTION\n');
        console.log('='.repeat(60) + '\n');

        // Perform all security checks
        const securityPassed = await this.performSecurityChecks();
        this.displaySecurityChecks();

        if (!securityPassed) {
            const failedChecks = this.securityChecks.filter(c => !c.passed);
            console.log('❌ Security checks failed! Cannot proceed with payout.\n');
            console.log('Failed checks:');
            failedChecks.forEach(check => {
                console.log(`  - ${check.check}: ${check.error || 'Failed'}`);
            });
            console.log('');
            return { success: false, error: 'Security checks failed', failedChecks };
        }

        console.log('✅ All security checks passed!\n');

        try {
            // Fetch current state
            const lottery = await this.program.account.lottery.fetch(this.lotteryPDA);
            
            // Calculate payouts securely (include carry-over)
            const totalJackpot = lottery.jackpotAmount + (lottery.carryOverAmount || 0);
            const payouts = await this.calculateSecurePayouts(totalJackpot);
            
            console.log('💰 PAYOUT CALCULATION (New Structure):');
            console.log(`Total Jackpot: ${(totalJackpot / 1e9).toFixed(4)} SOL`);
            console.log(`  Base: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL`);
            console.log(`  Carry-over: ${((lottery.carryOverAmount || 0) / 1e9).toFixed(4)} SOL`);
            console.log(`Grand Prize Winner: ${payouts.grandPrizeSOL.toFixed(4)} SOL (68%)`);
            console.log(`Carry-over to Next Round: ${payouts.carryOverSOL.toFixed(4)} SOL (8%)`);
            console.log(`Each Minor Winner: ${payouts.minorPayoutPerWinnerSOL.toFixed(4)} SOL (3%)`);
            console.log(`Total Minor Payout: ${payouts.totalMinorPayoutSOL.toFixed(4)} SOL (24%)`);
            console.log(`Grand Prize Winner: ${lottery.winners.mainWinner.toString()}`);
            console.log(`Minor Winners: ${lottery.winners.minorWinners?.length || 0}\n`);

            console.log('📝 Executing payout_winners instruction...\n');

            // Execute payout with security
            const tx = await this.program.methods
                .payoutWinners()
                .accounts({
                    lottery: this.lotteryPDA,
                    admin: this.admin.publicKey,
                })
                .signers([this.admin])
                .rpc();

            console.log(`✅ Transaction Signature: ${tx}`);
            console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}\n`);

            // Wait for confirmation
            await this.connection.confirmTransaction(tx, 'confirmed');
            console.log('✅ Transaction confirmed!\n');

            // Verify payout completed
            const lotteryAfter = await this.program.account.lottery.fetch(this.lotteryPDA);
            const winnersCleared = !lotteryAfter.winners.mainWinner && 
                                  (lotteryAfter.winners.minorWinners?.length || 0) === 0;

            if (!winnersCleared) {
                throw new Error('Payout verification failed: Winners not cleared');
            }

            console.log('✅ Payout verification passed - winners cleared!\n');

            const result = {
                success: true,
                transaction: tx,
                explorer: `https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`,
                payouts,
                securityChecks: this.securityChecks,
                timestamp: new Date().toISOString(),
                validated: true
            };

            // Save secure results
            fs.writeFileSync(
                path.join(RESULTS_DIR, 'secure-payout-execution.json'),
                JSON.stringify(result, null, 2)
            );

            console.log('💾 Secure results saved\n');

            return result;

        } catch (error) {
            console.error('❌ Secure payout failed:', error.message);
            
            const errorResult = {
                success: false,
                error: error.message,
                securityChecks: this.securityChecks,
                timestamp: new Date().toISOString()
            };
            
            fs.writeFileSync(
                path.join(RESULTS_DIR, 'secure-payout-error.json'),
                JSON.stringify(errorResult, null, 2)
            );
            
            return errorResult;
        }
    }
}

async function main() {
    console.log('🔒 Secure Automated Payout Tool\n');
    console.log('='.repeat(60) + '\n');

    // Load admin wallet
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('❌ Admin wallet not found!');
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');
    const tool = new SecurePayoutTool(adminKeypair, connection);
    await tool.initialize();

    const command = process.argv[2] || 'check';

    switch (command) {
        case 'check':
            console.log('🔒 Running security checks...\n');
            await tool.performSecurityChecks();
            tool.displaySecurityChecks();
            break;

        case 'payout':
            await tool.executeSecurePayout();
            break;

        default:
            console.log('Usage:');
            console.log('  node secure-payout-tool.js check   - Run security checks');
            console.log('  node secure-payout-tool.js payout   - Execute secure payout');
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { SecurePayoutTool };


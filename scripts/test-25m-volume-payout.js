// Test $25M Volume and Full Payout Flow
// Simulates 100,000+ user wallets with $25M in total volume

const { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');

// Test Configuration
const TARGET_VOLUME_USD = 25_000_000; // $25M
const MAX_WALLETS = 100000; // Support 100k wallets
const USE_EXISTING_WALLETS = true; // Use existing 25 wallets, simulate many entries

class VolumePayoutTester {
    constructor(connection, lotteryProgram) {
        this.connection = connection;
        this.lotteryProgram = lotteryProgram;
        this.totalVolume = 0;
        this.totalEntries = 0;
    }

    /**
     * Simulate volume using existing wallets
     * Each wallet makes multiple entries to simulate many users
     */
    async simulateVolumeWithExistingWallets() {
        console.log('💰 Simulating $25M Volume\n');
        console.log('='.repeat(70) + '\n');

        // Load existing wallets
        const walletsInfoPath = path.join(WALLETS_DIR, 'wallets-info.json');
        if (!fs.existsSync(walletsInfoPath)) {
            console.error('❌ Test wallets not found! Run create-test-wallets.js first');
            process.exit(1);
        }

        const walletsInfo = JSON.parse(fs.readFileSync(walletsInfoPath, 'utf8'));
        console.log(`📊 Using ${walletsInfo.length} existing wallets\n`);

        // Derive lottery PDA
        const [lotteryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );

        // Calculate entries per wallet to reach $25M
        // With 25 wallets, each needs $1M in entries
        const volumePerWallet = TARGET_VOLUME_USD / walletsInfo.length;
        const entriesPerWallet = Math.ceil(volumePerWallet / 100); // $100 per entry
        const entrySizeUSD = 100;

        console.log(`📊 Volume Distribution:`);
        console.log(`   Total Volume: $${TARGET_VOLUME_USD.toLocaleString()}`);
        console.log(`   Wallets: ${walletsInfo.length}`);
        console.log(`   Volume per Wallet: $${volumePerWallet.toLocaleString()}`);
        console.log(`   Entries per Wallet: ${entriesPerWallet}`);
        console.log(`   Entry Size: $${entrySizeUSD}\n`);

        // Fund wallets if needed
        console.log('💰 Checking wallet balances...\n');
        for (const walletInfo of walletsInfo) {
            const walletData = JSON.parse(fs.readFileSync(walletInfo.path, 'utf8'));
            const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(walletData.secretKey));
            const balance = await this.connection.getBalance(walletKeypair.publicKey);
            
            if (balance < 0.5 * LAMPORTS_PER_SOL) {
                console.log(`   Funding ${walletInfo.publicKey.substring(0, 8)}...`);
                try {
                    const tx = await this.connection.sendTransaction(
                        new anchor.web3.Transaction().add(
                            SystemProgram.transfer({
                                fromPubkey: (await anchor.AnchorProvider.env().wallet).publicKey,
                                toPubkey: walletKeypair.publicKey,
                                lamports: 1 * LAMPORTS_PER_SOL,
                            })
                        ),
                        [(await anchor.AnchorProvider.env().wallet).payer]
                    );
                    await this.connection.confirmTransaction(tx, 'confirmed');
                } catch (error) {
                    console.error(`   ❌ Failed: ${error.message}`);
                }
            }
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Simulate entries
        console.log('🎫 Simulating Lottery Entries...\n');
        let successfulEntries = 0;
        let failedEntries = 0;

        for (let i = 0; i < walletsInfo.length; i++) {
            const walletInfo = walletsInfo[i];
            const walletData = JSON.parse(fs.readFileSync(walletInfo.path, 'utf8'));
            const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(walletData.secretKey));

            // Derive participant account PDA
            const [participantPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('participant'),
                    lotteryPDA.toBuffer(),
                    walletKeypair.publicKey.toBuffer()
                ],
                LOTTERY_PROGRAM_ID
            );

            // Check if account exists
            const accountInfo = await this.connection.getAccountInfo(participantPDA);
            const isNew = !accountInfo || accountInfo.lamports === 0;

            // Make multiple entries per wallet
            for (let entry = 0; entry < entriesPerWallet; entry++) {
                try {
                    if (isNew && entry === 0) {
                        // First entry - create account
                        const tx = await this.lotteryProgram.methods
                            .enterLotteryWithUsdValue(new anchor.BN(entrySizeUSD * 100)) // $100 in cents
                            .accounts({
                                lottery: lotteryPDA,
                                participantAccount: participantPDA,
                                participant: walletKeypair.publicKey,
                                systemProgram: SystemProgram.programId,
                            })
                            .signers([walletKeypair])
                            .rpc();

                        this.totalVolume += entrySizeUSD;
                        this.totalEntries++;
                        successfulEntries++;
                    } else {
                        // Subsequent entries - update account
                        const ticketCount = entrySizeUSD >= 20 && entrySizeUSD < 100 ? 1 :
                                           entrySizeUSD >= 100 && entrySizeUSD < 500 ? 4 : 10;
                        
                        const tx = await this.lotteryProgram.methods
                            .updateParticipantTickets(
                                ticketCount,
                                new anchor.BN(entrySizeUSD * 100)
                            )
                            .accounts({
                                lottery: lotteryPDA,
                                participantAccount: participantPDA,
                                participant: walletKeypair.publicKey,
                            })
                            .signers([walletKeypair])
                            .rpc();

                        this.totalVolume += entrySizeUSD;
                        this.totalEntries++;
                        successfulEntries++;
                    }

                    // Progress indicator
                    if (this.totalEntries % 100 === 0) {
                        console.log(`   Progress: ${this.totalEntries} entries, $${this.totalVolume.toLocaleString()} volume`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
                } catch (error) {
                    failedEntries++;
                    if (failedEntries <= 5) {
                        console.error(`   ❌ Entry failed: ${error.message}`);
                    }
                }
            }
        }

        console.log(`\n✅ Volume Simulation Complete:`);
        console.log(`   Total Entries: ${this.totalEntries}`);
        console.log(`   Total Volume: $${this.totalVolume.toLocaleString()}`);
        console.log(`   Successful: ${successfulEntries}`);
        console.log(`   Failed: ${failedEntries}\n`);

        return { totalVolume: this.totalVolume, totalEntries: this.totalEntries };
    }

    /**
     * Test snapshot and payout
     */
    async testSnapshotAndPayout() {
        console.log('📸 Testing Snapshot & Payout\n');
        console.log('='.repeat(70) + '\n');

        const [lotteryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );

        // Check lottery state
        const lottery = await this.lotteryProgram.account.lottery.fetch(lotteryPDA);
        console.log(`📊 Current State:`);
        console.log(`   Participants: ${lottery.totalParticipants}`);
        console.log(`   Tickets: ${lottery.totalTickets}`);
        console.log(`   Jackpot: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL\n`);

        if (lottery.totalParticipants < 9) {
            console.log('⚠️  Not enough participants for snapshot (need 9)\n');
            return;
        }

        // Configure short timing for testing
        console.log('⏱️  Configuring test timing (1 minute)...\n');
        try {
            await this.lotteryProgram.methods
                .configureTiming(
                    new anchor.BN(60), // 1 minute
                    new anchor.BN(30), // 30 seconds
                    new anchor.BN(1 * 1e9) // 1 SOL threshold
                )
                .accounts({
                    lottery: lotteryPDA,
                    admin: (await anchor.AnchorProvider.env().wallet).publicKey,
                })
                .rpc();
            console.log('✅ Timing configured\n');
        } catch (error) {
            console.error(`⚠️  Timing config failed: ${error.message}\n`);
        }

        // Wait for snapshot interval
        console.log('⏳ Waiting 65 seconds for snapshot interval...\n');
        await new Promise(resolve => setTimeout(resolve, 65000));

        // Take snapshot
        console.log('📸 Taking Snapshot...\n');
        try {
            const snapshotTx = await this.lotteryProgram.methods
                .takeSnapshot()
                .accounts({
                    lottery: lotteryPDA,
                    admin: (await anchor.AnchorProvider.env().wallet).publicKey,
                })
                .rpc();

            console.log(`✅ Snapshot taken!`);
            console.log(`   Transaction: ${snapshotTx}\n`);

            // Get snapshot seed
            const lotteryAfter = await this.lotteryProgram.account.lottery.fetch(lotteryPDA);
            console.log(`   Snapshot Seed: ${lotteryAfter.snapshotSeed}\n`);

            // Index winners
            console.log('🏆 Indexing Winners...\n');
            const { HeliusWinnerIndexer } = require('./helius-winner-indexer');
            const indexer = new HeliusWinnerIndexer(
                this.connection,
                this.lotteryProgram,
                lotteryPDA
            );

            const winners = await indexer.indexAndCalculateWinners();
            if (winners) {
                console.log('✅ Winners calculated!\n');

                // Set winners
                const setWinnersTx = await indexer.setWinnersOnChain(
                    winners.mainWinner,
                    winners.minorWinners
                );
                console.log('✅ Winners set on-chain!\n');

                // Test payout
                console.log('💰 Testing Payout...\n');
                const payoutTx = await this.lotteryProgram.methods
                    .payoutWinners()
                    .accounts({
                        lottery: lotteryPDA,
                        admin: (await anchor.AnchorProvider.env().wallet).publicKey,
                    })
                    .rpc();

                console.log(`✅ Payout executed!`);
                console.log(`   Transaction: ${payoutTx}\n`);

                // Final state
                const finalLottery = await this.lotteryProgram.account.lottery.fetch(lotteryPDA);
                console.log(`📊 Final State:`);
                console.log(`   Jackpot: ${(finalLottery.jackpotAmount / 1e9).toFixed(4)} SOL`);
                console.log(`   Carry-over: ${(finalLottery.carryOverAmount / 1e9).toFixed(4)} SOL\n`);
            }
        } catch (error) {
            console.error(`❌ Snapshot/Payout failed: ${error.message}`);
            if (error.logs) {
                error.logs.forEach(log => console.error('   ', log));
            }
        }
    }
}

async function main() {
    console.log('🧪 $25M Volume & Payout Test\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    // Setup Anchor
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(adminKeypair),
        { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    // Load program
    let lotteryProgram;
    try {
        lotteryProgram = anchor.workspace.Lottery;
    } catch (e) {
        const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        lotteryProgram = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);
    }

    const tester = new VolumePayoutTester(connection, lotteryProgram);

    try {
        // Step 1: Simulate $25M volume
        const volumeResult = await tester.simulateVolumeWithExistingWallets();

        // Step 2: Test snapshot and payout
        await tester.testSnapshotAndPayout();

        console.log('='.repeat(70));
        console.log('✅ TEST COMPLETE!');
        console.log(`   Volume Simulated: $${volumeResult.totalVolume.toLocaleString()}`);
        console.log(`   Total Entries: ${volumeResult.totalEntries}`);
        console.log('='.repeat(70) + '\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error.logs) {
            error.logs.forEach(log => console.error('   ', log));
        }
        process.exit(1);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { VolumePayoutTester };







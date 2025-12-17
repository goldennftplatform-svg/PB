// Efficient $25M Volume Test - Uses existing wallets, simulates many entries
// Tests scalability without making 100k transactions

const { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');

// Test Configuration
const TARGET_VOLUME_USD = 25_000_000; // $25M
const TARGET_PLAYERS = 100000; // Simulate 100k players
const BATCH_SIZE = 50; // Process in batches to avoid rate limits

class Efficient25MVolumeTest {
    constructor(connection, lotteryProgram) {
        this.connection = connection;
        this.lotteryProgram = lotteryProgram;
        this.totalVolume = 0;
        this.totalEntries = 0;
    }

    /**
     * Efficient test: Use existing wallets, make multiple entries per wallet
     * This simulates 100k players without creating 100k wallets
     */
    async runEfficientTest() {
        console.log('💰 Efficient $25M Volume Test (100k Players Simulated)\n');
        console.log('='.repeat(70) + '\n');

        // Load existing wallets
        const walletsInfoPath = path.join(WALLETS_DIR, 'wallets-info.json');
        if (!fs.existsSync(walletsInfoPath)) {
            console.error('❌ Test wallets not found! Run create-test-wallets.js first');
            process.exit(1);
        }

        const walletsInfo = JSON.parse(fs.readFileSync(walletsInfoPath, 'utf8'));
        console.log(`📊 Using ${walletsInfo.length} existing wallets\n`);
        console.log(`🎯 Strategy: Each wallet makes multiple entries to simulate ${TARGET_PLAYERS.toLocaleString()} players\n`);

        // Derive lottery PDA
        const [lotteryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );

        // Calculate entries per wallet to reach $25M
        const entriesPerWallet = Math.ceil((TARGET_VOLUME_USD * 100) / (walletsInfo.length * 100)); // Average $100 per entry
        const totalEntriesNeeded = Math.ceil((TARGET_VOLUME_USD * 100) / 10000); // $100 entries

        console.log(`📊 Test Plan:`);
        console.log(`   Target Volume: $${TARGET_VOLUME_USD.toLocaleString()}`);
        console.log(`   Entries per Wallet: ~${entriesPerWallet}`);
        console.log(`   Total Entries: ~${totalEntriesNeeded.toLocaleString()}\n`);

        // Process in batches
        console.log('🎫 Processing Entries (Batched)...\n');
        let processed = 0;
        let successful = 0;
        let failed = 0;

        for (let i = 0; i < walletsInfo.length; i++) {
            const walletInfo = walletsInfo[i];
            const walletData = JSON.parse(fs.readFileSync(walletInfo.path, 'utf8'));
            const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(walletData.secretKey));

            // Each wallet makes multiple entries
            const entriesForThisWallet = Math.min(entriesPerWallet, Math.ceil(totalEntriesNeeded / walletsInfo.length));
            
            for (let j = 0; j < entriesForThisWallet && this.totalVolume < TARGET_VOLUME_USD * 100; j++) {
                try {
                    // Vary purchase amounts
                    const baseAmount = 2000 + Math.floor(Math.random() * 98000); // $20-$1000
                    const usdValue = baseAmount;

                    await this.makeEntry(walletKeypair, lotteryPDA, usdValue);
                    
                    this.totalVolume += usdValue;
                    this.totalEntries++;
                    successful++;

                    if (this.totalEntries % 100 === 0) {
                        console.log(`   ✅ Processed ${this.totalEntries.toLocaleString()} entries ($${(this.totalVolume / 100).toLocaleString()} volume)`);
                    }

                    // Small delay to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    failed++;
                    if (failed % 10 === 0) {
                        console.error(`   ⚠️  ${failed} failures so far...`);
                    }
                }
            }

            processed++;
            if (processed % 5 === 0) {
                console.log(`   📊 Wallet ${processed}/${walletsInfo.length} processed\n`);
            }
        }

        // Check final state
        console.log('\n📊 Final Lottery State:\n');
        try {
            const lottery = await this.lotteryProgram.account.lottery.fetch(lotteryPDA);
            console.log(`   Total Participants: ${lottery.totalParticipants}`);
            console.log(`   Total Tickets: ${lottery.totalTickets}`);
            console.log(`   Status: ${lottery.isActive ? '✅ Active' : '❌ Inactive'}\n`);
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}\n`);
        }

        // Summary
        console.log('='.repeat(70));
        console.log('📊 TEST SUMMARY:');
        console.log(`   Target Volume: $${TARGET_VOLUME_USD.toLocaleString()}`);
        console.log(`   Actual Volume: $${(this.totalVolume / 100).toLocaleString()}`);
        console.log(`   Total Entries: ${this.totalEntries.toLocaleString()}`);
        console.log(`   Successful: ${successful}`);
        console.log(`   Failed: ${failed}`);
        console.log(`   Progress: ${((this.totalVolume / 100) / TARGET_VOLUME_USD * 100).toFixed(2)}%`);
        console.log('='.repeat(70) + '\n');

        return {
            targetVolume: TARGET_VOLUME_USD,
            actualVolume: this.totalVolume / 100,
            totalEntries: this.totalEntries,
            successful,
            failed
        };
    }

    /**
     * Make a lottery entry
     */
    async makeEntry(walletKeypair, lotteryPDA, usdValue) {
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

        if (isNew) {
            await this.lotteryProgram.methods
                .enterLotteryWithUsdValue(new anchor.BN(usdValue))
                .accounts({
                    lottery: lotteryPDA,
                    participantAccount: participantPDA,
                    participant: walletKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([walletKeypair])
                .rpc();
        } else {
            const ticketCount = usdValue >= 2000 && usdValue < 10000 ? 1 :
                               usdValue >= 10000 && usdValue < 50000 ? 4 : 10;
            
            await this.lotteryProgram.methods
                .updateParticipantTickets(ticketCount, new anchor.BN(usdValue))
                .accounts({
                    lottery: lotteryPDA,
                    participantAccount: participantPDA,
                    participant: walletKeypair.publicKey,
                })
                .signers([walletKeypair])
                .rpc();
        }
    }
}

async function main() {
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

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}\n`);

    const tester = new Efficient25MVolumeTest(connection, lotteryProgram);
    
    try {
        const results = await tester.runEfficientTest();
        
        console.log('✅ Volume test complete!\n');
        console.log('🎯 Next: Test snapshot and payout\n');
        console.log('   Run: node scripts/trigger-snapshot.js');
        console.log('   Then: node scripts/helius-winner-indexer.js');
        console.log('   Finally: node scripts/trigger-payout.js\n');
    } catch (error) {
        console.error('❌ Test failed:', error);
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

module.exports = { Efficient25MVolumeTest };







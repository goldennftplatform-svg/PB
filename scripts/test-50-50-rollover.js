// Test the 50/50 Rollover Mechanic
const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function test5050Rollover() {
    console.log('🎰 Testing 50/50 Rollover Mechanic\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
        console.error('❌ Wallet not found!');
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

    // Load IDL
    const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
    if (!fs.existsSync(idlPath)) {
        console.error('❌ IDL not found! Run: anchor build');
        process.exit(1);
    }

    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    const wallet = new anchor.Wallet(adminKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
    });

    anchor.setProvider(provider);
    const program = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        program.programId
    );

    console.log(`🎲 Lottery PDA: ${lotteryPDA.toString()}\n`);

    try {
        // Step 1: Check current lottery state
        console.log('📊 Step 1: Checking Current Lottery State\n');
        let lottery;
        try {
            lottery = await program.account.lottery.fetch(lotteryPDA);
            console.log(`   Jackpot: ${(lottery.jackpotAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
            console.log(`   Carry-over: ${((lottery.carryOverAmount || 0) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
            console.log(`   Participants: ${lottery.totalParticipants}`);
            console.log(`   Tickets: ${lottery.totalTickets}`);
            console.log(`   Rollover Count: ${lottery.rolloverCount || 0}`);
            console.log(`   Pepe Ball Count: ${lottery.pepeBallCount || 0}`);
            console.log(`   Last Snapshot: ${new Date(lottery.lastSnapshot * 1000).toLocaleString()}`);
            console.log(`   Is Active: ${lottery.isActive}\n`);
        } catch (error) {
            console.error('❌ Lottery not initialized! Run initialization first.\n');
            process.exit(1);
        }

        // Step 2: Create test entries if needed
        if (lottery.totalParticipants < 9) {
            console.log('📝 Step 2: Creating Test Entries (Need 9+ participants)\n');
            console.log('   Creating 10 test wallets...\n');

            const testWallets = [];
            for (let i = 0; i < 10; i++) {
                const keypair = Keypair.generate();
                testWallets.push(keypair);
                
                // Airdrop SOL to test wallet
                try {
                    const sig = await connection.requestAirdrop(keypair.publicKey, 1 * LAMPORTS_PER_SOL);
                    await connection.confirmTransaction(sig, 'confirmed');
                    console.log(`   ✅ Wallet ${i + 1}: ${keypair.publicKey.toString()} (funded)`);
                } catch (error) {
                    console.log(`   ⚠️  Wallet ${i + 1}: ${keypair.publicKey.toString()} (airdrop failed, using existing)`);
                }
            }

            // Enter lottery with each wallet
            console.log('\n   Entering lottery...\n');
            for (let i = 0; i < testWallets.length; i++) {
                try {
                    const [participantPDA] = PublicKey.findProgramAddressSync(
                        [
                            Buffer.from('participant'),
                            lotteryPDA.toBuffer(),
                            testWallets[i].publicKey.toBuffer()
                        ],
                        program.programId
                    );

                    const usdValue = 2000 + (i * 1000); // $20-$29 entries
                    const tx = await program.methods
                        .enterLotteryWithUsdValue(new anchor.BN(usdValue))
                        .accounts({
                            lottery: lotteryPDA,
                            participantAccount: participantPDA,
                            participant: testWallets[i].publicKey,
                            systemProgram: anchor.web3.SystemProgram.programId,
                        })
                        .signers([testWallets[i]])
                        .rpc();

                    console.log(`   ✅ Entry ${i + 1}: $${(usdValue / 100).toFixed(2)} (tx: ${tx.slice(0, 16)}...)`);
                    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
                } catch (error) {
                    console.log(`   ⚠️  Entry ${i + 1} failed: ${error.message}`);
                }
            }

            // Refresh lottery state
            lottery = await program.account.lottery.fetch(lotteryPDA);
            console.log(`\n   ✅ Total Participants: ${lottery.totalParticipants}`);
            console.log(`   ✅ Total Tickets: ${lottery.totalTickets}\n`);
        } else {
            console.log('✅ Step 2: Sufficient participants already exist\n');
        }

        // Step 3: Check if we can take snapshot (timer check)
        console.log('⏰ Step 3: Checking Snapshot Timer\n');
        const clock = await connection.getSlot();
        const currentTime = Date.now() / 1000;
        const timeSinceLastSnapshot = currentTime - lottery.lastSnapshot;
        const snapshotInterval = lottery.isFastMode ? lottery.fastSnapshotInterval : lottery.baseSnapshotInterval;

        console.log(`   Time since last snapshot: ${(timeSinceLastSnapshot / 3600).toFixed(2)} hours`);
        console.log(`   Required interval: ${(snapshotInterval / 3600).toFixed(2)} hours`);
        console.log(`   Can take snapshot: ${timeSinceLastSnapshot >= snapshotInterval ? '✅ YES' : '❌ NO (wait or configure timing)'}\n`);

        if (timeSinceLastSnapshot < snapshotInterval) {
            console.log('⚠️  Timer not ready. Options:');
            console.log('   1. Wait for timer to expire');
            console.log('   2. Use configure_timing to set shorter intervals');
            console.log('   3. Test rollover logic manually\n');
            
            // Show what would happen
            console.log('🔮 Simulating Rollover Logic:\n');
            const simulatedSeed = Math.floor(Math.random() * 1000000);
            const simulatedPepeCount = (simulatedSeed % 30) + 1;
            const isOdd = simulatedPepeCount % 2 === 1;
            
            console.log(`   Simulated Seed: ${simulatedSeed}`);
            console.log(`   Simulated Pepe Ball Count: ${simulatedPepeCount} (${isOdd ? 'ODD' : 'EVEN'})`);
            if (isOdd) {
                console.log(`   → Would trigger PAYOUT (50% main, 40% minors, 10% house)`);
            } else {
                console.log(`   → Would trigger ROLLOVER (grow jackpot, extend timer)`);
            }
            console.log();
            
            return;
        }

        // Step 4: Take snapshot (this triggers 50/50 logic)
        console.log('📸 Step 4: Taking Snapshot (50/50 Rollover Logic)\n');
        
        const snapshotTx = await program.methods
            .takeSnapshot()
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
            })
            .signers([adminKeypair])
            .rpc();

        console.log(`   ✅ Snapshot transaction: ${snapshotTx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${snapshotTx}?cluster=devnet\n`);

        // Wait for confirmation
        await connection.confirmTransaction(snapshotTx, 'confirmed');

        // Step 5: Check result
        console.log('🎲 Step 5: Checking Rollover Result\n');
        lottery = await program.account.lottery.fetch(lotteryPDA);
        
        const pepeCount = lottery.pepeBallCount || 0;
        const isOdd = pepeCount % 2 === 1;
        const rolloverCount = lottery.rolloverCount || 0;

        console.log(`   🐸 Pepe Ball Count: ${pepeCount}`);
        console.log(`   ${isOdd ? '🎉 ODD COUNT - PAYOUT TIME!' : '🚀 EVEN COUNT - ROLLOVER!'}`);
        console.log(`   Rollover Count: ${rolloverCount}\n`);

        if (isOdd) {
            console.log('💰 PAYOUT MODE:');
            console.log('   → Winners can be selected');
            console.log('   → Payout structure: 50% main, 40% minors (5% each), 10% house');
            console.log('   → Use helius-winner-indexer.js to find winners');
            console.log('   → Then use secure-payout-tool.js to execute payout\n');
        } else {
            console.log('🚀 ROLLOVER MODE:');
            console.log('   → Jackpot grows');
            console.log('   → Timer extended');
            console.log('   → Participants carry over');
            console.log(`   → Next snapshot in: ${((lottery.lastSnapshot - currentTime) / 3600).toFixed(2)} hours\n`);
        }

        console.log('='.repeat(70));
        console.log('✅ 50/50 Rollover Test Complete!\n');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.logs) {
            console.error('\nTransaction logs:');
            error.logs.forEach(log => console.error('   ', log));
        }
        throw error;
    }
}

if (require.main === module) {
    test5050Rollover()
        .then(() => {
            console.log('🎉 Test completed successfully!\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { test5050Rollover };


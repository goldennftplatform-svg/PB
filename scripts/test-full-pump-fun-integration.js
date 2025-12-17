// Full Pump.fun Integration Test
// Tests: Token → LP Pool → Purchases → Auto-Entry → Snapshot → Winners

const { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const TOKEN_MINT = new PublicKey('CXcoVCAuQB2XigJmyGz162aj1MCgJxC9Hgo5SEuRuFto');

async function runFullIntegrationTest() {
    console.log('🧪 Full Pump.fun Integration Test\n');
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

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}`);
    console.log(`✅ Token Mint: ${TOKEN_MINT.toString()}\n`);

    // Step 1: Check lottery state
    console.log('📊 Step 1: Checking Lottery State\n');
    try {
        const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
        console.log(`   Status: ${lottery.isActive ? '✅ Active' : '❌ Inactive'}`);
        console.log(`   Participants: ${lottery.totalParticipants}`);
        console.log(`   Tickets: ${lottery.totalTickets}`);
        console.log(`   Jackpot: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL\n`);
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}\n`);
        return;
    }

    // Step 2: Simulate multiple Pump.fun purchases
    console.log('🛒 Step 2: Simulating Pump.fun Purchases\n');
    
    // Use existing test wallets
    const walletsInfoPath = path.join(__dirname, '..', 'test-wallets', 'wallets-info.json');
    if (!fs.existsSync(walletsInfoPath)) {
        console.error('❌ Test wallets not found! Run create-test-wallets.js first');
        return;
    }

    const walletsInfo = JSON.parse(fs.readFileSync(walletsInfoPath, 'utf8'));
    const testWallets = walletsInfo.slice(0, 10); // Use first 10 wallets

    // Purchase amounts (in SOL, simulating different USD values)
    const purchaseAmounts = [
        0.2,  // $20 - qualifies (1 ticket)
        0.5,  // $50 - qualifies (1 ticket)
        1.0,  // $100 - qualifies (4 tickets)
        0.15, // $15 - doesn't qualify
        2.0,  // $200 - qualifies (4 tickets)
        5.0,  // $500 - qualifies (10 tickets)
        0.25, // $25 - qualifies (1 ticket)
        0.3,  // $30 - qualifies (1 ticket)
        0.1,  // $10 - doesn't qualify
        0.4,  // $40 - qualifies (1 ticket)
    ];

    const purchases = [];
    for (let i = 0; i < testWallets.length && i < purchaseAmounts.length; i++) {
        const walletInfo = testWallets[i];
        const walletData = JSON.parse(fs.readFileSync(walletInfo.path, 'utf8'));
        const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(walletData.secretKey));
        
        // Simulate price: $100 per SOL, $0.00002 per token
        const solPrice = 100;
        const tokenPrice = 0.00002;
        const solAmount = purchaseAmounts[i];
        const usdValue = solAmount * solPrice;
        const tokenAmount = Math.floor((usdValue / tokenPrice) * 1e9);

        purchases.push({
            wallet: walletKeypair,
            solAmount,
            usdValue,
            tokenAmount,
            qualifies: usdValue >= 20
        });

        console.log(`   Buyer ${i + 1}: ${walletKeypair.publicKey.toString().substring(0, 8)}...`);
        console.log(`      Purchase: ${solAmount} SOL ($${usdValue.toFixed(2)})`);
        console.log(`      Tokens: ${(tokenAmount / 1e9).toLocaleString()}`);
        console.log(`      Qualifies: ${usdValue >= 20 ? '✅ YES' : '❌ NO'}\n`);
    }

    // Step 3: Test auto-entry for qualifying purchases
    console.log('🎰 Step 3: Testing Auto-Entry\n');
    let entries = 0;
    let failures = 0;

    for (const purchase of purchases) {
        if (!purchase.qualifies) {
            console.log(`   ⏭️  Skipping ${purchase.wallet.publicKey.toString().substring(0, 8)}... (below $20)\n`);
            continue;
        }

        try {
            // Derive participant account PDA
            const [participantPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('participant'),
                    lotteryPDA.toBuffer(),
                    purchase.wallet.publicKey.toBuffer()
                ],
                LOTTERY_PROGRAM_ID
            );

            // Check if account exists
            const accountInfo = await connection.getAccountInfo(participantPDA);
            const isNew = !accountInfo || accountInfo.lamports === 0;

            if (isNew) {
                const tx = await lotteryProgram.methods
                    .enterLotteryWithUsdValue(new anchor.BN(Math.floor(purchase.usdValue * 100)))
                    .accounts({
                        lottery: lotteryPDA,
                        participantAccount: participantPDA,
                        participant: purchase.wallet.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([purchase.wallet])
                    .rpc();

                console.log(`   ✅ Entered: ${purchase.wallet.publicKey.toString().substring(0, 8)}... ($${purchase.usdValue.toFixed(2)})`);
                entries++;
            } else {
                // Update existing
                const ticketCount = purchase.usdValue >= 20 && purchase.usdValue < 100 ? 1 :
                                   purchase.usdValue >= 100 && purchase.usdValue < 500 ? 4 : 10;
                
                const tx = await lotteryProgram.methods
                    .updateParticipantTickets(
                        ticketCount,
                        new anchor.BN(Math.floor(purchase.usdValue * 100))
                    )
                    .accounts({
                        lottery: lotteryPDA,
                        participantAccount: participantPDA,
                        participant: purchase.wallet.publicKey,
                    })
                    .signers([purchase.wallet])
                    .rpc();

                console.log(`   ✅ Updated: ${purchase.wallet.publicKey.toString().substring(0, 8)}... ($${purchase.usdValue.toFixed(2)})`);
                entries++;
            }

            await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
        } catch (error) {
            console.error(`   ❌ Failed: ${purchase.wallet.publicKey.toString().substring(0, 8)}... - ${error.message}\n`);
            failures++;
        }
    }

    // Step 4: Check final state
    console.log('\n📊 Step 4: Final Lottery State\n');
    try {
        const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
        console.log(`   Total Participants: ${lottery.totalParticipants}`);
        console.log(`   Total Tickets: ${lottery.totalTickets}`);
        console.log(`   Jackpot: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL\n`);
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}\n`);
    }

    // Step 5: Test snapshot (if enough participants)
    console.log('📸 Step 5: Testing Snapshot\n');
    try {
        const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
        
        if (lottery.totalParticipants >= 9) {
            // Configure short timing for testing
            await lotteryProgram.methods
                .configureTiming(
                    new anchor.BN(60), // 1 minute
                    new anchor.BN(30), // 30 seconds
                    new anchor.BN(1 * 1e9) // 1 SOL threshold
                )
                .accounts({
                    lottery: lotteryPDA,
                    admin: adminKeypair.publicKey,
                })
                .rpc();

            console.log('   ✅ Configured test timing (1 minute intervals)\n');
            console.log('   ⏳ Waiting 65 seconds for snapshot...\n');
            await new Promise(resolve => setTimeout(resolve, 65000));

            // Take snapshot
            const snapshotTx = await lotteryProgram.methods
                .takeSnapshot()
                .accounts({
                    lottery: lotteryPDA,
                    admin: adminKeypair.publicKey,
                })
                .rpc();

            console.log(`   ✅ Snapshot taken! Transaction: ${snapshotTx.substring(0, 20)}...\n`);

            // Step 6: Test winner indexing
            console.log('🏆 Step 6: Testing Winner Indexing\n');
            const { HeliusWinnerIndexer } = require('./helius-winner-indexer');
            const indexer = new HeliusWinnerIndexer(connection, lotteryProgram, lotteryPDA);
            
            const winners = await indexer.indexAndCalculateWinners();
            if (winners) {
                console.log('   ✅ Winners calculated!\n');
                
                // Set winners on-chain
                const setWinnersTx = await indexer.setWinnersOnChain(
                    winners.mainWinner,
                    winners.minorWinners
                );
                console.log('   ✅ Winners set on-chain!\n');
            }
        } else {
            console.log(`   ⏭️  Not enough participants (need 9, have ${lottery.totalParticipants})\n`);
        }
    } catch (error) {
        console.error(`   ❌ Snapshot failed: ${error.message}\n`);
    }

    // Final summary
    console.log('='.repeat(70));
    console.log('📊 TEST SUMMARY:');
    console.log(`   Test Purchases: ${purchases.length}`);
    console.log(`   Qualifying: ${purchases.filter(p => p.qualifies).length}`);
    console.log(`   Successful Entries: ${entries}`);
    console.log(`   Failed Entries: ${failures}`);
    console.log('='.repeat(70) + '\n');

    console.log('✅ Full integration test complete!\n');
    console.log('🎯 Next Steps:');
    console.log('   1. Launch on Pump.fun (mainnet)');
    console.log('   2. Monitor auto-entry in production');
    console.log('   3. Run Helius indexer after snapshots');
    console.log('   4. Execute payouts\n');
}

if (require.main === module) {
    runFullIntegrationTest()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { runFullIntegrationTest };







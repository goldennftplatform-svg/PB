// Run 5 snapshots with proper timing waits
const { triggerSnapshotRaw } = require('./trigger-snapshot-raw');
const { Connection, PublicKey } = require('@solana/web3.js');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

async function run5SnapshotsWithWait() {
    console.log('\n🎰 RUNNING 5 SNAPSHOT TESTS (with timing waits)\n');
    console.log('='.repeat(80) + '\n');
    console.log('This will trigger 5 snapshots with 2-minute waits between each.\n');
    console.log('Note: If timing errors occur, the interval needs to be configured.\n');

    const connection = new Connection(RPC_URL, 'confirmed');
    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);

    const results = [];
    let payoutCount = 0;
    let rolloverCount = 0;
    let successCount = 0;

    for (let i = 1; i <= 5; i++) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📸 TEST ${i}/5`);
        console.log('='.repeat(80) + '\n');

        try {
            // Trigger snapshot
            console.log('🚀 Triggering snapshot...\n');
            await triggerSnapshotRaw();
            successCount++;

            // Wait for confirmation
            console.log('⏳ Waiting 5 seconds for confirmation...\n');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Check the snapshot transaction
            const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 3 });
            
            if (signatures.length > 0) {
                const latestSig = signatures[0];
                try {
                    const tx = await connection.getTransaction(latestSig.signature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0
                    });

                    if (tx && tx.meta && tx.meta.logMessages) {
                        const logs = tx.meta.logMessages.join(' ');
                        
                        let isOdd = false;
                        let isEven = false;
                        let pepeBallCount = null;
                        
                        // Check logs for ODD/EVEN indicators
                        if (logs.includes('ODD') || logs.includes('PAYOUT TIME')) {
                            isOdd = true;
                        } else if (logs.includes('EVEN') || logs.includes('ROLLOVER')) {
                            isEven = true;
                        }
                        
                        // Try to extract Pepe ball count from logs
                        const pepeMatch = logs.match(/Pepe.*?[Bb]all.*?[Cc]ount[:\s]+(\d+)/i);
                        if (pepeMatch) {
                            pepeBallCount = parseInt(pepeMatch[1]);
                            isOdd = pepeBallCount % 2 === 1;
                            isEven = pepeBallCount % 2 === 0;
                        }

                        const outcome = isOdd ? 'PAYOUT' : isEven ? 'ROLLOVER' : 'UNKNOWN';
                        
                        if (isOdd) payoutCount++;
                        if (isEven) rolloverCount++;

                        const result = {
                            test: i,
                            timestamp: new Date().toISOString(),
                            signature: latestSig.signature,
                            pepeBallCount: pepeBallCount || 'unknown',
                            outcome: outcome,
                            isOdd: isOdd,
                            isEven: isEven
                        };

                        results.push(result);

                        console.log(`✅ Test ${i} complete!`);
                        console.log(`   Transaction: ${latestSig.signature.substring(0, 20)}...`);
                        if (pepeBallCount) {
                            console.log(`   🎲 Pepe Ball Count: ${pepeBallCount}`);
                        }
                        console.log(`   📊 Outcome: ${outcome === 'PAYOUT' ? '🎉 PAYOUT TIME!' : outcome === 'ROLLOVER' ? '🚀 ROLLOVER!' : '❓ UNKNOWN'}`);
                        console.log(`   Explorer: https://explorer.solana.com/tx/${latestSig.signature}?cluster=devnet\n`);

                        if (isOdd) {
                            console.log('   💡 This was ODD - Winners should be selected and payout triggered!\n');
                        } else if (isEven) {
                            console.log('   💡 This was EVEN - Rollover! Jackpot grows, no payout yet.\n');
                        } else {
                            console.log('   ⚠️  Could not determine ODD/EVEN - check transaction logs\n');
                        }
                    }
                } catch (txError) {
                    console.warn(`   ⚠️  Could not parse transaction: ${txError.message}\n`);
                }
            }

            // Wait between tests (except after last one)
            if (i < 5) {
                const waitMinutes = 2;
                console.log(`⏸️  Waiting ${waitMinutes} minutes for timing interval before next test...\n`);
                console.log(`   (This allows the snapshot interval to pass)\n`);
                await new Promise(resolve => setTimeout(resolve, waitMinutes * 60 * 1000));
            }
        } catch (error) {
            console.error(`❌ Test ${i} failed: ${error.message}\n`);
            if (error.logs) {
                console.error('   Transaction logs:');
                error.logs.forEach(log => console.error('      ', log));
            }
            
            // If it's a timing error, wait longer and try again
            if (error.message.includes('DrawTooEarly') || error.message.includes('too early')) {
                console.log('   ⏳ Timing error - waiting 3 minutes and will continue...\n');
                await new Promise(resolve => setTimeout(resolve, 180000)); // 3 minutes
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    console.log(`   Successful snapshots: ${successCount}/5`);
    console.log(`   🎉 Payouts (ODD): ${payoutCount}`);
    console.log(`   🚀 Rollovers (EVEN): ${rolloverCount}\n`);

    if (payoutCount > 0) {
        console.log('✅ SUCCESS! At least one payout was triggered!\n');
        console.log('   Next steps:');
        console.log('   1. Calculate winners from snapshot seed (off-chain)');
        console.log('   2. Call set_winners instruction');
        console.log('   3. Call payout_winners instruction');
        console.log('   4. Frontend will then show all wallet payouts!\n');
    } else if (successCount > 0) {
        console.log('⚠️  Snapshots triggered but ODD/EVEN not determined');
        console.log('   Check transaction logs manually to see results\n');
    } else {
        console.log('⚠️  No snapshots triggered - check timing configuration\n');
    }
}

if (require.main === module) {
    run5SnapshotsWithWait()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            console.error(error.stack);
            process.exit(1);
        });
}

module.exports = { run5SnapshotsWithWait };

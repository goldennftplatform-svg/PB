// Run 5 snapshot tests to trigger at least one payout (50/50 rollover)
const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const { triggerSnapshotRaw } = require('./trigger-snapshot-raw');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

async function run5SnapshotTests() {
    console.log('\n🎰 RUNNING 5 SNAPSHOT TESTS (50/50 Rollover)\n');
    console.log('='.repeat(80) + '\n');
    console.log('This will trigger 5 snapshots to test the 50/50 rollover mechanic:');
    console.log('  - ODD count = PAYOUT TIME (winners selected)');
    console.log('  - EVEN count = ROLLOVER (jackpot grows, no payout)\n');

    const connection = new Connection(RPC_URL, 'confirmed');
    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);

    const results = [];
    let payoutCount = 0;
    let rolloverCount = 0;

    for (let i = 1; i <= 5; i++) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📸 TEST ${i}/5`);
        console.log('='.repeat(80) + '\n');

        try {
            // Trigger snapshot
            console.log('🚀 Triggering snapshot...\n');
            await triggerSnapshotRaw();

            // Wait for confirmation
            console.log('⏳ Waiting for transaction confirmation...\n');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Check the snapshot transaction to see result
            const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 5 });
            
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
                        const pepeMatch = logs.match(/Pepe Ball Count[:\s]+(\d+)/i);
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
                        }
                    }
                } catch (txError) {
                    console.warn(`   ⚠️  Could not parse transaction: ${txError.message}\n`);
                    results.push({
                        test: i,
                        timestamp: new Date().toISOString(),
                        error: txError.message
                    });
                }
            }

            // Wait between tests (except after last one)
            if (i < 5) {
                console.log('⏸️  Waiting 3 seconds before next test...\n');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } catch (error) {
            console.error(`❌ Test ${i} failed: ${error.message}\n`);
            if (error.logs) {
                console.error('   Transaction logs:');
                error.logs.forEach(log => console.error('      ', log));
            }
            results.push({
                test: i,
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    console.log(`   Total tests: ${results.length}`);
    console.log(`   🎉 Payouts (ODD): ${payoutCount}`);
    console.log(`   🚀 Rollovers (EVEN): ${rolloverCount}`);
    console.log(`   ❌ Failed: ${results.filter(r => r.error).length}\n`);

    if (payoutCount > 0) {
        console.log('✅ SUCCESS! At least one payout was triggered!\n');
        console.log('   Next steps:');
        console.log('   1. Calculate winners from snapshot seed (off-chain)');
        console.log('   2. Call set_winners instruction');
        console.log('   3. Call payout_winners instruction');
        console.log('   4. Frontend will then show all wallet payouts!\n');
    } else {
        console.log('⚠️  No payouts triggered (all were rollovers)');
        console.log('   This is normal - 50/50 means ~50% chance of payout\n');
    }

    // Save results
    const resultsPath = path.join(__dirname, '..', 'test-results', '5-snapshot-tests.json');
    const resultsDir = path.dirname(resultsPath);
    
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`📁 Results saved to: ${resultsPath}\n`);

    return results;
}

if (require.main === module) {
    run5SnapshotTests()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            console.error(error.stack);
            process.exit(1);
        });
}

module.exports = { run5SnapshotTests };

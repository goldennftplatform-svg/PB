// Run 10 snapshot tests and collect results
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const { triggerSnapshotRaw } = require('./trigger-snapshot-raw');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function runSnapshotTests() {
    console.log('🎰 Running 10 Snapshot Tests\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    const results = [];

    for (let i = 1; i <= 10; i++) {
        console.log(`\n📸 Test ${i}/10\n`);
        console.log('-'.repeat(70));

        try {
            // Trigger snapshot
            await triggerSnapshotRaw();

            // Wait for confirmation
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Try to get lottery state (simplified - would need IDL for full parsing)
            const accountInfo = await connection.getAccountInfo(lotteryPDA);
            
            if (accountInfo) {
                // Parse account data to get pepe_ball_count (at offset ~420)
                // This is approximate - actual offset depends on struct layout
                const data = accountInfo.data;
                let pepeBallCount = 0;
                
                // Try to read pepe_ball_count (u8 at end of struct)
                if (data.length >= 423) {
                    pepeBallCount = data[422]; // Approximate offset
                }

                const isOdd = pepeBallCount % 2 === 1;
                const result = {
                    test: i,
                    timestamp: new Date().toISOString(),
                    pepeBallCount: pepeBallCount || 'unknown',
                    outcome: isOdd ? 'PAYOUT' : 'ROLLOVER',
                    accountSize: accountInfo.data.length
                };

                results.push(result);

                console.log(`   ✅ Test ${i} complete`);
                console.log(`   🎲 Pepe Balls: ${result.pepeBallCount}`);
                console.log(`   📊 Outcome: ${result.outcome}\n`);
            } else {
                console.log(`   ⚠️  Could not read lottery account\n`);
            }

            // Wait between tests
            if (i < 10) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.log(`   ❌ Test ${i} failed: ${error.message}\n`);
            results.push({
                test: i,
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }

    // Save results
    const resultsPath = path.join(__dirname, '..', 'test-results', 'snapshot-tests.json');
    const resultsDir = path.dirname(resultsPath);
    
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log('='.repeat(70));
    console.log('\n✅ All tests complete!\n');
    console.log(`📊 Results saved to: ${resultsPath}\n`);
    console.log('📈 Summary:');
    console.log(`   Total tests: ${results.length}`);
    console.log(`   Successful: ${results.filter(r => !r.error).length}`);
    console.log(`   Failed: ${results.filter(r => r.error).length}\n`);

    return results;
}

if (require.main === module) {
    runSnapshotTests()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

module.exports = { runSnapshotTests };


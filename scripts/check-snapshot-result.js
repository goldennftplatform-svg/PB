// Check the snapshot transaction to see if it was ODD (payout) or EVEN (rollover)
const { Connection, PublicKey } = require('@solana/web3.js');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

async function checkSnapshotResult() {
    console.log('\n🔍 CHECKING SNAPSHOT RESULT\n');
    console.log('='.repeat(80) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');
    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);

    // Get recent transactions
    const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 20 });
    
    // Find snapshot transaction
    for (const sig of signatures) {
        try {
            const tx = await connection.getTransaction(sig.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!tx || !tx.meta || !tx.meta.logMessages) continue;

            const logs = tx.meta.logMessages.join(' ');
            
            if (logs.includes('take_snapshot') || logs.includes('TakeSnapshot')) {
                console.log(`📸 Found snapshot transaction: ${sig.signature}`);
                console.log(`   Time: ${new Date(sig.blockTime * 1000).toLocaleString()}\n`);
                
                // Check for ODD or EVEN
                if (logs.includes('ODD') || logs.includes('PAYOUT TIME')) {
                    console.log('🎉 RESULT: ODD - PAYOUT TIME!\n');
                    console.log('   This means winners should be selected and payout should happen.\n');
                    console.log('   If no payout transaction exists, you need to:');
                    console.log('   1. Calculate winners (off-chain)');
                    console.log('   2. Call set_winners instruction');
                    console.log('   3. Call payout_winners instruction\n');
                } else if (logs.includes('EVEN') || logs.includes('ROLLOVER')) {
                    console.log('🚀 RESULT: EVEN - ROLLOVER!\n');
                    console.log('   This means no payout yet - jackpot grows and timer extends.\n');
                    console.log('   Participants carry over to next draw.\n');
                } else {
                    console.log('⚠️  Could not determine ODD/EVEN from logs\n');
                    console.log('   Logs contain:');
                    const relevantLogs = tx.meta.logMessages.filter(log => 
                        log.includes('Pepe') || log.includes('pepe') || 
                        log.includes('ODD') || log.includes('EVEN') ||
                        log.includes('ROLLOVER') || log.includes('PAYOUT')
                    );
                    relevantLogs.forEach(log => console.log(`   - ${log}`));
                }
                
                // Show all logs for debugging
                console.log('\n📋 All transaction logs:');
                tx.meta.logMessages.forEach((log, i) => {
                    if (log.includes('Pepe') || log.includes('Snapshot') || log.includes('Participant') || log.includes('Winner')) {
                        console.log(`   ${i + 1}. ${log}`);
                    }
                });
                
                break; // Found snapshot, stop looking
            }
        } catch (e) {
            // Skip failed fetches
        }
    }
}

checkSnapshotResult().catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
});

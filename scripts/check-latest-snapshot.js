// Check the latest snapshot transaction for ODD/EVEN result
const { Connection, PublicKey } = require('@solana/web3.js');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

async function checkLatestSnapshot() {
    console.log('\n🔍 CHECKING LATEST SNAPSHOT\n');
    console.log('='.repeat(80) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');
    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);

    // Get recent transactions
    const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 10 });
    
    // Find latest snapshot
    for (const sig of signatures) {
        try {
            const tx = await connection.getTransaction(sig.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!tx || !tx.meta || !tx.meta.logMessages) continue;

            const logs = tx.meta.logMessages;
            const logsText = logs.join(' ');
            
            if (logsText.includes('take_snapshot') || logsText.includes('TakeSnapshot')) {
                console.log(`📸 Found snapshot transaction: ${sig.signature}`);
                console.log(`   Time: ${new Date(sig.blockTime * 1000).toLocaleString()}\n`);
                
                // Show all logs
                console.log('📋 Transaction Logs:\n');
                logs.forEach((log, i) => {
                    console.log(`   ${i + 1}. ${log}`);
                });
                
                // Check for key indicators
                console.log('\n🔍 Analysis:\n');
                
                if (logsText.includes('ODD') || logsText.includes('PAYOUT TIME')) {
                    console.log('   🎉 RESULT: ODD - PAYOUT TIME!\n');
                    console.log('   This means winners should be selected and payout triggered.\n');
                } else if (logsText.includes('EVEN') || logsText.includes('ROLLOVER')) {
                    console.log('   🚀 RESULT: EVEN - ROLLOVER!\n');
                    console.log('   This means no payout yet - jackpot grows, timer extends.\n');
                } else {
                    console.log('   ⚠️  Could not determine ODD/EVEN from logs\n');
                    console.log('   Looking for Pepe ball count...\n');
                    
                    // Try to find Pepe ball count
                    const pepeMatch = logsText.match(/Pepe.*?[Bb]all.*?[Cc]ount[:\s]+(\d+)/i);
                    if (pepeMatch) {
                        const count = parseInt(pepeMatch[1]);
                        const isOdd = count % 2 === 1;
                        console.log(`   🎲 Found Pepe Ball Count: ${count}`);
                        console.log(`   ${isOdd ? '🎉 ODD - PAYOUT TIME!' : '🚀 EVEN - ROLLOVER!'}\n`);
                    } else {
                        console.log('   Could not find Pepe ball count in logs\n');
                    }
                }
                
                console.log(`   Explorer: https://explorer.solana.com/tx/${sig.signature}?cluster=devnet\n`);
                break; // Found latest snapshot
            }
        } catch (e) {
            // Skip failed fetches
        }
    }
}

checkLatestSnapshot().catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
});

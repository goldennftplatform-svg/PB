// Test what the frontend should be fetching
// Simulates the frontend data fetching logic

const { Connection, PublicKey } = require('@solana/web3.js');

const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const RPC_URL = 'https://api.devnet.solana.com';

async function testFrontendFetch() {
    console.log('\n' + '='.repeat(70));
    console.log('  🔍 TESTING FRONTEND DATA FETCH');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Derive lottery PDA (same as frontend)
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}`);
    console.log(`   Explorer: https://explorer.solana.com/address/${lotteryPDA.toString()}?cluster=devnet\n`);

    // Check if account exists
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (!accountInfo) {
        console.log('❌ Lottery account NOT initialized!');
        console.log('   Run: node scripts/quick-test-real-data.js\n');
        return;
    }

    console.log(`✅ Lottery account EXISTS`);
    console.log(`   Data size: ${accountInfo.data.length} bytes`);
    console.log(`   Lamports: ${accountInfo.lamports / 1e9} SOL\n`);

    // Get recent transactions (what frontend does)
    console.log('📋 Fetching recent transactions (like frontend)...\n');
    const signatures = await connection.getSignaturesForAddress(
        lotteryPDA,
        { limit: 20 }
    );

    console.log(`✅ Found ${signatures.length} transactions\n`);

    if (signatures.length === 0) {
        console.log('⚠️  No transactions found - lottery may not be initialized\n');
        return;
    }

    // Look for payout/snapshot transactions
    let payoutFound = false;
    let snapshotFound = false;

    for (const sig of signatures.slice(0, 10)) {
        try {
            const tx = await connection.getTransaction(sig.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!tx || !tx.meta || !tx.meta.logMessages) continue;

            const logs = tx.meta.logMessages.join(' ');
            
            // Check for snapshot
            if (logs.includes('take_snapshot') || logs.includes('TakeSnapshot')) {
                snapshotFound = true;
                console.log(`📸 SNAPSHOT TRANSACTION FOUND:`);
                console.log(`   Signature: ${sig.signature}`);
                console.log(`   Explorer: https://explorer.solana.com/tx/${sig.signature}?cluster=devnet`);
                console.log(`   Date: ${new Date(sig.blockTime * 1000).toLocaleString()}\n`);
            }

            // Check for payout
            if (logs.includes('PayoutWinners') || logs.includes('payout') || 
                (logs.includes('Transfer') && tx.meta.postBalances)) {
                
                const accountKeys = tx.transaction.message.accountKeys;
                const preBalances = tx.meta.preBalances || [];
                const postBalances = tx.meta.postBalances || [];

                // Find accounts that received SOL
                const recipients = [];
                for (let i = 0; i < accountKeys.length; i++) {
                    const increase = (postBalances[i] || 0) - (preBalances[i] || 0);
                    if (increase > 1000000) { // > 0.001 SOL
                        const addr = accountKeys[i].toString();
                        if (addr !== '11111111111111111111111111111111') {
                            recipients.push({
                                address: addr,
                                amount: increase / 1e9
                            });
                        }
                    }
                }

                if (recipients.length > 0) {
                    payoutFound = true;
                    recipients.sort((a, b) => b.amount - a.amount);
                    
                    console.log(`💰 PAYOUT TRANSACTION FOUND:`);
                    console.log(`   Signature: ${sig.signature}`);
                    console.log(`   Explorer: https://explorer.solana.com/tx/${sig.signature}?cluster=devnet`);
                    console.log(`   Date: ${new Date(sig.blockTime * 1000).toLocaleString()}`);
                    console.log(`   Winners:`);
                    recipients.slice(0, 9).forEach((r, idx) => {
                        console.log(`      ${idx === 0 ? '🏆 Main' : `   Minor ${idx}`}: ${r.address.substring(0, 12)}... (${r.amount.toFixed(4)} SOL)`);
                    });
                    console.log('');
                }
            }
        } catch (e) {
            // Skip errors
        }
    }

    if (!snapshotFound && !payoutFound) {
        console.log('⚠️  No snapshot or payout transactions found in recent history');
        console.log('   The frontend may not find winners if transactions are older\n');
    }

    console.log('='.repeat(70));
    console.log('  📊 SUMMARY');
    console.log('='.repeat(70) + '\n');
    console.log(`✅ Lottery PDA exists: ${lotteryPDA.toString()}`);
    console.log(`✅ Transactions found: ${signatures.length}`);
    console.log(`${snapshotFound ? '✅' : '❌'} Snapshot transaction: ${snapshotFound ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`${payoutFound ? '✅' : '❌'} Payout transaction: ${payoutFound ? 'FOUND' : 'NOT FOUND'}\n`);

    if (snapshotFound || payoutFound) {
        console.log('💡 The frontend SHOULD be able to fetch this data!');
        console.log('   Check browser console for errors\n');
    } else {
        console.log('⚠️  No winner data found - may need to trigger payout\n');
    }
}

testFrontendFetch().catch(console.error);

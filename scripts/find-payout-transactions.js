// Find all transactions with large SOL transfers (potential payouts)
const { Connection, PublicKey } = require('@solana/web3.js');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

async function findPayoutTransactions() {
    console.log('\n🔍 FINDING PAYOUT TRANSACTIONS\n');
    console.log('='.repeat(80) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');
    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);

    // Get recent transactions
    const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 30 });
    console.log(`Found ${signatures.length} recent transactions\n`);

    const payoutCandidates = [];

    for (const sig of signatures) {
        try {
            const tx = await connection.getTransaction(sig.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!tx || !tx.meta || !tx.transaction) continue;

            const logs = tx.meta.logMessages ? tx.meta.logMessages.join(' ') : '';
            const accountKeys = tx.transaction.message.accountKeys || [];
            const preBalances = tx.meta.preBalances || [];
            const postBalances = tx.meta.postBalances || [];

            // Find accounts that received SOL from lottery
            const recipients = [];
            for (let i = 0; i < Math.min(accountKeys.length, postBalances.length); i++) {
                const preBalance = preBalances[i] || 0;
                const postBalance = postBalances[i] || 0;
                const increase = postBalance - preBalance;

                if (increase > 1000000) { // More than 0.001 SOL
                    const account = accountKeys[i];
                    let address = null;
                    
                    if (typeof account === 'string') {
                        address = account;
                    } else if (account && account.toString) {
                        address = account.toString();
                    }
                    
                    if (address && address !== KNOWN_LOTTERY_PDA && address !== '11111111111111111111111111111111') {
                        recipients.push({
                            address: address,
                            amount: increase,
                            amountSOL: (increase / 1e9).toFixed(6)
                        });
                    }
                }
            }

            if (recipients.length >= 3) { // At least 3 recipients (likely a payout)
                recipients.sort((a, b) => b.amount - a.amount);
                
                payoutCandidates.push({
                    signature: sig.signature,
                    time: new Date(sig.blockTime * 1000).toLocaleString(),
                    recipients: recipients.length,
                    mainRecipient: recipients[0],
                    logs: logs,
                    hasPayoutLogs: logs.includes('payout') || logs.includes('Payout') || logs.includes('Winner')
                });
            }
        } catch (e) {
            // Skip failed fetches
        }
    }

    console.log(`💰 Found ${payoutCandidates.length} potential payout transactions:\n`);
    
    payoutCandidates.forEach((candidate, i) => {
        console.log(`${i + 1}. ${candidate.signature.substring(0, 20)}...`);
        console.log(`   Time: ${candidate.time}`);
        console.log(`   Recipients: ${candidate.recipients}`);
        console.log(`   Main recipient: ${candidate.mainRecipient.address.substring(0, 16)}... (${candidate.mainRecipient.amountSOL} SOL)`);
        console.log(`   Has payout logs: ${candidate.hasPayoutLogs ? '✅' : '❌'}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${candidate.signature}?cluster=devnet\n`);
    });

    if (payoutCandidates.length === 0) {
        console.log('⚠️  No payout transactions found!');
        console.log('   This means either:');
        console.log('   1. The snapshot was EVEN (rollover) - no payout yet');
        console.log('   2. The snapshot was ODD but payout hasn\'t been triggered');
        console.log('   3. Payout transactions exist but aren\'t being detected\n');
    }
}

findPayoutTransactions().catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
});

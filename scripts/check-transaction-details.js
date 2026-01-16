// Check transaction details to see what actually happened
const { Connection, PublicKey } = require('@solana/web3.js');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

async function checkTransactionDetails() {
    console.log('\n🔍 CHECKING TRANSACTION DETAILS\n');
    console.log('='.repeat(80) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');
    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);

    // Get recent transactions
    const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 20 });
    console.log(`Found ${signatures.length} recent transactions\n`);

    let entryTxs = [];
    let snapshotTxs = [];
    let payoutTxs = [];
    let otherTxs = [];

    for (const sig of signatures) {
        try {
            const tx = await connection.getTransaction(sig.signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!tx || !tx.meta) continue;

            const logs = tx.meta.logMessages ? tx.meta.logMessages.join(' ') : '';
            const preBalances = tx.meta.preBalances || [];
            const postBalances = tx.meta.postBalances || [];
            
            // Find lottery account in accounts
            const lotteryAccountIndex = tx.transaction.message.accountKeys.findIndex(
                key => key.toString() === KNOWN_LOTTERY_PDA
            );

            let balanceChange = 0;
            if (lotteryAccountIndex >= 0 && preBalances[lotteryAccountIndex] && postBalances[lotteryAccountIndex]) {
                balanceChange = (postBalances[lotteryAccountIndex] - preBalances[lotteryAccountIndex]) / 1e9;
            }

            const txInfo = {
                signature: sig.signature,
                time: new Date(sig.blockTime * 1000).toLocaleString(),
                success: !tx.meta.err,
                balanceChange: balanceChange.toFixed(6),
                logs: logs
            };

            if (logs.includes('enter_lottery') || logs.includes('EnterLottery')) {
                entryTxs.push(txInfo);
            } else if (logs.includes('take_snapshot') || logs.includes('TakeSnapshot')) {
                snapshotTxs.push(txInfo);
            } else if (logs.includes('payout_winners') || logs.includes('PayoutWinners')) {
                payoutTxs.push(txInfo);
            } else {
                otherTxs.push(txInfo);
            }
        } catch (e) {
            // Skip failed fetches
        }
    }

    console.log(`📝 ENTRY TRANSACTIONS: ${entryTxs.length}\n`);
    entryTxs.slice(0, 5).forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.signature.substring(0, 16)}...`);
        console.log(`      Time: ${tx.time}`);
        console.log(`      Balance Change: ${tx.balanceChange > 0 ? '+' : ''}${tx.balanceChange} SOL`);
        console.log(`      Status: ${tx.success ? '✅ Success' : '❌ Failed'}\n`);
    });

    console.log(`📸 SNAPSHOT TRANSACTIONS: ${snapshotTxs.length}\n`);
    snapshotTxs.forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.signature.substring(0, 16)}...`);
        console.log(`      Time: ${tx.time}`);
        console.log(`      Status: ${tx.success ? '✅ Success' : '❌ Failed'}`);
        if (tx.logs.includes('ODD')) {
            console.log(`      Result: 🎉 ODD - PAYOUT TIME!`);
        } else if (tx.logs.includes('EVEN')) {
            console.log(`      Result: 🚀 EVEN - ROLLOVER!`);
        }
        console.log('');
    });

    console.log(`💰 PAYOUT TRANSACTIONS: ${payoutTxs.length}\n`);
    payoutTxs.forEach((tx, i) => {
        console.log(`   ${i + 1}. ${tx.signature.substring(0, 16)}...`);
        console.log(`      Time: ${tx.time}`);
        console.log(`      Balance Change: ${tx.balanceChange} SOL`);
        console.log(`      Status: ${tx.success ? '✅ Success' : '❌ Failed'}\n`);
    });

    // Check current balance
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    const currentBalance = accountInfo ? (accountInfo.lamports / 1e9).toFixed(6) : '0';
    
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📊 SUMMARY:\n');
    console.log(`   Current Jackpot: ${currentBalance} SOL`);
    console.log(`   Entry Transactions: ${entryTxs.length}`);
    console.log(`   Snapshot Transactions: ${snapshotTxs.length}`);
    console.log(`   Payout Transactions: ${payoutTxs.length}\n`);

    if (parseFloat(currentBalance) < 0.01) {
        console.log('⚠️  WARNING: Jackpot is very low!');
        console.log('   This suggests entries may not have added funds properly.\n');
    }

    if (entryTxs.length >= 9 && snapshotTxs.length === 0) {
        console.log('💡 You have enough entries but no snapshot yet.');
        console.log('   Run: node scripts/trigger-snapshot.js\n');
    }
}

checkTransactionDetails().catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
});

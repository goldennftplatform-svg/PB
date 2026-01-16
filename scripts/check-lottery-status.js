// Quick check of lottery status on devnet
const { Connection, PublicKey } = require('@solana/web3.js');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function checkLotteryStatus() {
    console.log('🔍 Checking Lottery Status on Devnet\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Check program exists
    console.log('1️⃣ Checking if program exists...');
    const programInfo = await connection.getAccountInfo(LOTTERY_PROGRAM_ID);
    if (!programInfo) {
        console.error('❌ Program NOT FOUND on devnet!');
        console.error(`   Program ID: ${LOTTERY_PROGRAM_ID.toString()}`);
        console.error(`   Check: https://explorer.solana.com/address/${LOTTERY_PROGRAM_ID.toString()}?cluster=devnet`);
        process.exit(1);
    }
    console.log('✅ Program exists on devnet');
    console.log(`   Owner: ${programInfo.owner.toString()}`);
    console.log(`   Data length: ${programInfo.data.length} bytes\n`);

    // Derive PDA
    console.log('2️⃣ Deriving Lottery PDA...');
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );
    console.log(`✅ PDA: ${lotteryPDA.toString()}`);
    console.log(`   Explorer: https://explorer.solana.com/address/${lotteryPDA.toString()}?cluster=devnet\n`);

    // Check lottery account
    console.log('3️⃣ Checking lottery account...');
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (!accountInfo) {
        console.error('❌ Lottery account NOT FOUND!');
        console.error('   The lottery needs to be initialized.');
        console.error('\n📋 To initialize, run:');
        console.error('   node scripts/simple-init-lottery.js');
        console.error('   OR');
        console.error('   node scripts/reinit-lottery-50-50.js\n');
        process.exit(1);
    }

    console.log('✅ Lottery account exists!');
    console.log(`   Balance: ${(accountInfo.lamports / 1e9).toFixed(4)} SOL`);
    console.log(`   Data length: ${accountInfo.data.length} bytes`);
    console.log(`   Owner: ${accountInfo.owner.toString()}\n`);

    // Check recent transactions
    console.log('4️⃣ Checking recent transactions...');
    const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 5 });
    console.log(`✅ Found ${signatures.length} recent transactions`);
    if (signatures.length > 0) {
        console.log('   Most recent:');
        signatures.slice(0, 3).forEach((sig, i) => {
            console.log(`   ${i + 1}. ${sig.signature}`);
            console.log(`      Time: ${new Date(sig.blockTime * 1000).toLocaleString()}`);
            console.log(`      Status: ${sig.err ? '❌ Failed' : '✅ Success'}`);
        });
    }

    console.log('\n✅ Lottery is initialized and ready!');
    console.log('   The frontend should be able to fetch data now.\n');
}

checkLotteryStatus().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

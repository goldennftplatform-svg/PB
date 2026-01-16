// Manually fund the lottery jackpot by transferring SOL
// This adds SOL to the lottery account which becomes the jackpot

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

async function fundJackpot() {
    console.log('\n💰 FUNDING LOTTERY JACKPOT\n');
    console.log('='.repeat(80) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
        console.error('❌ Admin wallet not found!');
        console.error(`   Location: ${walletPath}`);
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);

    console.log('📋 CONFIGURATION:');
    console.log(`   Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`   Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Check admin balance
    const adminBalance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Admin Balance: ${(adminBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

    if (adminBalance < 0.1 * LAMPORTS_PER_SOL) {
        console.error('❌ Insufficient balance! Need at least 0.1 SOL');
        process.exit(1);
    }

    // Check current lottery balance
    const lotteryAccount = await connection.getAccountInfo(lotteryPDA);
    const currentJackpot = lotteryAccount ? (lotteryAccount.lamports / LAMPORTS_PER_SOL) : 0;
    console.log(`📊 Current Jackpot: ${currentJackpot.toFixed(4)} SOL\n`);

    // Get amount to fund from command line or use default
    const amountSOL = parseFloat(process.argv[2]) || 1.0; // Default 1 SOL
    const amountLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

    console.log(`💸 Funding Amount: ${amountSOL} SOL (${amountLamports} lamports)\n`);

    if (amountLamports > adminBalance - 0.01 * LAMPORTS_PER_SOL) {
        console.error('❌ Insufficient balance! Need more SOL for fees');
        process.exit(1);
    }

    // Create transfer transaction
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: adminKeypair.publicKey,
            toPubkey: lotteryPDA,
            lamports: amountLamports,
        })
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminKeypair.publicKey;

    // Sign and send
    console.log('📤 Sending transaction...\n');
    transaction.sign(adminKeypair);

    try {
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
        });

        console.log(`⏳ Confirming transaction: ${signature}\n`);
        await connection.confirmTransaction(signature, 'confirmed');

        // Verify new balance
        const newLotteryAccount = await connection.getAccountInfo(lotteryPDA);
        const newJackpot = newLotteryAccount ? (newLotteryAccount.lamports / LAMPORTS_PER_SOL) : 0;

        console.log('✅ TRANSACTION CONFIRMED!\n');
        console.log(`   Old Jackpot: ${currentJackpot.toFixed(4)} SOL`);
        console.log(`   Added: ${amountSOL.toFixed(4)} SOL`);
        console.log(`   New Jackpot: ${newJackpot.toFixed(4)} SOL\n`);
        console.log(`   Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

        console.log('💡 NOTE: The jackpot_amount field in the lottery struct may need to be updated');
        console.log('   separately using update_jackpot_amount if the program tracks it separately.\n');
        console.log('   For now, the SOL is in the account and can be used for payouts.\n');

    } catch (error) {
        console.error('❌ Transaction failed:', error.message);
        process.exit(1);
    }
}

fundJackpot().catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
});

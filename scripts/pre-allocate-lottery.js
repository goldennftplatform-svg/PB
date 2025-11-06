// Pre-allocate lottery account to avoid CPI size limit
const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, clusterApiUrl } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const LOTTERY_PROGRAM_ID = new PublicKey('ytKyH7viyfRmqYtS7Y3nCa8kCJXAPTN6MA8a3EmtSn1');
const NETWORK = 'devnet';

async function preAllocateLottery() {
    console.log('🔧 Pre-allocating Lottery Account\n');
    console.log('='.repeat(60) + '\n');

    // Load admin wallet
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('❌ Admin wallet not found!');
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');
    
    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Program: ${LOTTERY_PROGRAM_ID.toString()}\n`);

    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

    // Derive lottery PDA
    const [lotteryPDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`📝 Lottery PDA: ${lotteryPDA.toString()}`);
    console.log(`   Bump: ${bump}\n`);

    // Check if already exists
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (accountInfo) {
        console.log('✅ Lottery account already exists!');
        console.log(`   Size: ${accountInfo.data.length} bytes`);
        return;
    }

    // Calculate account size (same as Lottery::INIT_SPACE)
    // Base fields: ~100 bytes
    // Participants vector: 4 (length) + 1000 * 48 (Participant size) = 48,004 bytes
    // Winners: ~50 bytes
    // Total: ~48,154 bytes + 8 (discriminator) = 48,162 bytes
    const accountSize = 50000; // Slightly larger for safety

    console.log(`📊 Pre-allocating ${accountSize} bytes...\n`);

    // Create allocation instruction
    const allocateIx = SystemProgram.createAccount({
        fromPubkey: adminKeypair.publicKey,
        newAccountPubkey: lotteryPDA,
        lamports: await connection.getMinimumBalanceForRentExemption(accountSize),
        space: accountSize,
        programId: LOTTERY_PROGRAM_ID,
    });

    // Create transaction
    const transaction = new Transaction().add(allocateIx);

    try {
        console.log('📤 Sending pre-allocation transaction...\n');
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [adminKeypair],
            { commitment: 'confirmed' }
        );

        console.log(`✅ Pre-allocation successful!`);
        console.log(`   Signature: ${signature}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}\n`);
        console.log('✅ Now you can initialize the lottery account!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.logs) {
            console.error('\n📋 Program logs:');
            error.logs.forEach(log => console.error('   ', log));
        }
        throw error;
    }
}

if (require.main === module) {
    preAllocateLottery().catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { preAllocateLottery };


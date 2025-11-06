// Direct initialization using Solana web3.js - bypasses Anchor Program issues
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, clusterApiUrl } = require('@solana/web3.js');
const { serialize } = require('@coral-xyz/anchor/dist/cjs/utils/bytes');
const fs = require('fs');
const path = require('path');

const LOTTERY_PROGRAM_ID = new PublicKey('6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb');
const NETWORK = 'devnet';

// Load IDL to get instruction discriminator
const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

// Find initialize_lottery instruction
const initInstruction = IDL.instructions.find(ix => ix.name === 'initialize_lottery');
const discriminator = Buffer.from(initInstruction.discriminator);

async function initializeLotteryDirect() {
    console.log('🎰 Direct Lottery Initialization\n');
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

    // Check balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

    // Derive lottery PDA
    const [lotteryPDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`📝 Lottery PDA: ${lotteryPDA.toString()}`);
    console.log(`   Bump: ${bump}\n`);

    // Check if exists
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (accountInfo) {
        console.log('⚠️  Lottery account already exists!');
        console.log(`   Size: ${accountInfo.data.length} bytes`);
        console.log(`   Owner: ${accountInfo.owner.toString()}`);
        console.log(`   Lamports: ${accountInfo.lamports / 1e9} SOL\n`);
        console.log('✅ Lottery appears to be initialized!\n');
        return { success: true, alreadyExists: true, lotteryPDA: lotteryPDA.toString() };
    }

    console.log('🚀 Initializing lottery...\n');

    // Build instruction data
    // Discriminator (8 bytes) + jackpot_amount (u64 = 8 bytes)
    const initialJackpot = 20 * 1e9; // 20 SOL
    const jackpotBN = Buffer.allocUnsafe(8);
    jackpotBN.writeBigUInt64LE(BigInt(initialJackpot), 0);
    
    const instructionData = Buffer.concat([
        discriminator,
        jackpotBN
    ]);

    // Create instruction
    const instruction = {
        keys: [
            { pubkey: lotteryPDA, isSigner: true, isWritable: true },
            { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId: LOTTERY_PROGRAM_ID,
        data: instructionData
    };

    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    
    try {
        console.log('📤 Sending transaction...\n');
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [adminKeypair],
            { commitment: 'confirmed' }
        );

        console.log(`✅ Transaction confirmed!`);
        console.log(`   Signature: ${signature}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}\n`);

        // Verify initialization
        const newAccountInfo = await connection.getAccountInfo(lotteryPDA);
        if (newAccountInfo) {
            console.log('✅ Lottery initialized successfully!');
            console.log(`   Account Size: ${newAccountInfo.data.length} bytes`);
            console.log(`   Lamports: ${newAccountInfo.lamports / 1e9} SOL\n`);
        }

        return {
            success: true,
            transaction: signature,
            lotteryPDA: lotteryPDA.toString(),
            explorer: `https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}`
        };

    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        if (error.logs) {
            console.error('Logs:', error.logs);
        }
        return { success: false, error: error.message };
    }
}

if (require.main === module) {
    initializeLotteryDirect().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { initializeLotteryDirect };


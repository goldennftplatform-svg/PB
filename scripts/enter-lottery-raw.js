// Enter lottery using raw transaction (no IDL required)
// Directly calls enter_lottery_with_usd_value on the deployed program

const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const { serialize } = require('borsh');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

// Instruction discriminator for enter_lottery_with_usd_value
// First 8 bytes of sha256("global:enter_lottery_with_usd_value")
const ENTER_LOTTERY_DISCRIMINATOR = Buffer.from([
    0x8a, 0x7c, 0x3e, 0x2d, 0x1f, 0x0a, 0x9b, 0x4c
]);

async function enterLotteryRaw(walletKeypair, usdValueCents) {
    const connection = new Connection(RPC_URL, 'confirmed');

    // Derive PDAs
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    const [participantPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('participant'),
            lotteryPDA.toBuffer(),
            walletKeypair.publicKey.toBuffer()
        ],
        LOTTERY_PROGRAM_ID
    );

    // Build instruction data: discriminator + usd_value (u64, little-endian)
    const usdValueBuffer = Buffer.allocUnsafe(8);
    usdValueBuffer.writeBigUInt64LE(BigInt(usdValueCents), 0);
    
    const ixData = Buffer.concat([
        ENTER_LOTTERY_DISCRIMINATOR,
        usdValueBuffer
    ]);

    // Accounts for enter_lottery_with_usd_value:
    //   0. [writable] lottery
    //   1. [writable, signer] participant_account (PDA, init if needed)
    //   2. [signer] participant
    //   3. [] system_program
    const keys = [
        {
            pubkey: lotteryPDA,
            isWritable: true,
            isSigner: false,
        },
        {
            pubkey: participantPDA,
            isWritable: true,
            isSigner: false,
        },
        {
            pubkey: walletKeypair.publicKey,
            isWritable: false,
            isSigner: true,
        },
        {
            pubkey: SystemProgram.programId,
            isWritable: false,
            isSigner: false,
        },
    ];

    const instruction = new Transaction().add({
        programId: LOTTERY_PROGRAM_ID,
        keys,
        data: ixData,
    });

    const tx = new Transaction().add(instruction);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = walletKeypair.publicKey;

    // Sign transaction
    tx.sign(walletKeypair);

    try {
        const sig = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
        });

        await connection.confirmTransaction(sig, 'confirmed');
        return sig;
    } catch (error) {
        throw error;
    }
}

async function makeMultipleEntries() {
    console.log('🎫 Making Lottery Entries (Raw Transactions)\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load test wallets
    const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');
    const walletsInfoPath = path.join(WALLETS_DIR, 'wallets-info.json');
    
    if (!fs.existsSync(walletsInfoPath)) {
        console.error('❌ Test wallets not found! Run create-test-wallets.js first');
        process.exit(1);
    }

    const walletsInfo = JSON.parse(fs.readFileSync(walletsInfoPath, 'utf8'));
    console.log(`📊 Found ${walletsInfo.length} test wallets\n`);

    // Entry amounts in USD cents (need $20+ = 2000+ cents)
    const entryAmounts = [
        2000,  // $20 - 1 ticket
        2500,  // $25 - 1 ticket
        3000,  // $30 - 1 ticket
        5000,  // $50 - 1 ticket
        10000, // $100 - 4 tickets
        15000, // $150 - 4 tickets
        20000, // $200 - 4 tickets
        25000, // $250 - 4 tickets
        30000, // $300 - 4 tickets
        50000, // $500 - 10 tickets
    ];

    let successCount = 0;
    let failCount = 0;

    console.log('🎫 Making entries...\n');

    for (let i = 0; i < Math.min(walletsInfo.length, entryAmounts.length); i++) {
        const walletInfo = walletsInfo[i];
        const walletKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync(walletInfo.path, 'utf8')).secretKey)
        );

        try {
            const usdValue = entryAmounts[i];
            console.log(`   Entry ${i + 1}/${Math.min(walletsInfo.length, entryAmounts.length)}: $${(usdValue / 100).toFixed(2)}...`);
            
            const sig = await enterLotteryRaw(walletKeypair, usdValue);
            console.log(`   ✅ Success! TX: ${sig.slice(0, 16)}...`);
            successCount++;
            
            await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
        } catch (error) {
            console.log(`   ⚠️  Failed: ${error.message}`);
            failCount++;
        }
    }

    console.log(`\n✅ Entries complete: ${successCount} successful, ${failCount} failed\n`);

    // Check lottery state
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (accountInfo) {
        console.log(`📊 Lottery account exists (${accountInfo.data.length} bytes)`);
        console.log(`   Check participants via: node scripts/helius-winner-indexer.js\n`);
    }
}

if (require.main === module) {
    makeMultipleEntries()
        .then(() => {
            console.log('✅ Entry process complete!\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

module.exports = { enterLotteryRaw, makeMultipleEntries };


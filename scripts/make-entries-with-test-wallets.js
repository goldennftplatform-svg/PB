// Make lottery entries using test wallets (bypasses IDL requirement)
// Uses raw transactions to enter lottery

const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

// Calculate instruction discriminator: sha256("global:enter_lottery_with_usd_value")[0:8]
function getEnterLotteryDiscriminator() {
    const hash = crypto.createHash('sha256');
    hash.update('global:enter_lottery_with_usd_value');
    return Buffer.from(hash.digest().slice(0, 8));
}

async function makeEntry(walletKeypair, usdValueCents) {
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

    // Build instruction
    const discriminator = getEnterLotteryDiscriminator();
    const usdValueBuffer = Buffer.allocUnsafe(8);
    usdValueBuffer.writeBigUInt64LE(BigInt(usdValueCents), 0);
    
    const ixData = Buffer.concat([discriminator, usdValueBuffer]);

    const keys = [
        { pubkey: lotteryPDA, isWritable: true, isSigner: false },
        { pubkey: participantPDA, isWritable: true, isSigner: false },
        { pubkey: walletKeypair.publicKey, isWritable: false, isSigner: true },
        { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
    ];

    const instruction = {
        programId: LOTTERY_PROGRAM_ID,
        keys,
        data: ixData,
    };

    const tx = new Transaction();
    tx.add(instruction);
    
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = walletKeypair.publicKey;

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

async function makeEntriesWithTestWallets() {
    console.log('🎫 Making Entries with Test Wallets\n');
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
        2000, 2500, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 50000,
        2000, 2500, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 50000,
        2000, 2500, 3000, 5000, 10000
    ];

    let successCount = 0;
    let failCount = 0;

    console.log('🎫 Making entries...\n');

    for (let i = 0; i < Math.min(walletsInfo.length, entryAmounts.length); i++) {
        const walletInfo = walletsInfo[i];
        
        try {
            const walletKeypair = Keypair.fromSecretKey(
                Uint8Array.from(JSON.parse(fs.readFileSync(walletInfo.path, 'utf8')).secretKey)
            );

            const usdValue = entryAmounts[i];
            console.log(`   Entry ${i + 1}/${Math.min(walletsInfo.length, entryAmounts.length)}: $${(usdValue / 100).toFixed(2)}...`);
            
            const sig = await makeEntry(walletKeypair, usdValue);
            console.log(`   ✅ Success! TX: ${sig.slice(0, 16)}...`);
            successCount++;
            
            await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
        } catch (error) {
            console.log(`   ⚠️  Failed: ${error.message}`);
            failCount++;
        }
    }

    console.log(`\n✅ Entries complete: ${successCount} successful, ${failCount} failed\n`);

    if (successCount >= 9) {
        console.log('✅ Enough participants for snapshot!\n');
    } else {
        console.log(`⚠️  Need ${9 - successCount} more participants for snapshot\n`);
    }
}

if (require.main === module) {
    makeEntriesWithTestWallets()
        .then(() => {
            console.log('✅ Entry process complete!\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

module.exports = { makeEntry, makeEntriesWithTestWallets };


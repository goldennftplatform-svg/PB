// Trigger snapshot using a raw Solana transaction (no IDL required)
// This directly calls the on-chain `take_snapshot` instruction on the
// deployed lottery program that already has the 50/50 rollover logic.

const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
} = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Devnet config
const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';

// Deployed lottery program ID (devnet)
const LOTTERY_PROGRAM_ID = new PublicKey(
    '8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7'
);

// Instruction discriminator for `global:take_snapshot`
// First 8 bytes of sha256("global:take_snapshot")
const TAKE_SNAPSHOT_DISCRIMINATOR = Buffer.from([
    183, 210, 251, 68, 140, 132, 191, 140,
]);

async function triggerSnapshotRaw() {
    console.log('📸 Triggering Snapshot (Raw Transaction)\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet (same as Anchor.toml provider)
    const walletPath =
        process.env.ANCHOR_WALLET ||
        path.join(
            process.env.HOME || process.env.USERPROFILE,
            '.config',
            'solana',
            'id.json'
        );

    if (!fs.existsSync(walletPath)) {
        console.error('❌ Admin wallet not found!');
        console.error(`   Expected at: ${walletPath}`);
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(
        `💰 Balance: ${(balance / 1_000_000_000).toFixed(4)} SOL\n`
    );

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );
    console.log(`🎲 Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Build instruction data: just the discriminator, no args
    const ixData = TAKE_SNAPSHOT_DISCRIMINATOR;

    // Accounts for `take_snapshot`:
    //   0. [writable] lottery (PDA)
    //   1. [signer]   admin
    const keys = [
        {
            pubkey: lotteryPDA,
            isWritable: true,
            isSigner: false,
        },
        {
            pubkey: adminKeypair.publicKey,
            isWritable: false,
            isSigner: true,
        },
    ];

    const instruction = new (require('@solana/web3.js').TransactionInstruction)({
        programId: LOTTERY_PROGRAM_ID,
        keys,
        data: ixData,
    });

    const tx = new Transaction().add(instruction);

    try {
        console.log('🚀 Sending snapshot transaction...\n');
        const sig = await connection.sendTransaction(tx, [adminKeypair], {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
        });

        console.log(`✅ Snapshot transaction sent!`);
        console.log(`   Signature: ${sig}`);
        console.log(
            `   Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet\n`
        );

        console.log(
            '🔍 Check the transaction logs for the Pepe ball count and 50/50 outcome.\n'
        );
        console.log(
            '   - ODD count  => payout mode (50% main, 40% minors, 10% house)'
        );
        console.log(
            '   - EVEN count => rollover (jackpot grows, timer extended)\n'
        );
    } catch (error) {
        console.error('❌ Snapshot failed:', error.message);
        if (error.logs) {
            console.error('\nTransaction logs:');
            error.logs.forEach((log) => console.error('   ', log));
        }
        process.exit(1);
    }
}

if (require.main === module) {
    triggerSnapshotRaw()
        .then(() => {
            console.log('✅ Done.\n');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Unhandled error:', err);
            process.exit(1);
        });
}

module.exports = { triggerSnapshotRaw };



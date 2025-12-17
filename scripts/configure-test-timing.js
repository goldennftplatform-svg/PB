// Configure lottery timing for testing (short intervals)
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function configureTestTiming() {
    console.log('⏱️  Configuring Test Timing\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    // Setup Anchor
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(adminKeypair),
        { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    const lotteryProgram = anchor.workspace.Lottery;
    if (!lotteryProgram) {
        console.error('❌ Lottery program not found! Run: anchor build');
        process.exit(1);
    }

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Configure for testing: 1 minute intervals
    const baseInterval = 60; // 1 minute
    const fastInterval = 30; // 30 seconds
    const fastThreshold = 1 * 1e9; // 1 SOL (low threshold for testing)

    console.log('📊 Configuration:');
    console.log(`   Base Interval: ${baseInterval} seconds (1 minute)`);
    console.log(`   Fast Interval: ${fastInterval} seconds (30 seconds)`);
    console.log(`   Fast Threshold: ${fastThreshold / 1e9} SOL\n`);

    try {
        const tx = await lotteryProgram.methods
            .configureTiming(
                new anchor.BN(baseInterval),
                new anchor.BN(fastInterval),
                new anchor.BN(fastThreshold)
            )
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
            })
            .rpc();

        console.log('✅ Timing configured!');
        console.log(`   Transaction: ${tx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

        await connection.confirmTransaction(tx, 'confirmed');
        console.log('✅ Ready for testing - snapshots can be taken every 1 minute!\n');

    } catch (error) {
        console.error('❌ Configuration failed:', error.message);
        if (error.logs) {
            error.logs.forEach(log => console.error('   ', log));
        }
        throw error;
    }
}

if (require.main === module) {
    configureTestTiming()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { configureTestTiming };


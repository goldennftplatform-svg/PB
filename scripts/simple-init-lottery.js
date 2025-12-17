// Simple Lottery Initialization - Uses Anchor workspace
const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const EXPECTED_ADMIN_ADDRESS = 'Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ';

// Set provider from environment
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

async function simpleInit() {
    console.log('\n' + '='.repeat(70));
    console.log('  🎰 SIMPLE LOTTERY INITIALIZATION');
    console.log('='.repeat(70) + '\n');

    const admin = provider.wallet;
    const adminAddress = admin.publicKey.toString();

    console.log('📋 CONFIGURATION:');
    console.log('   Network:        ' + NETWORK);
    console.log('   Admin Wallet:   ' + adminAddress);
    console.log('');

    if (adminAddress !== EXPECTED_ADMIN_ADDRESS) {
        console.error('❌ Admin wallet mismatch!');
        console.error('   Expected: ' + EXPECTED_ADMIN_ADDRESS);
        console.error('   Found:    ' + adminAddress);
        process.exit(1);
    }

    // Check balance
    const balance = await provider.connection.getBalance(admin.publicKey);
    console.log('💰 WALLET BALANCE:');
    console.log('   Balance:        ' + (balance / 1e9).toFixed(4) + ' SOL');
    console.log('');

    // Use workspace
    const lotteryProgram = anchor.workspace.Lottery;
    if (!lotteryProgram) {
        console.error('❌ Lottery program not found in workspace!');
        console.error('   Make sure you have run: anchor build');
        process.exit(1);
    }

    console.log('✅ Program ID: ' + lotteryProgram.programId.toString());
    console.log('');

    // Derive PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        lotteryProgram.programId
    );

    console.log('📝 LOTTERY PDA:');
    console.log('   Address:        ' + lotteryPDA.toString());
    console.log('');

    // Check if already initialized
    try {
        const existing = await lotteryProgram.account.lottery.fetch(lotteryPDA);
        console.log('✅ Lottery already initialized!');
        console.log('');
        console.log('📊 CURRENT STATE:');
        console.log('   Jackpot:        ' + (existing.jackpotAmount.toNumber() / 1e9).toFixed(4) + ' SOL');
        console.log('   Status:         ' + (existing.isActive ? '✅ Active' : '❌ Paused'));
        console.log('   Base Interval:  ' + (existing.baseSnapshotInterval.toNumber() / 3600) + ' hours');
        console.log('   Fast Interval:  ' + (existing.fastSnapshotInterval.toNumber() / 3600) + ' hours');
        console.log('   Participants:   ' + existing.participants.length);
        console.log('');
        console.log('✅ Ready for testing!');
        console.log('');
        return;
    } catch (e) {
        console.log('📝 Lottery not initialized, proceeding...\n');
    }

    // Initialize
    const initialJackpot = new anchor.BN(20 * 1e9); // 20 SOL

    console.log('🚀 Initializing lottery with ' + (initialJackpot.toNumber() / 1e9) + ' SOL initial jackpot...\n');

    try {
        // Anchor automatically handles PDA seeds when using .accounts()
        const tx = await lotteryProgram.methods
            .initializeLottery(initialJackpot)
            .accounts({
                lottery: lotteryPDA,
                admin: admin.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log('✅ Transaction sent!');
        console.log('   Signature:      ' + tx);
        console.log('   Explorer:       https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
        console.log('');

        // Wait for confirmation
        await provider.connection.confirmTransaction(tx, 'confirmed');
        console.log('✅ Transaction confirmed!\n');

        // Verify
        const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);

        console.log('🎉 Lottery Successfully Initialized!');
        console.log('');
        console.log('📊 LOTTERY STATE:');
        console.log('   Jackpot:        ' + (lottery.jackpotAmount.toNumber() / 1e9).toFixed(4) + ' SOL');
        console.log('   Carry-over:     ' + (lottery.carryOverAmount.toNumber() / 1e9).toFixed(4) + ' SOL');
        console.log('   Base Interval:  ' + (lottery.baseSnapshotInterval.toNumber() / 3600) + ' hours (72h)');
        console.log('   Fast Interval:  ' + (lottery.fastSnapshotInterval.toNumber() / 3600) + ' hours (48h)');
        console.log('   Fast Threshold: ' + (lottery.fastModeThreshold.toNumber() / 1e9) + ' SOL (200 SOL)');
        console.log('   Status:         ' + (lottery.isActive ? '✅ Active' : '❌ Paused'));
        console.log('   Participants:   ' + lottery.participants.length);
        console.log('   Total Snapshots: ' + lottery.totalSnapshots.toNumber());
        console.log('');

        console.log('✅ Ready for testing!');
        console.log('');
        console.log('💡 NEXT STEPS:');
        console.log('   1. Check status: node scripts/check-lottery-status.js');
        console.log('   2. Get participants to enter lottery');
        console.log('   3. Test snapshot: node scripts/trigger-snapshot.js');
        console.log('');

    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        if (error.logs) {
            console.error('\n📋 Program logs:');
            error.logs.forEach(log => console.error('   ', log));
        }
        process.exit(1);
    }
}

if (require.main === module) {
    simpleInit().catch(console.error);
}

module.exports = { simpleInit };













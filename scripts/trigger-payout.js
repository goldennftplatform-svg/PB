// Trigger lottery snapshot and payout
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';

// Program IDs
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function triggerPayout() {
    console.log('🎰 Triggering Lottery Snapshot & Payout\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
        console.error('❌ Admin wallet not found!');
        process.exit(1);
    }

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

    // Fetch current lottery state
    try {
        const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
        console.log(`📊 Current Lottery State:`);
        console.log(`   Participants: ${lottery.totalParticipants.toNumber().toLocaleString()}`);
        console.log(`   Active Participants: ${lottery.participants.length}`);
        console.log(`   Jackpot: ${(lottery.jackpotAmount.toNumber() / 1e9).toFixed(4)} SOL`);
        console.log(`   Last Snapshot: ${new Date(lottery.lastSnapshot.toNumber() * 1000).toLocaleString()}\n`);
    } catch (e) {
        console.error('❌ Could not fetch lottery state:', e.message);
        process.exit(1);
    }

    // Step 1: Take Snapshot
    console.log('📸 Step 1: Taking Snapshot...\n');
    
    try {
        const snapshotTx = await lotteryProgram.methods
            .takeSnapshot()
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
            })
            .rpc();

        console.log(`✅ Snapshot taken!`);
        console.log(`   Transaction: ${snapshotTx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${snapshotTx}?cluster=${NETWORK}\n`);

        // Wait for confirmation
        await connection.confirmTransaction(snapshotTx, 'confirmed');
        await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
        console.error('❌ Snapshot failed:', error.message);
        if (error.logs) {
            error.logs.forEach(log => console.error('   ', log));
        }
        process.exit(1);
    }

    // Step 2: Payout Winners
    console.log('💰 Step 2: Payout Winners...\n');
    
    try {
        const payoutTx = await lotteryProgram.methods
            .payoutWinners()
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
            })
            .rpc();

        console.log(`✅ Payout complete!`);
        console.log(`   Transaction: ${payoutTx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${payoutTx}?cluster=${NETWORK}\n`);

        // Wait for confirmation
        await connection.confirmTransaction(payoutTx, 'confirmed');
        await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
        console.error('❌ Payout failed:', error.message);
        if (error.logs) {
            error.logs.forEach(log => console.error('   ', log));
        }
        process.exit(1);
    }

    // Fetch final state
    try {
        const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
        console.log(`📊 Final Lottery State:`);
        console.log(`   Participants: ${lottery.totalParticipants.toNumber().toLocaleString()}`);
        console.log(`   Active Participants: ${lottery.participants.length}`);
        console.log(`   Jackpot: ${(lottery.jackpotAmount.toNumber() / 1e9).toFixed(4)} SOL`);
        console.log(`   Total Snapshots: ${lottery.totalSnapshots.toNumber()}\n`);
        
        if (lottery.winners && lottery.winners.winners) {
            console.log(`🏆 Winners:`);
            lottery.winners.winners.forEach((winner, i) => {
                if (winner && !winner.equals(PublicKey.default)) {
                    console.log(`   ${i + 1}. ${winner.toString()}`);
                }
            });
            console.log();
        }
    } catch (e) {
        console.log('   (Could not fetch final state)\n');
    }

    console.log('✅ Payout complete!\n');
}

if (require.main === module) {
    triggerPayout()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { triggerPayout };


// Check Lottery Status Script
// Quickly check if lottery is initialized and view current state

const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Use the same program ID as the frontend
const LOTTERY_PROGRAM_ID = new PublicKey('ytKyH7viyfRmqYtS7Y3nCa8kCJXAPTN6MA8a3EmtSn1');
const NETWORK = 'devnet';
const EXPECTED_ADMIN_ADDRESS = 'Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ';

// Load IDL
const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
if (!fs.existsSync(IDL_PATH)) {
    console.error('❌ IDL not found. Run: anchor build');
    process.exit(1);
}
const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

async function checkLotteryStatus() {
    console.log('\n' + '='.repeat(70));
    console.log('  📊 LOTTERY STATUS CHECK');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');
    
    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log('📝 CONFIGURATION:');
    console.log('   Network:        ' + NETWORK);
    console.log('   Program ID:     ' + LOTTERY_PROGRAM_ID.toString());
    console.log('   Lottery PDA:    ' + lotteryPDA.toString());
    console.log('');

    // Check if account exists
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    
    if (!accountInfo) {
        console.log('❌ STATUS: Lottery NOT initialized');
        console.log('');
        console.log('   The lottery account does not exist.');
        console.log('   Run: node scripts/secure-init-lottery.js');
        console.log('');
        process.exit(1);
    }

    console.log('✅ STATUS: Lottery account exists\n');

    // Load admin wallet (just for provider, not for signing)
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('❌ Admin wallet not found for provider setup');
        process.exit(1);
    }

    const adminKeypair = require('@solana/web3.js').Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    const wallet = new Anchor.Wallet(adminKeypair);
    const provider = new Anchor.AnchorProvider(
        connection,
        wallet,
        { commitment: 'confirmed' }
    );

    try {
        const program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, provider);
        const lottery = await program.account.lottery.fetch(lotteryPDA);

        // Calculate time until next snapshot
        const clock = await connection.getSlot();
        const blockTime = await connection.getBlockTime(clock);
        const currentTime = blockTime || Math.floor(Date.now() / 1000);
        const timeSinceLastSnapshot = currentTime - lottery.lastSnapshot.toNumber();
        
        const snapshotInterval = lottery.isFastMode 
            ? lottery.fastSnapshotInterval.toNumber()
            : lottery.baseSnapshotInterval.toNumber();
        
        const timeUntilNextSnapshot = snapshotInterval - timeSinceLastSnapshot;
        const hoursUntilSnapshot = Math.floor(timeUntilNextSnapshot / 3600);
        const minutesUntilSnapshot = Math.floor((timeUntilNextSnapshot % 3600) / 60);

        console.log('📊 LOTTERY STATE:');
        console.log('   Jackpot:           ' + (lottery.jackpotAmount.toNumber() / 1e9).toFixed(4) + ' SOL');
        console.log('   Carry-over:        ' + (lottery.carryOverAmount.toNumber() / 1e9).toFixed(4) + ' SOL');
        console.log('   Fees Collected:    ' + (lottery.feesCollected.toNumber() / 1e9).toFixed(4) + ' SOL');
        console.log('   Status:            ' + (lottery.isActive ? '✅ Active' : '❌ Paused'));
        console.log('   Fast Mode:         ' + (lottery.isFastMode ? '✅ Yes (48h)' : '❌ No (72h)'));
        console.log('');
        console.log('👥 PARTICIPANTS:');
        console.log('   Current:           ' + lottery.participants.length);
        console.log('   Total (all-time):  ' + lottery.totalParticipants.toString());
        console.log('   Required:          9 (for snapshot)');
        console.log('');
        console.log('⏰ SNAPSHOT TIMING:');
        console.log('   Last Snapshot:     ' + new Date(lottery.lastSnapshot.toNumber() * 1000).toLocaleString());
        console.log('   Interval:          ' + (snapshotInterval / 3600) + ' hours');
        console.log('   Time Until Next:   ' + (timeUntilNextSnapshot > 0 
            ? `${hoursUntilSnapshot}h ${minutesUntilSnapshot}m`
            : '✅ Ready now!'));
        console.log('   Total Snapshots:   ' + lottery.totalSnapshots.toString());
        console.log('');
        console.log('👑 ADMIN:');
        console.log('   Address:           ' + lottery.admin.toString());
        console.log('   Matches Whitelist: ' + (lottery.admin.toString() === EXPECTED_ADMIN_ADDRESS ? '✅ Yes' : '❌ No'));
        console.log('');

        // Show current participants if any
        if (lottery.participants.length > 0) {
            console.log('📋 CURRENT PARTICIPANTS:');
            lottery.participants.forEach((p, idx) => {
                const usdValue = p.usdValue ? `$${(p.usdValue.toNumber() / 100).toFixed(2)}` : 'N/A';
                console.log(`   ${idx + 1}. ${p.wallet.toString().substring(0, 8)}... (${p.ticketCount} tickets, ${usdValue})`);
            });
            console.log('');
        }

        // Show winners if any
        if (lottery.winners.mainWinner) {
            console.log('🏆 WINNERS:');
            console.log('   Main Winner:      ' + lottery.winners.mainWinner.toString());
            if (lottery.winners.minorWinners && lottery.winners.minorWinners.length > 0) {
                console.log('   Minor Winners:    ' + lottery.winners.minorWinners.length);
                lottery.winners.minorWinners.forEach((w, idx) => {
                    console.log(`     ${idx + 1}. ${w.toString()}`);
                });
            }
            console.log('');
        }

        console.log('🔗 EXPLORER:');
        console.log('   Lottery PDA:       https://explorer.solana.com/address/' + lotteryPDA.toString() + '?cluster=devnet');
        console.log('   Program:           https://explorer.solana.com/address/' + LOTTERY_PROGRAM_ID.toString() + '?cluster=devnet');
        console.log('');

        // Recommendations
        if (lottery.participants.length < 9) {
            console.log('💡 RECOMMENDATION:');
            console.log('   Need ' + (9 - lottery.participants.length) + ' more participants to trigger snapshot');
            console.log('');
        } else if (timeUntilNextSnapshot <= 0) {
            console.log('💡 RECOMMENDATION:');
            console.log('   ✅ Ready to take snapshot!');
            console.log('   Run: node scripts/trigger-snapshot.js');
            console.log('');
        }

    } catch (error) {
        console.error('❌ Error fetching lottery state:', error.message);
        if (error.logs) {
            console.error('Logs:', error.logs);
        }
        process.exit(1);
    }
}

if (require.main === module) {
    checkLotteryStatus().catch(console.error);
}

module.exports = { checkLotteryStatus };


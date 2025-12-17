// Trigger Snapshot Script
// Manually trigger a snapshot to select winners (for testing)

const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const NETWORK = 'devnet';
const EXPECTED_ADMIN_ADDRESS = 'Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ';

// Load IDL
const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
if (!fs.existsSync(IDL_PATH)) {
    console.error('❌ IDL not found. Run: anchor build');
    process.exit(1);
}
const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

async function triggerSnapshot() {
    console.log('\n' + '='.repeat(70));
    console.log('  📸 TRIGGER SNAPSHOT');
    console.log('='.repeat(70) + '\n');

    // Load admin wallet
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('❌ ERROR: Admin wallet file not found!');
        console.error(`   Location: ${adminKeyPath}`);
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    const adminAddress = adminKeypair.publicKey.toString();
    const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');
    
    console.log('📋 CONFIGURATION:');
    console.log('   Network:        ' + NETWORK);
    console.log('   Program ID:     ' + LOTTERY_PROGRAM_ID.toString());
    console.log('   Admin Wallet:   ' + adminAddress);
    console.log('');

    // Verify admin
    if (adminAddress !== EXPECTED_ADMIN_ADDRESS) {
        console.error('❌ CRITICAL ERROR: Admin wallet mismatch!');
        console.error('   Expected:      ' + EXPECTED_ADMIN_ADDRESS);
        console.error('   Found:         ' + adminAddress);
        console.error('\n   This wallet does not match the frontend whitelist.\n');
        process.exit(1);
    }

    console.log('✅ Admin wallet verified (matches whitelist)');
    console.log('');

    // Check balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    const balanceSOL = (balance / 1e9).toFixed(4);
    console.log('💰 WALLET BALANCE:');
    console.log('   Balance:        ' + balanceSOL + ' SOL');
    
    if (balance < 0.1 * 1e9) {
        console.log('\n⚠️  WARNING: Low balance! Requesting airdrop...');
        try {
            const sig = await connection.requestAirdrop(adminKeypair.publicKey, 2 * 1e9);
            await connection.confirmTransaction(sig, 'confirmed');
            const newBalance = await connection.getBalance(adminKeypair.publicKey);
            console.log('   ✅ Airdrop received! New balance: ' + (newBalance / 1e9).toFixed(4) + ' SOL\n');
        } catch (error) {
            console.error('❌ Airdrop failed:', error.message);
            process.exit(1);
        }
    } else {
        console.log('   ✅ Sufficient balance\n');
    }

    // Set up provider
    const wallet = new Anchor.Wallet(adminKeypair);
    const provider = new Anchor.AnchorProvider(
        connection,
        wallet,
        { commitment: 'confirmed', skipPreflight: false }
    );
    Anchor.setProvider(provider);

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log('📝 LOTTERY PDA:');
    console.log('   Address:        ' + lotteryPDA.toString());
    console.log('');

    // Check if lottery exists
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (!accountInfo) {
        console.error('❌ ERROR: Lottery not initialized!');
        console.error('   Run: node scripts/secure-init-lottery.js first\n');
        process.exit(1);
    }

    const program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, provider);

    // Fetch current lottery state
    let lottery;
    try {
        lottery = await program.account.lottery.fetch(lotteryPDA);
    } catch (error) {
        console.error('❌ Error fetching lottery:', error.message);
        process.exit(1);
    }

    // Verify admin matches
    if (lottery.admin.toString() !== adminAddress) {
        console.error('❌ ERROR: You are not the admin of this lottery!');
        console.error('   Expected: ' + adminAddress);
        console.error('   Found:    ' + lottery.admin.toString());
        process.exit(1);
    }

    // Check if lottery is active
    if (!lottery.isActive) {
        console.error('❌ ERROR: Lottery is paused!');
        console.error('   Resume the lottery first before taking a snapshot.\n');
        process.exit(1);
    }

    // Check participant count
    const participantCount = lottery.participants.length;
    console.log('📊 CURRENT STATE:');
    console.log('   Participants:    ' + participantCount);
    console.log('   Required:       9 (minimum)');
    console.log('   Jackpot:         ' + (lottery.jackpotAmount.toNumber() / 1e9).toFixed(4) + ' SOL');
    console.log('   Status:          ' + (lottery.isActive ? '✅ Active' : '❌ Paused'));
    console.log('');

    if (participantCount < 9) {
        console.error('❌ ERROR: Not enough participants!');
        console.error('   Need at least 9 participants to take a snapshot.');
        console.error('   Current: ' + participantCount);
        console.error('');
        console.error('💡 TIP: Get more participants to enter the lottery first.');
        console.error('');
        process.exit(1);
    }

    // Check timing (warn if too early, but allow override)
    const clock = await connection.getSlot();
    const blockTime = await connection.getBlockTime(clock);
    const currentTime = blockTime || Math.floor(Date.now() / 1000);
    const timeSinceLastSnapshot = currentTime - lottery.lastSnapshot.toNumber();
    
    const snapshotInterval = lottery.isFastMode 
        ? lottery.fastSnapshotInterval.toNumber()
        : lottery.baseSnapshotInterval.toNumber();
    
    const timeUntilNextSnapshot = snapshotInterval - timeSinceLastSnapshot;

    if (timeUntilNextSnapshot > 0) {
        const hours = Math.floor(timeUntilNextSnapshot / 3600);
        const minutes = Math.floor((timeUntilNextSnapshot % 3600) / 60);
        console.log('⚠️  WARNING: Snapshot interval not reached yet!');
        console.log('   Time until next: ' + hours + 'h ' + minutes + 'm');
        console.log('   This will fail unless timing was configured for testing.');
        console.log('');
        
        // Ask for confirmation
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            rl.question('   Continue anyway? (yes/no): ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            console.log('\n❌ Snapshot cancelled.\n');
            process.exit(0);
        }
        console.log('');
    }

    // Show participants
    console.log('👥 PARTICIPANTS:');
    lottery.participants.forEach((p, idx) => {
        const usdValue = p.usdValue ? `$${(p.usdValue.toNumber() / 100).toFixed(2)}` : 'N/A';
        console.log(`   ${idx + 1}. ${p.wallet.toString().substring(0, 8)}... (${p.ticketCount} tickets, ${usdValue})`);
    });
    console.log('');

    try {
        console.log('📤 Sending take_snapshot transaction...\n');
        
        const tx = await program.methods
            .takeSnapshot()
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
            })
            .rpc();

        console.log('✅ Snapshot transaction sent!');
        console.log('   Signature:        ' + tx);
        console.log('   Explorer:         https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
        console.log('');

        // Wait for confirmation and fetch updated state
        console.log('⏳ Waiting for confirmation...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const updatedLottery = await program.account.lottery.fetch(lotteryPDA);

        console.log('📊 SNAPSHOT RESULTS:');
        if (updatedLottery.winners.mainWinner) {
            console.log('   Main Winner:      ' + updatedLottery.winners.mainWinner.toString());
        }
        if (updatedLottery.winners.minorWinners && updatedLottery.winners.minorWinners.length > 0) {
            console.log('   Minor Winners:    ' + updatedLottery.winners.minorWinners.length);
            updatedLottery.winners.minorWinners.forEach((w, idx) => {
                console.log(`     ${idx + 1}. ${w.toString()}`);
            });
        }
        console.log('   Total Snapshots:   ' + updatedLottery.totalSnapshots.toString());
        console.log('   Participants:     ' + updatedLottery.participants.length + ' (cleared after snapshot)');
        console.log('');

        console.log('🎉 Snapshot completed successfully!');
        console.log('');
        console.log('💡 NEXT STEPS:');
        console.log('   1. Check winners: node scripts/check-lottery-status.js');
        console.log('   2. Test payout: node scripts/secure-payout-tool.js');
        console.log('');

    } catch (error) {
        console.error('❌ Snapshot failed:', error.message);
        if (error.logs) {
            console.error('Logs:', error.logs);
        }
        if (error.message.includes('DrawTooEarly')) {
            console.error('');
            console.error('💡 TIP: The snapshot interval has not been reached.');
            console.error('   Configure shorter intervals for testing:');
            console.error('   node scripts/configure-test-timing.js 1');
            console.error('');
        }
        process.exit(1);
    }
}

if (require.main === module) {
    triggerSnapshot().catch(console.error);
}

module.exports = { triggerSnapshot };


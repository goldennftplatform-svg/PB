// Configure Test Timing Script
// Set very short intervals for testing (1 minute snapshots)

const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

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

async function configureTestTiming() {
    console.log('\n' + '='.repeat(70));
    console.log('  ⚙️  CONFIGURE TEST TIMING');
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

    // Check if lottery exists
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (!accountInfo) {
        console.error('❌ ERROR: Lottery not initialized!');
        console.error('   Run: node scripts/secure-init-lottery.js first\n');
        process.exit(1);
    }

    const program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, provider);
    const lottery = await program.account.lottery.fetch(lotteryPDA);

    // Verify admin matches
    if (lottery.admin.toString() !== adminAddress) {
        console.error('❌ ERROR: You are not the admin of this lottery!');
        console.error('   Expected: ' + adminAddress);
        console.error('   Found:    ' + lottery.admin.toString());
        process.exit(1);
    }

    // Get timing from command line or use defaults
    const args = process.argv.slice(2);
    let baseInterval = 60; // 1 minute default
    let fastInterval = 60; // 1 minute default
    let fastThreshold = 200 * 1e9; // 200 SOL default

    if (args.length > 0) {
        const minutes = parseInt(args[0]);
        if (isNaN(minutes) || minutes < 1) {
            console.error('❌ Invalid minutes. Usage: node configure-test-timing.js [minutes]');
            process.exit(1);
        }
        baseInterval = minutes * 60;
        fastInterval = minutes * 60;
    }

    console.log('⚙️  CONFIGURING TIMING:');
    console.log('   Base Interval:    ' + (baseInterval / 60) + ' minutes (' + baseInterval + ' seconds)');
    console.log('   Fast Interval:     ' + (fastInterval / 60) + ' minutes (' + fastInterval + ' seconds)');
    console.log('   Fast Threshold:    ' + (fastThreshold / 1e9) + ' SOL');
    console.log('');

    try {
        console.log('📤 Sending configure_timing transaction...\n');
        
        const tx = await program.methods
            .configureTiming(
                new Anchor.BN(baseInterval),
                new Anchor.BN(fastInterval),
                new Anchor.BN(fastThreshold)
            )
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
            })
            .rpc();

        console.log('✅ Transaction sent!');
        console.log('   Signature:        ' + tx);
        console.log('   Explorer:         https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
        console.log('');

        // Verify the change
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for confirmation
        const updatedLottery = await program.account.lottery.fetch(lotteryPDA);

        console.log('📊 UPDATED LOTTERY STATE:');
        console.log('   Base Interval:    ' + (updatedLottery.baseSnapshotInterval.toNumber() / 60) + ' minutes');
        console.log('   Fast Interval:    ' + (updatedLottery.fastSnapshotInterval.toNumber() / 60) + ' minutes');
        console.log('   Fast Threshold:   ' + (updatedLottery.fastModeThreshold.toNumber() / 1e9) + ' SOL');
        console.log('');

        console.log('🎉 Timing configured successfully!');
        console.log('');
        console.log('💡 NEXT STEPS:');
        console.log('   1. Get participants to enter lottery');
        console.log('   2. Wait ' + (baseInterval / 60) + ' minutes (or trigger snapshot manually)');
        console.log('   3. Run: node scripts/trigger-snapshot.js');
        console.log('   4. Run: node scripts/check-lottery-status.js');
        console.log('');

    } catch (error) {
        console.error('❌ Configuration failed:', error.message);
        if (error.logs) {
            console.error('Logs:', error.logs);
        }
        process.exit(1);
    }
}

if (require.main === module) {
    configureTestTiming().catch(console.error);
}

module.exports = { configureTestTiming };


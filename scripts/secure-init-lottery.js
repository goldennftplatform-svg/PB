// Secure Lottery Initialization using Anchor with proper PDA handling
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const LOTTERY_PROGRAM_ID = new PublicKey('6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb');
const NETWORK = 'devnet';

// Expected Admin Wallet Address (must match frontend whitelist)
const EXPECTED_ADMIN_ADDRESS = 'Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ';

// Load IDL
const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
if (!fs.existsSync(IDL_PATH)) {
    console.error('❌ IDL not found. Run: anchor build');
    process.exit(1);
}
const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

async function secureInitializeLottery() {
    console.log('\n' + '='.repeat(70));
    console.log('  🔒 SECURE LOTTERY INITIALIZATION');
    console.log('='.repeat(70) + '\n');

    // Load admin wallet
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('\n❌ ERROR: Admin wallet file not found!');
        console.error(`   Location: ${adminKeyPath}`);
        console.error('\n   Please ensure your wallet keypair file exists at this location.');
        console.error('   Or set ANCHOR_WALLET environment variable to point to your wallet.\n');
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
    console.log('   Admin Wallet:       ' + adminAddress);
    console.log('');

    // CRITICAL: Verify admin wallet matches expected address
    if (adminAddress !== EXPECTED_ADMIN_ADDRESS) {
        console.error('\n❌ CRITICAL ERROR: Admin wallet mismatch!');
        console.error('   Expected:      ' + EXPECTED_ADMIN_ADDRESS);
        console.error('   Found:         ' + adminAddress);
        console.error('\n   This wallet does not match the frontend whitelist.');
        console.error('   Please use the correct admin wallet before deploying.\n');
        process.exit(1);
    }
    
    console.log('✅ Admin wallet verified (matches whitelist)');
    console.log('');

    // Security check: Verify admin balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    const balanceSOL = (balance / 1e9).toFixed(4);
    
    console.log('💰 WALLET BALANCE:');
    console.log('   Balance:        ' + balanceSOL + ' SOL');
    
    if (balance < 0.1 * 1e9) {
        console.log('\n⚠️  WARNING: Low balance detected!');
        console.log('   Requesting airdrop for devnet...');
        try {
            const sig = await connection.requestAirdrop(adminKeypair.publicKey, 2 * 1e9);
            await connection.confirmTransaction(sig, 'confirmed');
            const newBalance = await connection.getBalance(adminKeypair.publicKey);
            console.log('   ✅ Airdrop received! New balance: ' + (newBalance / 1e9).toFixed(4) + ' SOL\n');
        } catch (error) {
            console.error('\n❌ ERROR: Airdrop failed!');
            console.error('   Reason: ' + error.message);
            console.error('\n   Please fund your wallet manually and try again.\n');
            process.exit(1);
        }
    } else {
        console.log('   ✅ Sufficient balance for deployment\n');
    }

    // Set up Anchor provider
    const wallet = new Anchor.Wallet(adminKeypair);
    const provider = new Anchor.AnchorProvider(
        connection,
        wallet,
        { commitment: 'confirmed', skipPreflight: false }
    );
    Anchor.setProvider(provider);

    // Derive lottery PDA with seeds
    const [lotteryPDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log('📝 LOTTERY PDA:');
    console.log('   Address:        ' + lotteryPDA.toString());
    console.log('   Bump:           ' + bump);
    console.log('');

    // Check if already initialized
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (accountInfo) {
        console.log('⚠️  WARNING: Lottery account already exists!\n');
        try {
            const program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, provider);
            const lottery = await program.account.lottery.fetch(lotteryPDA);
            
            console.log('📊 EXISTING LOTTERY STATE:');
            console.log('   Jackpot:        ' + (lottery.jackpotAmount / 1e9).toFixed(4) + ' SOL');
            console.log('   Admin:          ' + lottery.admin.toString());
            console.log('   Status:         ' + (lottery.isActive ? '✅ Active' : '❌ Paused'));
            console.log('');
            
            // Security check: Verify admin matches
            if (lottery.admin.toString() !== adminAddress) {
                console.error('❌ CRITICAL ERROR: Admin mismatch detected!');
                console.error('   Expected:      ' + adminAddress);
                console.error('   Found:         ' + lottery.admin.toString());
                console.error('\n   This lottery was initialized with a different admin wallet.');
                console.error('   You cannot manage this lottery with your current wallet.\n');
                return { success: false, error: 'Admin mismatch' };
            }
            
            if (lottery.admin.toString() !== EXPECTED_ADMIN_ADDRESS) {
                console.error('❌ CRITICAL ERROR: Lottery admin does not match whitelist!');
                console.error('   Expected:      ' + EXPECTED_ADMIN_ADDRESS);
                console.error('   Found:         ' + lottery.admin.toString());
                console.error('\n   This lottery was initialized with a different admin.');
                console.error('   Frontend whitelist will not work correctly.\n');
                return { success: false, error: 'Admin whitelist mismatch' };
            }
            
            console.log('✅ Admin verified - matches whitelist');
            console.log('✅ Lottery is already initialized and ready to use!\n');
            return { success: true, alreadyInitialized: true, lotteryPDA: lotteryPDA.toString() };
        } catch (error) {
            console.log('⚠️  Account exists but may not be properly initialized');
            console.log('   Attempting secure initialization...\n');
        }
    }

    // Secure initialization
    console.log('🚀 INITIALIZING LOTTERY...\n');
    
    try {
        // Ensure IDL has proper structure for Anchor
        const programIdl = {
            ...IDL,
            accounts: IDL.accounts || [
                {
                    name: "Lottery",
                    discriminator: [162, 182, 26, 12, 164, 214, 112, 3]
                }
            ]
        };
        
        // Create program with proper IDL
        const program = new Anchor.Program(programIdl, LOTTERY_PROGRAM_ID, provider);
        
        const initialJackpot = 20 * 1e9; // 20 SOL in lamports
        
        console.log('📊 INITIAL CONFIGURATION:');
        console.log('   Initial Jackpot:      ' + (initialJackpot / 1e9) + ' SOL');
        console.log('   Admin Wallet:         ' + adminAddress);
        console.log('   Base Interval:       72 hours');
        console.log('   Fast Interval:       48 hours');
        console.log('   Fast Mode Threshold:  200 SOL');
        console.log('');

        // Use Anchor's proper PDA handling with seeds
        const tx = await program.methods
            .initializeLottery(new Anchor.BN(initialJackpot))
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
                systemProgram: Anchor.web3.SystemProgram.programId,
            })
            .signers([adminKeypair])
            .rpc();

        console.log('✅ TRANSACTION SUBMITTED:');
        console.log('   Signature:      ' + tx);
        console.log('   Explorer:       https://explorer.solana.com/tx/' + tx + '?cluster=' + NETWORK);
        console.log('');

        // Wait for confirmation
        console.log('⏳ Waiting for confirmation...');
        await connection.confirmTransaction(tx, 'confirmed');
        console.log('✅ Transaction confirmed on-chain!\n');

        // Verify initialization with security checks
        const lottery = await program.account.lottery.fetch(lotteryPDA);
        
        // Security validation
        if (lottery.admin.toString() !== adminAddress) {
            throw new Error('Security validation failed: Admin mismatch after initialization');
        }
        
        if (lottery.admin.toString() !== EXPECTED_ADMIN_ADDRESS) {
            throw new Error('Security validation failed: Admin does not match whitelist');
        }
        
        if (lottery.jackpotAmount !== initialJackpot) {
            throw new Error('Security validation failed: Jackpot amount mismatch');
        }

        console.log('🔒 SECURITY VALIDATION PASSED\n');
        console.log('='.repeat(70));
        console.log('  📊 LOTTERY STATE');
        console.log('='.repeat(70));
        console.log('   Jackpot Amount:        ' + (lottery.jackpotAmount / 1e9).toFixed(4) + ' SOL');
        console.log('   Admin Wallet:           ' + lottery.admin.toString() + ' ✅');
        console.log('   Status:                 ' + (lottery.isActive ? '✅ Active' : '❌ Paused'));
        console.log('   Base Interval:         ' + (lottery.baseSnapshotInterval / 3600) + ' hours');
        console.log('   Fast Interval:         ' + (lottery.fastSnapshotInterval / 3600) + ' hours');
        console.log('   Fast Mode Threshold:    ' + (lottery.fastModeThreshold / 1e9) + ' SOL');
        console.log('   Fees Collected:        ' + (lottery.feesCollected / 1e9).toFixed(4) + ' SOL');
        console.log('   Total Participants:     ' + lottery.totalParticipants.toString());
        console.log('   Total Snapshots:        ' + lottery.totalSnapshots.toString());
        console.log('='.repeat(70));
        console.log('');

        console.log('🎉 SUCCESS: Lottery initialized securely!');
        console.log('   ✅ Admin wallet matches whitelist');
        console.log('   ✅ All security checks passed');
        console.log('   ✅ Ready for deployment\n');
        
        return {
            success: true,
            lotteryPDA: lotteryPDA.toString(),
            transaction: tx,
            explorer: `https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`,
            securityValidated: true
        };

    } catch (error) {
        console.error('\n❌ INITIALIZATION FAILED');
        console.error('   Error: ' + error.message);
        if (error.logs) {
            console.error('\n   Transaction Logs:');
            error.logs.forEach(log => console.error('      ' + log));
        }
        console.error('');
        return { success: false, error: error.message };
    }
}

if (require.main === module) {
    secureInitializeLottery()
        .then(result => {
            if (!result.success) {
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n❌ FATAL ERROR:');
            console.error('   ' + error.message);
            console.error('');
            process.exit(1);
        });
}

module.exports = { secureInitializeLottery };


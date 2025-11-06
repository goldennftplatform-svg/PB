// Secure Lottery Initialization using Anchor with proper PDA handling
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const LOTTERY_PROGRAM_ID = new PublicKey('6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb');
const NETWORK = 'devnet';

// Load IDL
const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
if (!fs.existsSync(IDL_PATH)) {
    console.error('❌ IDL not found. Run: anchor build');
    process.exit(1);
}
const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

async function secureInitializeLottery() {
    console.log('🔒 Secure Lottery Initialization\n');
    console.log('='.repeat(60) + '\n');

    // Load admin wallet
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('❌ Admin wallet not found!');
        console.error(`   Expected at: ${adminKeyPath}`);
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');
    
    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Program: ${LOTTERY_PROGRAM_ID.toString()}`);
    console.log(`✅ Network: ${NETWORK}\n`);

    // Security check: Verify admin balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Admin Balance: ${(balance / 1e9).toFixed(4)} SOL`);
    
    if (balance < 0.1 * 1e9) {
        console.log('⚠️  Low balance! Requesting airdrop...');
        try {
            const sig = await connection.requestAirdrop(adminKeypair.publicKey, 2 * 1e9);
            await connection.confirmTransaction(sig, 'confirmed');
            console.log('✅ Airdrop received!\n');
        } catch (error) {
            console.error('❌ Airdrop failed:', error.message);
            process.exit(1);
        }
    }
    console.log('');

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

    console.log(`📝 Lottery PDA: ${lotteryPDA.toString()}`);
    console.log(`   Bump: ${bump}\n`);

    // Check if already initialized
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (accountInfo) {
        console.log('⚠️  Lottery account already exists!');
        try {
            const program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, provider);
            const lottery = await program.account.lottery.fetch(lotteryPDA);
            
            console.log('✅ Lottery is already initialized!');
            console.log(`   Jackpot: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL`);
            console.log(`   Admin: ${lottery.admin.toString()}`);
            console.log(`   Active: ${lottery.isActive ? 'Yes' : 'No'}`);
            
            // Security check: Verify admin matches
            if (lottery.admin.toString() !== adminKeypair.publicKey.toString()) {
                console.log('\n⚠️  SECURITY WARNING: Admin mismatch!');
                console.log(`   Expected: ${adminKeypair.publicKey.toString()}`);
                console.log(`   Found: ${lottery.admin.toString()}\n`);
                return { success: false, error: 'Admin mismatch' };
            }
            console.log('\n✅ Admin verified - secure!\n');
            return { success: true, alreadyInitialized: true, lotteryPDA: lotteryPDA.toString() };
        } catch (error) {
            console.log('⚠️  Account exists but may not be properly initialized');
            console.log('   Attempting secure initialization...\n');
        }
    }

    // Secure initialization
    console.log('🔒 Initializing lottery with security checks...\n');
    
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
        
        console.log(`📊 Initial Configuration:`);
        console.log(`   Initial Jackpot: ${initialJackpot / 1e9} SOL`);
        console.log(`   Admin: ${adminKeypair.publicKey.toString()}`);
        console.log(`   Base Interval: 72 hours`);
        console.log(`   Fast Interval: 48 hours`);
        console.log(`   Fast Mode Threshold: 200 SOL\n`);

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

        console.log(`✅ Transaction Signature: ${tx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}\n`);

        // Wait for confirmation
        await connection.confirmTransaction(tx, 'confirmed');
        console.log('✅ Transaction confirmed!\n');

        // Verify initialization with security checks
        const lottery = await program.account.lottery.fetch(lotteryPDA);
        
        // Security validation
        if (lottery.admin.toString() !== adminKeypair.publicKey.toString()) {
            throw new Error('Security validation failed: Admin mismatch after initialization');
        }
        
        if (lottery.jackpotAmount !== initialJackpot) {
            throw new Error('Security validation failed: Jackpot amount mismatch');
        }

        console.log('🔒 SECURITY VALIDATION PASSED\n');
        console.log('📊 LOTTERY STATE:');
        console.log('='.repeat(60));
        console.log(`Jackpot Amount: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL`);
        console.log(`Admin: ${lottery.admin.toString()} ✅`);
        console.log(`Is Active: ${lottery.isActive ? '✅ Yes' : '❌ No'}`);
        console.log(`Base Interval: ${lottery.baseSnapshotInterval / 3600} hours`);
        console.log(`Fast Interval: ${lottery.fastSnapshotInterval / 3600} hours`);
        console.log(`Fast Mode Threshold: ${lottery.fastModeThreshold / 1e9} SOL`);
        console.log(`Fees Collected: ${(lottery.feesCollected / 1e9).toFixed(4)} SOL`);
        console.log(`Total Participants: ${lottery.totalParticipants.toString()}`);
        console.log(`Total Snapshots: ${lottery.totalSnapshots.toString()}\n`);

        console.log('🎉 Lottery initialized securely!\n');
        
        return {
            success: true,
            lotteryPDA: lotteryPDA.toString(),
            transaction: tx,
            explorer: `https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`,
            securityValidated: true
        };

    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        if (error.logs) {
            console.error('Logs:', error.logs);
        }
        return { success: false, error: error.message };
    }
}

if (require.main === module) {
    secureInitializeLottery().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { secureInitializeLottery };


// Initialize Lottery Contract on Devnet
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Configuration
const LOTTERY_PROGRAM_ID = new PublicKey('6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb');
const NETWORK = 'devnet';

// Load IDL
const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
if (!fs.existsSync(IDL_PATH)) {
    console.error('❌ IDL not found. Run: anchor build');
    process.exit(1);
}
const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

async function initializeLottery() {
    console.log('🎰 Initializing Lottery Contract\n');
    console.log('='.repeat(60));
    
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
    console.log(`✅ Program ID: ${LOTTERY_PROGRAM_ID.toString()}`);
    console.log(`✅ Network: ${NETWORK}\n`);

    // Check balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Admin Balance: ${balance / 1e9} SOL`);
    
    if (balance < 0.1 * 1e9) {
        console.log('⚠️  Low balance! Requesting airdrop...');
        try {
            const sig = await connection.requestAirdrop(adminKeypair.publicKey, 2 * 1e9);
            await connection.confirmTransaction(sig, 'confirmed');
            console.log('✅ Airdrop received!\n');
        } catch (error) {
            console.error('❌ Airdrop failed:', error.message);
            console.log('   Please request SOL manually: solana airdrop 2\n');
        }
    }
    console.log('');

    // Set up Anchor provider
    const wallet = new Anchor.Wallet(adminKeypair);
    const provider = new Anchor.AnchorProvider(
        connection,
        wallet,
        { commitment: 'confirmed' }
    );
    Anchor.setProvider(provider);

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`📝 Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Check if already initialized
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (accountInfo) {
        console.log('⚠️  Lottery account already exists!');
        console.log('   Checking if it\'s initialized...\n');
        
        try {
            // Try to load program
            const program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, provider);
            const lottery = await program.account.lottery.fetch(lotteryPDA);
            
            console.log('✅ Lottery is already initialized!');
            console.log(`   Jackpot: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL`);
            console.log(`   Admin: ${lottery.admin.toString()}`);
            console.log(`   Active: ${lottery.isActive ? 'Yes' : 'No'}\n`);
            return { success: true, alreadyInitialized: true, lotteryPDA };
        } catch (error) {
            console.log('⚠️  Account exists but may not be properly initialized');
            console.log('   Attempting to initialize anyway...\n');
        }
    }

    // Initialize lottery
    console.log('🚀 Initializing lottery...\n');
    
    try {
        // Try to load from workspace first (like tests do)
        let program;
        try {
            const workspace = Anchor.workspace;
            if (workspace && workspace.Lottery) {
                program = workspace.Lottery;
                console.log('✅ Loaded program from workspace');
            } else {
                throw new Error('Workspace not available');
            }
        } catch (workspaceError) {
            // Fallback: use anchor test framework
            console.log('⚠️  Workspace not available, trying direct IDL...');
            // Use the IDL directly but ensure proper structure
            program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, provider);
        }
        
        const initialJackpot = 20 * 1e9; // 20 SOL in lamports
        
        console.log(`📊 Initial Configuration:`);
        console.log(`   Initial Jackpot: ${initialJackpot / 1e9} SOL`);
        console.log(`   Base Interval: 72 hours`);
        console.log(`   Fast Interval: 48 hours`);
        console.log(`   Fast Mode Threshold: 200 SOL\n`);

        const tx = await program.methods
            .initializeLottery(new Anchor.BN(initialJackpot))
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
                systemProgram: Anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log(`✅ Transaction Signature: ${tx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}\n`);

        // Wait for confirmation
        await connection.confirmTransaction(tx, 'confirmed');
        console.log('✅ Transaction confirmed!\n');

        // Verify initialization
        const lottery = await program.account.lottery.fetch(lotteryPDA);
        
        console.log('📊 LOTTERY STATE:');
        console.log('='.repeat(60));
        console.log(`Jackpot Amount: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL`);
        console.log(`Admin: ${lottery.admin.toString()}`);
        console.log(`Is Active: ${lottery.isActive ? '✅ Yes' : '❌ No'}`);
        console.log(`Base Interval: ${lottery.baseSnapshotInterval / 3600} hours`);
        console.log(`Fast Interval: ${lottery.fastSnapshotInterval / 3600} hours`);
        console.log(`Fast Mode Threshold: ${lottery.fastModeThreshold / 1e9} SOL`);
        console.log(`Fees Collected: ${(lottery.feesCollected / 1e9).toFixed(4)} SOL`);
        console.log(`Total Participants: ${lottery.totalParticipants.toString()}`);
        console.log(`Total Snapshots: ${lottery.totalSnapshots.toString()}\n`);

        console.log('🎉 Lottery initialized successfully!\n');
        
        return {
            success: true,
            lotteryPDA: lotteryPDA.toString(),
            transaction: tx,
            explorer: `https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}`
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
    initializeLottery().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { initializeLottery };


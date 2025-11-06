// Simple Direct Initialization using Transaction API
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const anchor = require('@coral-xyz/anchor');

const LOTTERY_PROGRAM_ID = new PublicKey('6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb');
const NETWORK = 'devnet';

async function initializeLottery() {
    console.log('🎰 Initializing Lottery on Devnet\n');
    console.log('='.repeat(60) + '\n');

    // Load admin wallet
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('❌ Admin wallet not found!');
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    const connection = new Connection(clusterApiUrl(NETWORK), 'confirmed');
    
    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Program: ${LOTTERY_PROGRAM_ID.toString()}\n`);

    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

    // Derive lottery PDA
    const [lotteryPDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`📝 Lottery PDA: ${lotteryPDA.toString()}`);
    console.log(`   Bump: ${bump}\n`);

    // Check if exists
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (accountInfo) {
        console.log('✅ Lottery already initialized!');
        console.log(`   Size: ${accountInfo.data.length} bytes`);
        console.log(`   Owner: ${accountInfo.owner.toString()}`);
        console.log(`   Lamports: ${accountInfo.lamports / 1e9} SOL\n`);
        
        // Try to fetch using Anchor
        try {
            const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
            const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
            const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair), {});
            const program = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);
            
            const lottery = await program.account.lottery.fetch(lotteryPDA);
            console.log('📊 Current Lottery State:');
            console.log(`   Jackpot: ${lottery.jackpotAmount.toNumber() / 1e9} SOL`);
            console.log(`   Carry-over: ${lottery.carryOverAmount.toNumber() / 1e9} SOL`);
            console.log(`   Active: ${lottery.isActive}`);
            console.log(`   Participants: ${lottery.totalParticipants.toNumber()}\n`);
        } catch (e) {
            console.log('⚠️  Could not fetch lottery state (account exists but may not be fully initialized)\n');
        }
        return;
    }

    console.log('🚀 Initializing lottery...\n');

    // Load IDL to get instruction discriminator
    const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
    if (!fs.existsSync(idlPath)) {
        console.error('❌ IDL not found. Run: anchor build');
        process.exit(1);
    }
    let idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

    // Add accounts array if missing (needed by Anchor)
    if (!idl.accounts) {
        idl.accounts = [
            {
                name: "Lottery",
                type: idl.types.find(t => t.name === "Lottery")
            }
        ];
    }

    // Find initialize_lottery instruction
    const initInstruction = idl.instructions.find(ix => ix.name === 'initialize_lottery');
    if (!initInstruction) {
        throw new Error('initialize_lottery instruction not found in IDL');
    }

    // Create provider and program
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair), {
        commitment: 'confirmed'
    });
    
    // Ensure IDL has proper structure for Anchor - add type reference to accounts
    const lotteryType = idl.types.find(t => t.name === "Lottery");
    const programIdl = {
        ...idl,
        accounts: [
            {
                name: "Lottery",
                discriminator: idl.accounts[0].discriminator,
                ...(lotteryType ? { type: lotteryType.type } : {})
            }
        ]
    };
    
    const program = new anchor.Program(programIdl, LOTTERY_PROGRAM_ID, provider);

    const initialJackpot = new anchor.BN(20 * 1e9); // 20 SOL

    console.log(`📊 Initial Configuration:`);
    console.log(`   Initial Jackpot: ${initialJackpot.toNumber() / 1e9} SOL\n`);

    try {
        const tx = await program.methods
            .initializeLottery(initialJackpot)
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
            })
            .rpc();

        console.log(`✅ Transaction Signature: ${tx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}\n`);

        // Wait for confirmation
        await connection.confirmTransaction(tx, 'confirmed');
        console.log('✅ Transaction confirmed!\n');

        // Verify initialization
        const lottery = await program.account.lottery.fetch(lotteryPDA);
        
        console.log('🎉 Lottery Successfully Initialized!');
        console.log('📊 Lottery State:');
        console.log(`   Jackpot: ${lottery.jackpotAmount.toNumber() / 1e9} SOL`);
        console.log(`   Carry-over: ${lottery.carryOverAmount.toNumber() / 1e9} SOL`);
        console.log(`   Base Snapshot Interval: ${lottery.baseSnapshotInterval.toNumber() / 3600} hours`);
        console.log(`   Fast Snapshot Interval: ${lottery.fastSnapshotInterval.toNumber() / 3600} hours`);
        console.log(`   Fast Mode Threshold: ${lottery.fastModeThreshold.toNumber() / 1e9} SOL`);
        console.log(`   Active: ${lottery.isActive}`);
        console.log(`   Participants: ${lottery.totalParticipants.toNumber()}\n`);
        console.log('✅ Ready for testing!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.logs) {
            console.error('\n📋 Program logs:');
            error.logs.forEach(log => console.error('   ', log));
        }
        throw error;
    }
}

if (require.main === module) {
    initializeLottery().catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { initializeLottery };


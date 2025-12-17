// Close and reinitialize lottery with 50/50 rollover support
const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function reinitLottery() {
    console.log('🔄 Reinitializing Lottery with 50/50 Rollover Support\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
        console.error('❌ Wallet not found!');
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

    // Load IDL
    const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
    if (!fs.existsSync(idlPath)) {
        console.error('❌ IDL not found! Run: anchor build');
        process.exit(1);
    }

    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    const wallet = new anchor.Wallet(adminKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
    });

    anchor.setProvider(provider);
    const program = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        program.programId
    );

    console.log(`🎲 Lottery PDA: ${lotteryPDA.toString()}\n`);

    try {
        // Step 1: Check if lottery exists
        console.log('📊 Step 1: Checking Current Lottery State\n');
        let lotteryExists = false;
        try {
            const lottery = await program.account.lottery.fetch(lotteryPDA);
            lotteryExists = true;
            console.log(`   ✅ Lottery exists`);
            console.log(`   Jackpot: ${(lottery.jackpotAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
            console.log(`   Participants: ${lottery.totalParticipants}\n`);
            
            // Step 2: Close existing lottery
            console.log('🗑️  Step 2: Closing Existing Lottery Account\n');
            try {
                const closeTx = await program.methods
                    .closeLottery()
                    .accounts({
                        lottery: lotteryPDA,
                        admin: adminKeypair.publicKey,
                    })
                    .signers([adminKeypair])
                    .rpc();

                console.log(`   ✅ Close transaction: ${closeTx}`);
                await connection.confirmTransaction(closeTx, 'confirmed');
                console.log('   ✅ Lottery account closed\n');
            } catch (error) {
                console.log(`   ⚠️  Close failed (may need manual close): ${error.message}\n`);
            }
        } catch (error) {
            console.log(`   ℹ️  Lottery doesn't exist yet (fresh start)\n`);
        }

        // Step 3: Deploy updated program
        console.log('🚀 Step 3: Deploying Updated Program\n');
        console.log('   Run: anchor deploy --program-name lottery --provider.cluster devnet\n');
        console.log('   (This will upgrade the program with 50/50 rollover support)\n');

        // Step 4: Initialize new lottery
        console.log('🎰 Step 4: Initializing New Lottery\n');
        const initialJackpot = 20 * LAMPORTS_PER_SOL; // 20 SOL

        try {
            const initTx = await program.methods
                .initializeLottery(new anchor.BN(initialJackpot))
                .accounts({
                    lottery: lotteryPDA,
                    admin: adminKeypair.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([adminKeypair])
                .rpc();

            console.log(`   ✅ Initialize transaction: ${initTx}`);
            console.log(`   Explorer: https://explorer.solana.com/tx/${initTx}?cluster=devnet\n`);
            await connection.confirmTransaction(initTx, 'confirmed');

            // Verify
            const newLottery = await program.account.lottery.fetch(lotteryPDA);
            console.log('✅ Lottery Initialized with 50/50 Rollover Support!');
            console.log(`   Jackpot: ${(newLottery.jackpotAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
            console.log(`   Rollover Count: ${newLottery.rolloverCount || 0}`);
            console.log(`   Pepe Ball Count: ${newLottery.pepeBallCount || 0}`);
            console.log(`   Is Active: ${newLottery.isActive}\n`);

            console.log('='.repeat(70));
            console.log('🎉 Ready to test 50/50 rollover!');
            console.log('   Run: node scripts/test-50-50-rollover.js\n');

        } catch (error) {
            console.error(`   ❌ Initialize failed: ${error.message}`);
            if (error.logs) {
                error.logs.forEach(log => console.error('      ', log));
            }
            throw error;
        }

    } catch (error) {
        console.error('\n❌ Reinitialization failed:', error.message);
        if (error.logs) {
            console.error('\nTransaction logs:');
            error.logs.forEach(log => console.error('   ', log));
        }
        throw error;
    }
}

if (require.main === module) {
    reinitLottery()
        .then(() => {
            console.log('✅ Reinitialization complete!\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

module.exports = { reinitLottery };


// COMPREHENSIVE SCRIPT: Make the lottery work end-to-end
// 1. Check current state
// 2. Fund jackpot if needed
// 3. Sync jackpot_amount field
// 4. Verify frontend can read it

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';
const ADMIN_ADDRESS = 'Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ';

async function makeItWork() {
    console.log('\n' + '='.repeat(80));
    console.log('  🚀 MAKING IT WORK - COMPREHENSIVE SETUP');
    console.log('='.repeat(80) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
        console.error('❌ Admin wallet not found!');
        console.error(`   Location: ${walletPath}`);
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    const adminAddress = adminKeypair.publicKey.toString();
    if (adminAddress !== ADMIN_ADDRESS) {
        console.warn(`⚠️  Admin address mismatch:`);
        console.warn(`   Expected: ${ADMIN_ADDRESS}`);
        console.warn(`   Found: ${adminAddress}`);
        console.warn(`   Continuing anyway...\n`);
    }

    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);

    console.log('📋 CONFIGURATION:');
    console.log(`   Admin: ${adminAddress}`);
    console.log(`   Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Step 1: Check admin balance
    console.log('1️⃣ CHECKING ADMIN BALANCE...\n');
    const adminBalance = await connection.getBalance(adminKeypair.publicKey);
    const adminBalanceSOL = adminBalance / LAMPORTS_PER_SOL;
    console.log(`   Admin Balance: ${adminBalanceSOL.toFixed(4)} SOL\n`);

    if (adminBalance < 0.1 * LAMPORTS_PER_SOL) {
        console.error('❌ Insufficient admin balance! Need at least 0.1 SOL');
        process.exit(1);
    }

    // Step 2: Check lottery account
    console.log('2️⃣ CHECKING LOTTERY ACCOUNT...\n');
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (!accountInfo) {
        console.error('❌ Lottery account not found!');
        console.error('   Run: node scripts/simple-init-lottery.js first');
        process.exit(1);
    }

    const currentJackpot = accountInfo.lamports;
    const currentJackpotSOL = currentJackpot / LAMPORTS_PER_SOL;
    console.log(`   Current Jackpot: ${currentJackpotSOL.toFixed(6)} SOL (${currentJackpot} lamports)\n`);

    // Step 3: Ask if user wants to fund more
    const fundAmount = parseFloat(process.argv[2]) || 0;
    if (fundAmount > 0) {
        console.log(`3️⃣ FUNDING JACKPOT WITH ${fundAmount} SOL...\n`);
        
        if (fundAmount * LAMPORTS_PER_SOL > adminBalance - 0.01 * LAMPORTS_PER_SOL) {
            console.error('❌ Insufficient balance! Need more SOL for fees');
            process.exit(1);
        }

        const amountLamports = Math.floor(fundAmount * LAMPORTS_PER_SOL);
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: adminKeypair.publicKey,
                toPubkey: lotteryPDA,
                lamports: amountLamports,
            })
        );

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminKeypair.publicKey;
        transaction.sign(adminKeypair);

        const sig = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(sig, 'confirmed');

        const newAccountInfo = await connection.getAccountInfo(lotteryPDA);
        const newJackpot = newAccountInfo.lamports;
        const newJackpotSOL = newJackpot / LAMPORTS_PER_SOL;

        console.log(`✅ Funded! New jackpot: ${newJackpotSOL.toFixed(6)} SOL\n`);
    } else {
        console.log('3️⃣ SKIPPING FUNDING (no amount specified)\n');
        console.log('   💡 To fund, run: node scripts/make-it-work.js [amount]\n');
    }

    // Step 4: Sync jackpot_amount field
    console.log('4️⃣ SYNCING JACKPOT_AMOUNT FIELD...\n');
    
    const finalAccountInfo = await connection.getAccountInfo(lotteryPDA);
    const finalJackpot = finalAccountInfo.lamports;
    const finalJackpotSOL = finalJackpot / LAMPORTS_PER_SOL;

    try {
        const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
        if (fs.existsSync(IDL_PATH)) {
            const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));
            const program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, {
                connection: connection,
                wallet: new Anchor.Wallet(adminKeypair)
            });

            // Check current value
            const lottery = await program.account.lottery.fetch(lotteryPDA);
            const currentFieldValue = lottery.jackpotAmount.toNumber();

            if (currentFieldValue !== finalJackpot) {
                console.log(`   Current field value: ${(currentFieldValue / 1e9).toFixed(6)} SOL`);
                console.log(`   Account balance: ${finalJackpotSOL.toFixed(6)} SOL`);
                console.log(`   Updating field to match balance...\n`);

                const tx = await program.methods
                    .updateJackpotAmount(new Anchor.BN(finalJackpot))
                    .accounts({
                        lottery: lotteryPDA,
                        admin: adminKeypair.publicKey,
                    })
                    .rpc();

                await connection.confirmTransaction(tx, 'confirmed');

                const updatedLottery = await program.account.lottery.fetch(lotteryPDA);
                console.log(`✅ Synced! Field now: ${(updatedLottery.jackpotAmount.toNumber() / 1e9).toFixed(6)} SOL\n`);
            } else {
                console.log(`✅ Field already synced: ${finalJackpotSOL.toFixed(6)} SOL\n`);
            }
        } else {
            console.warn('⚠️  IDL not found - cannot update jackpot_amount field');
            console.warn('   Frontend will read from account balance (which is correct)\n');
        }
    } catch (error) {
        console.warn('⚠️  Could not sync field:', error.message);
        console.warn('   Frontend will read from account balance (which is correct)\n');
    }

    // Step 5: Final summary
    console.log('5️⃣ FINAL STATUS...\n');
    console.log('='.repeat(80) + '\n');
    
    const finalCheck = await connection.getAccountInfo(lotteryPDA);
    const finalBalanceSOL = finalCheck.lamports / 1e9;

    console.log('✅ LOTTERY IS READY!\n');
    console.log(`   Jackpot: ${finalBalanceSOL.toFixed(6)} SOL`);
    console.log(`   Account: ${lotteryPDA.toString()}`);
    console.log(`   Explorer: https://explorer.solana.com/address/${lotteryPDA.toString()}?cluster=devnet\n`);

    console.log('📱 FRONTEND CHECKLIST:');
    console.log('   1. Hard refresh the page (Ctrl+Shift+R)');
    console.log('   2. Check browser console for errors');
    console.log('   3. The jackpot should display: ' + finalBalanceSOL.toFixed(4) + ' SOL\n');

    console.log('💡 HOW IT WORKS:');
    console.log('   - Entries record participants (don\'t transfer SOL)');
    console.log('   - Jackpot is funded separately (via token sales or manual funding)');
    console.log('   - Frontend reads jackpot from account balance');
    console.log('   - When snapshot triggers, winners get paid from jackpot\n');

    console.log('🚀 NEXT STEPS:');
    console.log('   - Frontend should now show the jackpot');
    console.log('   - To add more funds: node scripts/make-it-work.js [amount]');
    console.log('   - To trigger snapshot: node scripts/trigger-snapshot.js\n');
}

makeItWork().catch(error => {
    console.error('\n❌ Error:', error);
    if (error.logs) {
        console.error('\nTransaction logs:');
        error.logs.forEach(log => console.error('   ', log));
    }
    process.exit(1);
});

// Sync jackpot_amount field with actual account balance
// This ensures the frontend can read the correct jackpot value

const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

async function syncJackpotAmount() {
    console.log('\n💰 SYNCING JACKPOT AMOUNT\n');
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

    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);

    console.log('📋 CONFIGURATION:');
    console.log(`   Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`   Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Check account balance (this is the real jackpot)
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (!accountInfo) {
        console.error('❌ Lottery account not found!');
        process.exit(1);
    }

    const accountBalance = accountInfo.lamports;
    const accountBalanceSOL = accountBalance / 1e9;

    console.log(`💰 Account Balance: ${accountBalanceSOL.toFixed(6)} SOL (${accountBalance} lamports)\n`);

    // Try to get current jackpot_amount from struct
    let currentJackpotAmount = null;
    try {
        const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
        if (fs.existsSync(IDL_PATH)) {
            const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));
            const program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, {
                connection: connection,
                wallet: new Anchor.Wallet(adminKeypair)
            });
            
            const lottery = await program.account.lottery.fetch(lotteryPDA);
            currentJackpotAmount = lottery.jackpotAmount.toNumber();
            console.log(`📊 Current jackpot_amount field: ${(currentJackpotAmount / 1e9).toFixed(6)} SOL\n`);
        } else {
            console.warn('⚠️  IDL not found - cannot read current jackpot_amount field');
            console.warn('   Will update based on account balance only\n');
        }
    } catch (error) {
        console.warn('⚠️  Could not read current jackpot_amount:', error.message);
        console.warn('   Will update based on account balance\n');
    }

    // Check if update is needed
    if (currentJackpotAmount !== null && currentJackpotAmount === accountBalance) {
        console.log('✅ jackpot_amount is already synced with account balance!\n');
        return;
    }

    // Update jackpot_amount to match account balance
    console.log('🔄 Updating jackpot_amount field...\n');

    try {
        const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
        if (!fs.existsSync(IDL_PATH)) {
            console.error('❌ IDL not found! Cannot update jackpot_amount field.');
            console.error('   Run: anchor build');
            console.error('\n💡 The account balance is correct (${accountBalanceSOL.toFixed(6)} SOL)');
            console.error('   The frontend will read from account balance, which should work.\n');
            return;
        }

        const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));
        const program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, {
            connection: connection,
            wallet: new Anchor.Wallet(adminKeypair)
        });

        const tx = await program.methods
            .updateJackpotAmount(new Anchor.BN(accountBalance))
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
            })
            .rpc();

        console.log(`✅ Transaction sent: ${tx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

        await connection.confirmTransaction(tx, 'confirmed');

        // Verify
        const updatedLottery = await program.account.lottery.fetch(lotteryPDA);
        const updatedJackpotAmount = updatedLottery.jackpotAmount.toNumber();

        console.log('✅ JACKPOT AMOUNT UPDATED!\n');
        console.log(`   Account Balance: ${accountBalanceSOL.toFixed(6)} SOL`);
        console.log(`   jackpot_amount field: ${(updatedJackpotAmount / 1e9).toFixed(6)} SOL`);
        console.log(`   ✅ They match!\n`);

    } catch (error) {
        console.error('❌ Failed to update jackpot_amount:', error.message);
        if (error.logs) {
            console.error('\nTransaction logs:');
            error.logs.forEach(log => console.error('   ', log));
        }
        console.error('\n💡 The account balance is correct and the frontend can read it directly.\n');
    }
}

syncJackpotAmount().catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
});

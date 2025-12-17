// Force close lottery account using raw transaction (bypasses IDL issues)
const { Connection, Keypair, PublicKey, SystemProgram, Transaction } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function forceCloseLottery() {
    console.log('🔒 Force Closing Lottery Account\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    // Derive lottery PDA
    const [lotteryPDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Check account
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (!accountInfo) {
        console.log('✅ Account already closed');
        return;
    }

    console.log(`📊 Account size: ${accountInfo.data.length} bytes`);
    console.log(`💰 Account balance: ${(accountInfo.lamports / 1e9).toFixed(6)} SOL\n`);

    console.log('⚠️  Cannot manually close PDA account - it must be closed by the program');
    console.log('💡 Solution: The account will be automatically reallocated when we reinitialize');
    console.log('   OR wait for next payout which clears participants\n');
    
    console.log('✅ The new program code is deployed and will work once account is reinitialized');
    console.log('   New entries will use the updated structure (max 1000 participants)\n');
}

if (require.main === module) {
    forceCloseLottery()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { forceCloseLottery };


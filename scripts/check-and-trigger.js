// Check for existing participants and trigger snapshot if possible
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function checkAndTrigger() {
    console.log('🔍 Checking Lottery State & Triggering Test\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Get lottery account
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (!accountInfo) {
        console.error('❌ Lottery account not found!');
        process.exit(1);
    }

    // Parse account data (simplified - just check if we can read basic fields)
    // The lottery struct has totalParticipants at a specific offset
    // For now, let's just try to trigger snapshot and see what happens
    
    console.log('📊 Lottery account exists (423 bytes)\n');
    console.log('🚀 Attempting to trigger snapshot...\n');
    console.log('   (This will show the 50/50 rollover logic in action)\n');

    // Use the raw snapshot script
    const { triggerSnapshotRaw } = require('./trigger-snapshot-raw');
    
    try {
        await triggerSnapshotRaw();
        
        console.log('\n✅ Snapshot triggered!');
        console.log('📋 Check the transaction logs above for:');
        console.log('   - Pepe ball count (1-30)');
        console.log('   - ODD = payout mode');
        console.log('   - EVEN = rollover mode\n');
        
        console.log('💡 If you got "NotEnoughParticipants" error:');
        console.log('   - We need to make entries first');
        console.log('   - This requires fixing the IDL (anchor build in WSL)\n');
        
    } catch (error) {
        if (error.message.includes('NotEnoughParticipants')) {
            console.log('\n⚠️  Not enough participants yet');
            console.log('   Need at least 9 participants to trigger snapshot\n');
            console.log('🔧 To make entries:');
            console.log('   1. Fix IDL in WSL: anchor build');
            console.log('   2. Run: node scripts/run-full-test-now.js\n');
        } else {
            console.error('\n❌ Error:', error.message);
        }
    }
}

if (require.main === module) {
    checkAndTrigger()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

module.exports = { checkAndTrigger };


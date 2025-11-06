// Secure Manual Initialization using SystemProgram with proper PDA handling
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, clusterApiUrl, SystemProgram: SysProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

const LOTTERY_PROGRAM_ID = new PublicKey('6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb');
const NETWORK = 'devnet';

async function secureManualInit() {
    console.log('🔒 Secure Manual Lottery Initialization\n');
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

    // Security: Check balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Admin Balance: ${(balance / 1e9).toFixed(4)} SOL`);
    if (balance < 0.1 * 1e9) {
        console.error('❌ Insufficient balance!');
        process.exit(1);
    }
    console.log('');

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
        console.log('✅ Lottery already exists!');
        console.log(`   Size: ${accountInfo.data.length} bytes`);
        console.log(`   Owner: ${accountInfo.owner.toString()}`);
        return { success: true, alreadyExists: true };
    }

    console.log('🚀 Initializing lottery...\n');
    console.log('⚠️  Note: Using Anchor test framework is recommended for proper initialization.');
    console.log('   This manual approach creates the account but initialization');
    console.log('   requires calling the program instruction which needs Anchor.\n');
    console.log('💡 To properly initialize, run:');
    console.log('   $env:ANCHOR_PROVIDER_URL="https://api.devnet.solana.com";');
    console.log('   $env:ANCHOR_WALLET="$env:USERPROFILE\\.config\\solana\\id.json";');
    console.log('   npx ts-mocha -p ./tsconfig.json -t 1000000 tests/integration.ts\n');
    
    return { success: false, needsAnchor: true };
}

if (require.main === module) {
    secureManualInit().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { secureManualInit };


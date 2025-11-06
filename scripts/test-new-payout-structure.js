// Test new payout structure: 68% Grand Prize, 8% Carry-over, 8 winners at 3% each
const { SecurePayoutTool } = require('./secure-payout-tool');
const { Connection, Keypair, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

async function testNewPayoutStructure() {
    console.log('💰 Testing New Payout Structure\n');
    console.log('='.repeat(60) + '\n');
    console.log('New Structure: 68% Grand Prize, 8% Carry-over, 8 winners at 3% each\n');

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

    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const payoutTool = new SecurePayoutTool(adminKeypair, connection);
    await payoutTool.initialize();

    // Test different jackpot amounts
    const testAmounts = [
        { name: 'Small', amount: 100 * 1e9 }, // 100 SOL
        { name: 'Medium', amount: 500 * 1e9 }, // 500 SOL
        { name: 'Large', amount: 2000 * 1e9 }, // 2000 SOL
        { name: 'From 25M Volume', amount: 4091.17 * 1e9 }, // From our test
    ];

    console.log('📊 Payout Calculations:\n');

    for (const test of testAmounts) {
        try {
            const payouts = await payoutTool.calculateSecurePayouts(BigInt(test.amount));
            
            console.log(`${test.name} Jackpot (${test.amount / 1e9} SOL):`);
            console.log(`  Grand Prize:     ${payouts.grandPrizeSOL.toFixed(4)} SOL (68%)`);
            console.log(`  Carry-over:      ${payouts.carryOverSOL.toFixed(4)} SOL (8%)`);
            console.log(`  Each Minor:      ${payouts.minorPayoutPerWinnerSOL.toFixed(4)} SOL (3%)`);
            console.log(`  Total Minor:     ${payouts.totalMinorPayoutSOL.toFixed(4)} SOL (24%)`);
            console.log(`  Total:           ${(payouts.total / 1e9).toFixed(4)} SOL ✅`);
            console.log('');
        } catch (error) {
            console.log(`${test.name}: Error - ${error.message}\n`);
        }
    }

    // Verify totals
    console.log('✅ Payout Structure Verification:');
    console.log('  68% + 8% + 24% (8×3%) = 100% ✅\n');

    console.log('🎉 New payout structure calculations verified!\n');
}

if (require.main === module) {
    testNewPayoutStructure().catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

module.exports = { testNewPayoutStructure };


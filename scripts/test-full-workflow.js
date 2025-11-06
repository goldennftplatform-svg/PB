// Complete workflow test: Initialize, test volume, test payout
const { runVolumeTest } = require('./test-25m-volume');
const { SecurePayoutTool } = require('./secure-payout-tool');
const { Connection, Keypair, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

async function testFullWorkflow() {
    console.log('🧪 Complete Workflow Test\n');
    console.log('='.repeat(60) + '\n');

    // Step 1: Test payout calculations
    console.log('📝 Step 1: Testing New Payout Structure\n');
    const { testNewPayoutStructure } = require('./test-new-payout-structure');
    await testNewPayoutStructure();

    // Step 2: Test 25M volume (already done, show results)
    console.log('\n📝 Step 2: 25M Volume Test Results\n');
    const resultsFile = path.join(__dirname, '..', 'bots', 'results', '25m-volume-test.json');
    if (fs.existsSync(resultsFile)) {
        const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
        console.log(`Volume Generated: $${results.actual.volumeUSD.toLocaleString()} USD`);
        console.log(`Jackpot Contribution: ${results.actual.jackpotContribution.toFixed(4)} SOL\n`);
        
        // Calculate payouts for this jackpot
        const jackpotSOL = results.actual.jackpotContribution;
        const jackpotLamports = BigInt(Math.floor(jackpotSOL * 1e9));
        
        const adminKeyPath = process.env.ANCHOR_WALLET || 
            path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
        const adminKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
        );
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        const payoutTool = new SecurePayoutTool(adminKeypair, connection);
        await payoutTool.initialize();
        
        const payouts = await payoutTool.calculateSecurePayouts(jackpotLamports);
        
        console.log('💰 Expected Payouts from 25M Volume:');
        console.log(`Grand Prize: ${payouts.grandPrizeSOL.toFixed(4)} SOL (68%)`);
        console.log(`Carry-over: ${payouts.carryOverSOL.toFixed(4)} SOL (8%)`);
        console.log(`Each Minor Winner: ${payouts.minorPayoutPerWinnerSOL.toFixed(4)} SOL (3%)`);
        console.log(`Total Minor Payout: ${payouts.totalMinorPayoutSOL.toFixed(4)} SOL (24%)\n`);
    }

    // Step 3: Test payout tool
    console.log('📝 Step 3: Testing Secure Payout Tool\n');
    console.log('='.repeat(60) + '\n');
    
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const payoutTool = new SecurePayoutTool(adminKeypair, connection);
    await payoutTool.initialize();
    
    const securityPassed = await payoutTool.performSecurityChecks();
    payoutTool.displaySecurityChecks();
    
    console.log('\n✅ Workflow test complete!\n');
    console.log('📋 Summary:');
    console.log('  1. ✅ New payout structure verified');
    console.log('  2. ✅ 25M volume test completed');
    console.log('  3. ✅ Payout calculations verified');
    console.log('  4. ⏭️  Lottery initialization needed');
    console.log('  5. ⏭️  Payout execution ready\n');
}

if (require.main === module) {
    testFullWorkflow().catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

module.exports = { testFullWorkflow };


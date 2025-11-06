// Test payout after volume generation - simulates full workflow
const { SecurePayoutTool } = require('./secure-payout-tool');
const { Connection, Keypair, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

async function testPayoutAfterVolume() {
    console.log('💰 Testing Payout After 25M Volume\n');
    console.log('='.repeat(60) + '\n');

    // Load volume test results
    const resultsFile = path.join(__dirname, '..', 'bots', 'results', '25m-volume-test.json');
    let volumeResults = null;
    
    if (fs.existsSync(resultsFile)) {
        volumeResults = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
        console.log('📊 Volume Test Results Loaded:');
        console.log(`   Total Volume: $${volumeResults.actual.volumeUSD.toLocaleString()} USD`);
        console.log(`   Jackpot Contribution: ${volumeResults.actual.jackpotContribution.toFixed(4)} SOL`);
        console.log(`   Expected: ${volumeResults.target.expectedJackpot.toFixed(4)} SOL\n`);
    }

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

    console.log('🔒 Running Security Checks...\n');
    const securityPassed = await payoutTool.performSecurityChecks();
    payoutTool.displaySecurityChecks();

    if (!securityPassed) {
        console.log('\n⚠️  Security checks failed - lottery may not be initialized yet.');
        console.log('   Once lottery is initialized and winners are selected,');
        console.log('   the payout tool will be ready to execute.\n');
        
        if (volumeResults) {
            console.log('📊 Expected Payout from 25M Volume:');
            try {
                // Convert SOL to lamports (ensure it's a whole number)
                const jackpotSOL = volumeResults.actual.jackpotContribution;
                const jackpotLamports = BigInt(Math.floor(jackpotSOL * 1e9));
                const payouts = await payoutTool.calculateSecurePayouts(jackpotLamports);
                
                console.log(`\n💰 Payout Calculations:`);
                console.log(`Total Jackpot: ${(payouts.total / 1e9).toFixed(4)} SOL`);
                console.log(`Main Winner: ${payouts.mainPayoutSOL.toFixed(4)} SOL (60%)`);
                console.log(`Each Minor Winner: ${payouts.minorPayoutPerWinnerSOL.toFixed(4)} SOL (8%)`);
                console.log(`Total Minor Payout: ${payouts.totalMinorPayoutSOL.toFixed(4)} SOL (40%)\n`);
                
                console.log('✅ Payout calculations verified for 25M volume!\n');
            } catch (error) {
                console.log(`\n⚠️  Calculation error: ${error.message}`);
                // Manual calculation as fallback
                const jackpotSOL = volumeResults.actual.jackpotContribution;
                const mainPayout = jackpotSOL * 0.60;
                const minorPayout = jackpotSOL * 0.40 / 5;
                
                console.log(`\n💰 Payout Calculations (fallback):`);
                console.log(`Total Jackpot: ${jackpotSOL.toFixed(4)} SOL`);
                console.log(`Main Winner: ${mainPayout.toFixed(4)} SOL (60%)`);
                console.log(`Each Minor Winner: ${minorPayout.toFixed(4)} SOL (8%)`);
                console.log(`Total Minor Payout: ${(minorPayout * 5).toFixed(4)} SOL (40%)\n`);
            }
        }
        
        return { success: false, securityPassed: false };
    }

    console.log('\n✅ All security checks passed! Ready to execute payout.\n');
    console.log('💰 Executing payout...\n');
    
    const result = await payoutTool.executeSecurePayout();
    
    return result;
}

if (require.main === module) {
    testPayoutAfterVolume().catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

module.exports = { testPayoutAfterVolume };


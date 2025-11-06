// Complete test: Initialize lottery and test payout
const { initializeLottery } = require('./initialize-lottery');
const { SimplePayoutTester } = require('./test-automated-payout-simple');
const { Connection, Keypair, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

async function testCompleteFlow() {
    console.log('🧪 Complete Payout Test: Initialize + Test\n');
    console.log('='.repeat(60) + '\n');

    // Step 1: Initialize lottery
    console.log('📝 STEP 1: Initialize Lottery\n');
    const initResult = await initializeLottery();
    
    if (!initResult.success) {
        console.error('❌ Failed to initialize lottery');
        return { success: false, error: 'Initialization failed' };
    }

    console.log('\n✅ Lottery initialized!\n');
    console.log('='.repeat(60) + '\n');

    // Step 2: Test payout tool
    console.log('📝 STEP 2: Test Payout Tool\n');
    
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const tester = new SimplePayoutTester(adminKeypair, connection);
    await tester.initialize();

    // Check status
    console.log('📊 Checking lottery status...\n');
    const state = await tester.simulatePayout();
    
    console.log('\n✅ Payout tool test complete!\n');
    console.log('='.repeat(60));
    
    return {
        success: true,
        initialization: initResult,
        payoutTest: state
    };
}

if (require.main === module) {
    testCompleteFlow().catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

module.exports = { testCompleteFlow };


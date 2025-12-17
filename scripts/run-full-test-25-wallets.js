// Master script: Create 25 wallets, fund them, simulate $2M revenue, then payout
const { createTestWallets } = require('./create-test-wallets');
const { fundTestWallets } = require('./fund-test-wallets');
const { simulateRevenue } = require('./simulate-2m-revenue');
const { triggerPayout } = require('./trigger-payout');
const fs = require('fs');
const path = require('path');

const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');

async function runFullTest() {
    console.log('🚀 FULL TEST: 25 Wallets → $2M Revenue → Payout\n');
    console.log('='.repeat(70) + '\n');

    try {
        // Step 1: Create 25 test wallets
        console.log('📝 STEP 1: Creating 25 Test Wallets\n');
        let wallets;
        
        const walletsListPath = path.join(WALLETS_DIR, 'wallets-list.json');
        if (fs.existsSync(walletsListPath)) {
            console.log('✅ Test wallets already exist, loading...\n');
            wallets = JSON.parse(fs.readFileSync(walletsListPath, 'utf8'));
        } else {
            wallets = await createTestWallets();
            // Convert to format expected by other scripts
            const walletsInfo = wallets.map((w, i) => ({
                id: i + 1,
                publicKey: w.publicKey,
                path: w.path
            }));
            const walletsInfoPath = path.join(WALLETS_DIR, 'wallets-info.json');
            fs.writeFileSync(walletsInfoPath, JSON.stringify(walletsInfo, null, 2));
            console.log('✅ Wallets created and info saved\n');
        }

        // Step 2: Fund wallets
        console.log('\n📝 STEP 2: Funding Test Wallets\n');
        await fundTestWallets();

        // Step 3: Simulate $2M revenue
        console.log('\n📝 STEP 3: Simulating $2M Revenue\n');
        await simulateRevenue();

        // Step 4: Trigger payout
        console.log('\n📝 STEP 4: Triggering Payout\n');
        await triggerPayout();

        console.log('\n✅ FULL TEST COMPLETE!\n');
        console.log('='.repeat(70) + '\n');
        console.log('📊 Summary:');
        console.log('   ✅ 25 wallets created');
        console.log('   ✅ Wallets funded');
        console.log('   ✅ $2M revenue simulated');
        console.log('   ✅ Payout triggered\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    runFullTest()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { runFullTest };



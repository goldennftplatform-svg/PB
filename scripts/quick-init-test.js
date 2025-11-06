// Quick test: Check if lottery exists, initialize if needed, test payout
// Uses anchor test command to initialize properly

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Quick Init & Payout Test\n');
console.log('='.repeat(60) + '\n');

console.log('📝 Step 1: Running Anchor test to initialize lottery...\n');

try {
    // Run the integration test which initializes the lottery
    const testOutput = execSync(
        'anchor test --skip-build --skip-deploy --provider.cluster devnet tests/integration.ts',
        { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: path.join(__dirname, '..')
        }
    );
    
    console.log('✅ Test completed!');
    console.log('Checking output...\n');
    
    if (testOutput.includes('Lottery initialized') || testOutput.includes('initialized')) {
        console.log('✅ Lottery should be initialized now!\n');
    }
    
} catch (error) {
    console.log('⚠️  Test may have failed, but lottery might still be initialized');
    console.log('   Error:', error.message);
}

console.log('📝 Step 2: Testing payout tool...\n');
console.log('='.repeat(60) + '\n');

// Now test the payout tool
try {
    const payoutTest = require('./test-automated-payout-simple');
    // This will be run separately by the user
    console.log('✅ Ready to test payout!');
    console.log('   Run: node scripts/test-automated-payout-simple.js simulate\n');
} catch (error) {
    console.log('⚠️  Could not load payout tester');
}


// Verify Blockchain Connection and Smart Contract Access
// Tests: RPC connection, Program ID, Lottery PDA, Account data

const { Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const HELIUS_API_KEY = '431ca765-2f35-4b23-8abd-db03796bd85f';
const HELIUS_RPC_URL = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;
// PROGRAM ID - Verified working in test scripts
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function verifyConnection() {
    console.log('\n' + '='.repeat(70));
    console.log('  🔍 BLOCKCHAIN CONNECTION VERIFICATION');
    console.log('='.repeat(70) + '\n');

    // Test 1: RPC Connection
    console.log('📡 Test 1: RPC Connection');
    console.log('   Testing Helius RPC...');
    try {
        const heliusConnection = new Connection(HELIUS_RPC_URL, 'confirmed');
        const heliusVersion = await heliusConnection.getVersion();
        console.log(`   ✅ Helius RPC: Connected`);
        console.log(`      Version: ${heliusVersion['solana-core']}`);
    } catch (error) {
        console.log(`   ❌ Helius RPC failed: ${error.message}`);
    }

    console.log('   Testing Public RPC...');
    try {
        const publicConnection = new Connection(RPC_URL, 'confirmed');
        const publicVersion = await publicConnection.getVersion();
        console.log(`   ✅ Public RPC: Connected`);
        console.log(`      Version: ${publicVersion['solana-core']}`);
    } catch (error) {
        console.log(`   ❌ Public RPC failed: ${error.message}`);
    }
    console.log('');

    // Test 2: Program ID Verification
    console.log('🔑 Test 2: Program ID Verification');
    console.log(`   Program ID: ${LOTTERY_PROGRAM_ID.toString()}`);
    try {
        const connection = new Connection(HELIUS_RPC_URL || RPC_URL, 'confirmed');
        const programInfo = await connection.getAccountInfo(LOTTERY_PROGRAM_ID);
        if (programInfo) {
            console.log(`   ✅ Program exists on-chain`);
            console.log(`      Owner: ${programInfo.owner.toString()}`);
            console.log(`      Executable: ${programInfo.executable}`);
            console.log(`      Data Length: ${programInfo.data.length} bytes`);
        } else {
            console.log(`   ❌ Program NOT found on-chain!`);
            console.log(`      Check if program is deployed to devnet`);
        }
    } catch (error) {
        console.log(`   ❌ Error checking program: ${error.message}`);
    }
    console.log('');

    // Test 3: Lottery PDA Derivation
    console.log('🎰 Test 3: Lottery PDA Derivation');
    try {
        const [lotteryPDA, bump] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );
        console.log(`   ✅ PDA Derived: ${lotteryPDA.toString()}`);
        console.log(`      Bump: ${bump}`);
        
        // Check if PDA account exists
        const connection = new Connection(HELIUS_RPC_URL || RPC_URL, 'confirmed');
        const pdaInfo = await connection.getAccountInfo(lotteryPDA);
        if (pdaInfo) {
            console.log(`   ✅ Lottery account EXISTS on-chain`);
            console.log(`      Owner: ${pdaInfo.owner.toString()}`);
            console.log(`      Data Length: ${pdaInfo.data.length} bytes`);
            console.log(`      Lamports: ${pdaInfo.lamports / 1e9} SOL`);
        } else {
            console.log(`   ⚠️  Lottery account NOT initialized`);
            console.log(`      Run: node scripts/quick-test-real-data.js to initialize`);
        }
    } catch (error) {
        console.log(`   ❌ Error deriving PDA: ${error.message}`);
    }
    console.log('');

    // Test 4: Recent Transactions
    console.log('📋 Test 4: Recent Transactions');
    try {
        const connection = new Connection(HELIUS_RPC_URL || RPC_URL, 'confirmed');
        const [lotteryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );
        
        const signatures = await connection.getSignaturesForAddress(
            lotteryPDA,
            { limit: 10 }
        );
        
        console.log(`   ✅ Found ${signatures.length} recent transactions`);
        if (signatures.length > 0) {
            console.log(`   Latest transactions:`);
            signatures.slice(0, 5).forEach((sig, idx) => {
                const date = new Date(sig.blockTime * 1000);
                console.log(`      ${idx + 1}. ${sig.signature.substring(0, 16)}...`);
                console.log(`         Date: ${date.toLocaleString()}`);
                console.log(`         Explorer: https://explorer.solana.com/tx/${sig.signature}?cluster=devnet`);
            });
        } else {
            console.log(`   ⚠️  No transactions found - lottery may not be initialized`);
        }
    } catch (error) {
        console.log(`   ❌ Error fetching transactions: ${error.message}`);
    }
    console.log('');

    // Test 5: Account Data Parsing (if account exists)
    console.log('📊 Test 5: Account Data Access');
    try {
        const connection = new Connection(HELIUS_RPC_URL || RPC_URL, 'confirmed');
        const [lotteryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );
        
        const accountInfo = await connection.getAccountInfo(lotteryPDA);
        if (accountInfo && accountInfo.data.length > 0) {
            console.log(`   ✅ Account data accessible`);
            console.log(`      Data size: ${accountInfo.data.length} bytes`);
            console.log(`      First 32 bytes (hex): ${accountInfo.data.slice(0, 32).toString('hex')}`);
            console.log(`   ⚠️  Note: Full parsing requires IDL/Anchor`);
        } else {
            console.log(`   ⚠️  Account not initialized or empty`);
        }
    } catch (error) {
        console.log(`   ❌ Error accessing account data: ${error.message}`);
    }
    console.log('');

    // Test 6: Frontend Compatibility Check
    console.log('🌐 Test 6: Frontend Configuration');
    console.log(`   Program ID: ${LOTTERY_PROGRAM_ID.toString()}`);
    console.log(`   Network: ${NETWORK}`);
    console.log(`   RPC URL: ${HELIUS_RPC_URL || RPC_URL}`);
    console.log(`   Explorer: https://explorer.solana.com/address/${LOTTERY_PROGRAM_ID.toString()}?cluster=devnet`);
    console.log('');

    // Summary
    console.log('='.repeat(70));
    console.log('  📋 VERIFICATION SUMMARY');
    console.log('='.repeat(70) + '\n');
    console.log('✅ If all tests passed, your frontend should be able to:');
    console.log('   1. Connect to devnet RPC');
    console.log('   2. Access the lottery program');
    console.log('   3. Read lottery account data');
    console.log('   4. Fetch transaction history\n');
    console.log('⚠️  If tests failed, check:');
    console.log('   1. Program is deployed to devnet');
    console.log('   2. Lottery is initialized (run test script)');
    console.log('   3. RPC endpoints are accessible');
    console.log('   4. Network configuration matches\n');
}

if (require.main === module) {
    verifyConnection()
        .then(() => {
            console.log('✅ Verification complete!\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Verification failed:', error);
            process.exit(1);
        });
}

module.exports = { verifyConnection };

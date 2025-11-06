// Test devnet deployment of upgraded contracts
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');

const PROGRAM_IDS = {
    token: new PublicKey('HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR'),
    lottery: new PublicKey('6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb'),
    lpManager: new PublicKey('G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG')
};

async function testDeployment() {
    console.log('🧪 Testing Devnet Deployment');
    console.log('='.repeat(50));
    
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    
    let allPassed = true;
    
    for (const [name, programId] of Object.entries(PROGRAM_IDS)) {
        try {
            console.log(`\n📋 Testing ${name}...`);
            console.log(`   Program ID: ${programId.toString()}`);
            
            const accountInfo = await connection.getAccountInfo(programId);
            
            if (accountInfo) {
                console.log(`   ✅ Program deployed and on-chain`);
                console.log(`   Owner: ${accountInfo.owner.toString()}`);
                console.log(`   Executable: ${accountInfo.executable}`);
                console.log(`   Data Length: ${accountInfo.data.length} bytes`);
                
                // Check if it's executable
                if (accountInfo.executable) {
                    console.log(`   ✅ Program is executable`);
                } else {
                    console.log(`   ⚠️  Program account exists but not marked executable`);
                    allPassed = false;
                }
            } else {
                console.log(`   ❌ Program not found on-chain`);
                allPassed = false;
            }
        } catch (error) {
            console.log(`   ❌ Error checking ${name}: ${error.message}`);
            allPassed = false;
        }
    }
    
    console.log('\n📊 DEPLOYMENT TEST SUMMARY');
    console.log('='.repeat(50));
    
    if (allPassed) {
        console.log('✅ ALL PROGRAMS DEPLOYED SUCCESSFULLY!');
        console.log('\n🔗 Explorer Links:');
        console.log(`   Token: https://explorer.solana.com/address/${PROGRAM_IDS.token.toString()}?cluster=devnet`);
        console.log(`   Lottery: https://explorer.solana.com/address/${PROGRAM_IDS.lottery.toString()}?cluster=devnet`);
        console.log(`   LP Manager: https://explorer.solana.com/address/${PROGRAM_IDS.lpManager.toString()}?cluster=devnet`);
    } else {
        console.log('❌ SOME PROGRAMS FAILED TO DEPLOY');
    }
    
    return allPassed;
}

testDeployment().catch(console.error);




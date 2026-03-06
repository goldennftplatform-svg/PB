// Read pepe_ball_count directly from lottery account data
const { Connection, PublicKey } = require('@solana/web3.js');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

async function readPepeBallCount() {
    console.log('\n🔍 READING PEPE BALL COUNT FROM ACCOUNT DATA\n');
    console.log('='.repeat(80) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');
    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);

    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    if (!accountInfo) {
        console.error('❌ Lottery account not found!');
        process.exit(1);
    }

    console.log(`✅ Account found (${accountInfo.data.length} bytes)\n`);

    // The pepe_ball_count is a u8 at the end of the struct
    // Based on struct layout, it should be near the end
    // Try reading from different offsets
    const data = accountInfo.data;
    
    console.log('🔍 Searching for pepe_ball_count (u8, value 1-30)...\n');
    
    // Try reading from end of struct (likely at offset 422 or 421 for 423-byte struct)
    const possibleOffsets = [420, 421, 422, 419, 418];
    
    for (const offset of possibleOffsets) {
        if (offset < data.length) {
            const value = data[offset];
            if (value >= 1 && value <= 30) {
                const isOdd = value % 2 === 1;
                console.log(`   ✅ Found at offset ${offset}: ${value}`);
                console.log(`   🎲 Pepe Ball Count: ${value}`);
                console.log(`   📊 Result: ${isOdd ? '🎉 ODD - PAYOUT TIME!' : '🚀 EVEN - ROLLOVER!'}\n`);
                
                if (isOdd) {
                    console.log('   💡 This was ODD - Winners should be selected and payout triggered!\n');
                } else {
                    console.log('   💡 This was EVEN - Rollover! No payout yet.\n');
                }
                return value;
            }
        }
    }
    
    console.log('⚠️  Could not find pepe_ball_count in expected offsets\n');
    console.log('   Showing last 10 bytes of account data:');
    const lastBytes = Array.from(data.slice(-10));
    lastBytes.forEach((byte, i) => {
        console.log(`   Offset ${data.length - 10 + i}: ${byte} (${byte >= 1 && byte <= 30 ? '✅ Possible!' : ''})`);
    });
}

readPepeBallCount().catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
});

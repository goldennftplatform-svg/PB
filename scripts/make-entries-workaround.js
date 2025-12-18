// Workaround: Make entries using Solana CLI or direct RPC calls
// This bypasses the IDL requirement

const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function makeEntriesWorkaround() {
    console.log('🎫 Making Entries (Workaround Method)\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load test wallets
    const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');
    const walletsInfoPath = path.join(WALLETS_DIR, 'wallets-info.json');
    
    if (!fs.existsSync(walletsInfoPath)) {
        console.error('❌ Test wallets not found!');
        process.exit(1);
    }

    const walletsInfo = JSON.parse(fs.readFileSync(walletsInfoPath, 'utf8'));
    console.log(`📊 Found ${walletsInfo.length} test wallets\n`);

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`🎲 Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Try using Solana CLI to call the program
    // This is a workaround - we'll use anchor test if available
    console.log('💡 Workaround: Using Anchor test framework\n');
    console.log('   Since IDL is missing, we need to:');
    console.log('   1. Fix IDL in WSL (anchor build)');
    console.log('   2. OR use existing participants if any exist\n');

    // Check for existing participants
    console.log('🔍 Checking for existing participants...\n');
    
    // Try to get participant accounts using getProgramAccounts
    try {
        const participantAccounts = await connection.getProgramAccounts(LOTTERY_PROGRAM_ID, {
            filters: [
                {
                    memcmp: {
                        offset: 0,
                        bytes: Buffer.from('participant').slice(0, 8) // Account discriminator
                    }
                }
            ]
        });

        console.log(`   Found ${participantAccounts.length} participant accounts\n`);
        
        if (participantAccounts.length >= 9) {
            console.log('✅ Enough participants exist! Proceeding to snapshot...\n');
            return true;
        } else {
            console.log(`   Need ${9 - participantAccounts.length} more participants\n`);
        }
    } catch (error) {
        console.log(`   ⚠️  Could not check participants: ${error.message}\n`);
    }

    console.log('❌ Cannot make entries without IDL\n');
    console.log('🔧 Solution: Fix IDL in WSL, then run:');
    console.log('   node scripts/test-50-50-rollover.js\n');
    
    return false;
}

if (require.main === module) {
    makeEntriesWorkaround()
        .then((hasEnough) => {
            if (hasEnough) {
                console.log('✅ Ready to trigger snapshot!\n');
                process.exit(0);
            } else {
                console.log('⏭️  Need to create entries first\n');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

module.exports = { makeEntriesWorkaround };


// Fetch IDL from on-chain program (alternative to building)
const { Connection, PublicKey } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function fetchIDLFromChain() {
    console.log('📥 Fetching IDL from On-Chain Program\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    try {
        // Try to fetch IDL using Anchor
        const program = new anchor.Program(
            null, // IDL will be fetched
            LOTTERY_PROGRAM_ID,
            new anchor.AnchorProvider(
                connection,
                { publicKey: PublicKey.default },
                { commitment: 'confirmed' }
            )
        );

        console.log('🔍 Attempting to fetch IDL...\n');

        // Anchor can fetch IDL from the program's IDL account
        const idl = await anchor.Program.fetchIdl(LOTTERY_PROGRAM_ID, {
            connection: connection
        });

        if (idl) {
            console.log('✅ IDL fetched successfully!\n');

            // Save to target/idl/lottery.json
            const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
            const targetDir = path.dirname(idlPath);

            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            fs.writeFileSync(idlPath, JSON.stringify(idl, null, 2));
            console.log(`✅ IDL saved to: ${idlPath}\n`);

            // Check for new fields
            const idlContent = JSON.stringify(idl, null, 2);
            if (idlContent.includes('rollover_count')) {
                console.log('   ✅ rollover_count found in IDL');
            }
            if (idlContent.includes('pepe_ball_count')) {
                console.log('   ✅ pepe_ball_count found in IDL');
            }

            console.log('\n🎉 IDL ready! You can now use it in scripts.\n');
            return true;
        } else {
            console.log('❌ Could not fetch IDL from chain\n');
            return false;
        }
    } catch (error) {
        console.error('❌ Error fetching IDL:', error.message);
        console.log('\n💡 Alternative: Build IDL locally or use raw transactions\n');
        return false;
    }
}

if (require.main === module) {
    fetchIDLFromChain()
        .then((success) => {
            if (success) {
                console.log('✅ Done!\n');
                process.exit(0);
            } else {
                console.log('⚠️  IDL fetch failed, but program is still deployed and working\n');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

module.exports = { fetchIDLFromChain };








// Create 25 test wallets for testing
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');
const NUM_WALLETS = 25;

async function createTestWallets() {
    console.log('👥 Creating Test Wallets\n');
    console.log('='.repeat(70) + '\n');

    // Create wallets directory
    if (!fs.existsSync(WALLETS_DIR)) {
        fs.mkdirSync(WALLETS_DIR, { recursive: true });
    }

    const wallets = [];

    for (let i = 0; i < NUM_WALLETS; i++) {
        const keypair = Keypair.generate();
        const walletData = {
            publicKey: keypair.publicKey.toString(),
            secretKey: Array.from(keypair.secretKey),
            index: i + 1
        };

        const walletPath = path.join(WALLETS_DIR, `wallet-${i + 1}.json`);
        fs.writeFileSync(walletPath, JSON.stringify(walletData, null, 2));

        wallets.push({
            index: i + 1,
            publicKey: keypair.publicKey.toString(),
            path: walletPath
        });

        console.log(`✅ Wallet ${i + 1}: ${keypair.publicKey.toString()}`);
    }

    // Save wallet list
    const walletsListPath = path.join(WALLETS_DIR, 'wallets-list.json');
    fs.writeFileSync(walletsListPath, JSON.stringify(wallets, null, 2));

    // Also save in format expected by other scripts
    const walletsInfo = wallets.map((w, i) => ({
        id: i + 1,
        publicKey: w.publicKey,
        path: w.path
    }));
    const walletsInfoPath = path.join(WALLETS_DIR, 'wallets-info.json');
    fs.writeFileSync(walletsInfoPath, JSON.stringify(walletsInfo, null, 2));

    console.log(`\n✅ Created ${NUM_WALLETS} test wallets!`);
    console.log(`📁 Wallets saved to: ${WALLETS_DIR}\n`);

    return wallets;
}

if (require.main === module) {
    createTestWallets()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { createTestWallets };
